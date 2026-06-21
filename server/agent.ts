import "./env.js";
import type {
  AdaptiveQuizQuestion,
  QuizAnswerRecord,
  QuizDifficulty,
  SessionReport,
  SkillNode,
} from "../shared/types.js";
import { nodeById } from "./content-data.js";
import {
  generateAdaptiveQuestionWithGemini,
  generateLessonWithGemini,
  generateSessionReportWithGemini,
  isGeminiConfigured,
  toSkillNode,
} from "./gemini.js";
import {
  loadLoopState,
  queryTopicContext,
  ingestLearnerMemory,
} from "./hydra.js";
import { buildTopicNode, slugTopic } from "./topic-builder.js";
import { generateSkillQuiz } from "./quiz-generator.js";

export interface AgentContext {
  topic: string;
  subTenantId: string;
  baseNode?: SkillNode;
}

export interface NextQuestionContext {
  subTenantId: string;
  nodeId: string;
  title: string;
  lesson: string[];
  difficulty: QuizDifficulty;
  history: QuizAnswerRecord[];
  recovery: boolean;
}

function buildLearnerProfile(state: import("../shared/types.js").LoopState | null, topic: string): string {
  if (!state) return "New learner — no prior sessions recorded.";

  const lines: string[] = [
    `Active skill: ${state.activeSkillId}, XP: ${state.xp}, streak: ${state.streak}`,
  ];

  const shaky = Object.entries(state.mastery)
    .filter(([, m]) => m === "shaky")
    .map(([id]) => {
      const n = nodeById(id);
      const note = (state.notes[id] ?? [])[0];
      return n ? `${n.title}${note ? ` (${note})` : ""}` : id;
    });
  if (shaky.length) lines.push(`Shaky areas: ${shaky.join(", ")}`);

  return lines.join("\n");
}

function buildLessonPrompt(opts: {
  topic: string;
  learnerProfile: string;
  knowledgeChunks: string[];
  baseNode?: SkillNode;
}): string {
  const knowledge = opts.knowledgeChunks.length
    ? opts.knowledgeChunks.map((c, i) => `[${i + 1}] ${c}`).join("\n\n")
    : "Use accurate technical content.";

  const ref = opts.baseNode
    ? `\nReference (adapt, don't copy):\n${opts.baseNode.lesson.join("\n")}`
    : "";

  return `You are Loop, an adaptive study buddy. Generate ONLY a lesson (no quiz) as JSON.

TOPIC: ${opts.topic}
LEARNER: ${opts.learnerProfile}
KNOWLEDGE: ${knowledge}${ref}

Return JSON:
{"title":"...","blurb":"one sentence","lesson":["para1","para2","para3"]}

Rules: 3-4 paragraphs, personalized, technically accurate, no markdown.`;
}

function buildQuestionPrompt(ctx: NextQuestionContext): string {
  const historyText =
    ctx.history.length === 0
      ? "No prior questions this session."
      : ctx.history
          .map(
            (h, i) =>
              `Q${i + 1} [${h.difficulty}] ${h.question}\n  User picked: "${h.picked}" (${h.correct ? "correct" : "wrong"})\n  Concept: ${h.conceptTested}${h.gapIfWrong ? `\n  Gap: ${h.gapIfWrong}` : ""}`,
          )
          .join("\n");

  return `You are Loop. Generate ONE quiz question as JSON for adaptive learning.

TOPIC: ${ctx.title}
DIFFICULTY LEVEL: ${ctx.difficulty}
${ctx.recovery ? "This is a RECOVERY question — the learner struggled before. Be supportive but accurate." : ""}

LESSON CONTENT:
${ctx.lesson.join("\n\n")}

PREVIOUS QUESTIONS THIS SESSION:
${historyText}

Rules for difficulty:
- basic: definitions, core vocabulary, straightforward recall
- intermediate: apply concepts, compare options, common pitfalls
- hard: edge cases, trade-offs, scenario-based reasoning

Do NOT repeat questions already asked. Build on what the learner got wrong.

Return JSON:
{
  "q": "question text",
  "options": ["A","B","C","D"],
  "answer": 0,
  "explanation": "why correct",
  "difficulty": "${ctx.difficulty}",
  "conceptTested": "short label e.g. Pod networking"
}

Exactly 4 options. answer is 0-based index. Test ${ctx.title} knowledge only.`;
}

function buildReportPrompt(opts: {
  title: string;
  history: QuizAnswerRecord[];
  correct: number;
  incorrect: number;
}): string {
  const perf = opts.history
    .map(
      (h) =>
        `- [${h.difficulty}] ${h.conceptTested}: ${h.correct ? "correct" : `wrong — gap: ${h.gapIfWrong ?? h.question}`}`,
    )
    .join("\n");

  return `You are Loop. Write a personalized session report as JSON.

TOPIC: ${opts.title}
SCORE: ${opts.correct} correct, ${opts.incorrect} missed

QUESTION BREAKDOWN:
${perf}

Return JSON:
{
  "recap": "2-3 sentences summarizing performance and difficulty progression",
  "gapsToReview": ["specific concept they still need to learn", "..."],
  "encouragement": "one motivating sentence"
}

gapsToReview must list concrete topics/concepts to study next based on wrong answers and difficulty levels attempted.`;
}

export function initialDifficulty(mastery: string): QuizDifficulty {
  if (mastery === "mastered") return "hard";
  if (mastery === "practiced") return "intermediate";
  return "basic";
}

export function adjustDifficulty(
  current: QuizDifficulty,
  history: QuizAnswerRecord[],
): QuizDifficulty {
  const recent = history.slice(-3);
  if (recent.length === 0) return current;
  const rate = recent.filter((h) => h.correct).length / recent.length;

  if (rate >= 0.67) {
    if (current === "basic") return "intermediate";
    if (current === "intermediate") return "hard";
    return "hard";
  }
  if (rate <= 0.34) {
    if (current === "hard") return "intermediate";
    if (current === "intermediate") return "basic";
    return "basic";
  }
  return current;
}

export async function generatePersonalizedContent(ctx: AgentContext): Promise<SkillNode> {
  const topic = ctx.topic.trim();
  const id = ctx.baseNode?.id ?? slugTopic(topic);

  const [state, knowledgeChunks] = await Promise.all([
    loadLoopState(ctx.subTenantId),
    queryTopicContext(topic, ctx.subTenantId),
  ]);

  if (!isGeminiConfigured()) {
    return buildTopicNode(topic, knowledgeChunks);
  }

  try {
    const generated = await generateLessonWithGemini(
      buildLessonPrompt({
        topic,
        learnerProfile: buildLearnerProfile(state, topic),
        knowledgeChunks,
        baseNode: ctx.baseNode,
      }),
    );
    const node = toSkillNode(id, generated, ctx.baseNode?.prereqs ?? []);

    await ingestLearnerMemory(ctx.subTenantId, {
      topic,
      summary: `Started lesson on ${node.title}.`,
    });

    return node;
  } catch (err) {
    console.warn("[agent] Lesson generation failed:", err);
    const fallback = buildTopicNode(topic, knowledgeChunks);
    return { ...fallback, id, quiz: [] };
  }
}

export async function generateNextQuestion(
  ctx: NextQuestionContext,
): Promise<AdaptiveQuizQuestion> {
  if (isGeminiConfigured()) {
    try {
      return await generateAdaptiveQuestionWithGemini(buildQuestionPrompt(ctx));
    } catch (err) {
      console.warn("[agent] Question generation failed, using fallback:", err);
    }
  }

  const fallback = generateSkillQuiz(ctx.title, ctx.lesson);
  const idx = ctx.history.length % Math.max(fallback.length, 1);
  const q = fallback[idx] ?? fallback[0];
  return {
    ...q,
    difficulty: ctx.difficulty,
    conceptTested: ctx.title,
  };
}

export async function generateLearningReport(opts: {
  title: string;
  history: QuizAnswerRecord[];
  correct: number;
  incorrect: number;
}): Promise<SessionReport> {
  if (isGeminiConfigured()) {
    try {
      return await generateSessionReportWithGemini(buildReportPrompt(opts));
    } catch (err) {
      console.warn("[agent] Report generation failed:", err);
    }
  }

  const gaps = opts.history
    .filter((h) => !h.correct)
    .map((h) => h.gapIfWrong ?? h.conceptTested)
    .filter(Boolean);

  return {
    recap: `You got ${opts.correct} of ${opts.correct + opts.incorrect} questions right on ${opts.title}.`,
    gapsToReview: gaps.length ? gaps : [`Review fundamentals of ${opts.title}`],
    encouragement: "Keep going — spaced practice builds mastery.",
  };
}
