import type { QuizQuestion } from "../shared/types.js";
import { extractKeywords } from "./content-quality.js";

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 30);
}

function pickDistractors(correct: string, pool: string[], count: number): string[] {
  const out: string[] = [];
  for (const item of pool) {
    if (item === correct) continue;
    if (out.includes(item)) continue;
    out.push(item);
    if (out.length >= count) break;
  }
  while (out.length < count) {
    out.push(`None of the above applies to this topic`);
    break;
  }
  return out.slice(0, count);
}

function shuffleWithAnswer<T>(items: T[], correctIndex: number): { items: T[]; answer: number } {
  const tagged = items.map((item, i) => ({ item, isCorrect: i === correctIndex }));
  for (let i = tagged.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tagged[i], tagged[j]] = [tagged[j], tagged[i]];
  }
  return {
    items: tagged.map((t) => t.item),
    answer: tagged.findIndex((t) => t.isCorrect),
  };
}

function factQuestion(title: string, sentence: string, allSentences: string[]): QuizQuestion | null {
  const trimmed = sentence.replace(/\s+/g, " ").trim();
  if (trimmed.length < 40) return null;

  const q = `According to the lesson on ${title}, which statement is accurate?`;
  const distractorPool = allSentences.filter((s) => s !== sentence);
  const distractors = pickDistractors(trimmed, distractorPool, 3);
  const options = [trimmed, ...distractors];
  const { items, answer } = shuffleWithAnswer(options, 0);

  return {
    q,
    options: items.map((o) => (o.length > 120 ? `${o.slice(0, 117)}…` : o)),
    answer,
    explanation: trimmed,
  };
}

function keywordQuestion(title: string, lesson: string[], keywords: string[]): QuizQuestion | null {
  const kw = keywords.find((k) => k.length > 4);
  if (!kw) return null;

  const lessonBlob = lesson.join(" ");
  const sentenceWithKw = sentences(lessonBlob).find((s) => s.toLowerCase().includes(kw));
  if (!sentenceWithKw) return null;

  const q = `In ${title}, what role does "${kw}" play based on the lesson?`;
  const correct = sentenceWithKw.length > 100 ? sentenceWithKw.slice(0, 100) + "…" : sentenceWithKw;
  const distractors = [
    `${kw} is unrelated to ${title} and never appears in practice`,
    `${kw} should be ignored when learning ${title}`,
    `The lesson does not connect ${kw} to any real concept`,
  ];
  const { items, answer } = shuffleWithAnswer([correct, ...distractors], 0);

  return {
    q,
    options: items,
    answer,
    explanation: sentenceWithKw,
  };
}

function conceptQuestion(title: string, lesson: string[]): QuizQuestion | null {
  const sents = sentences(lesson.join(" "));
  const definitional = sents.find((s) => /\b(is|are|means|provides|allows|uses|wraps|manages)\b/i.test(s));
  if (!definitional) return null;

  const q = `Which of the following best describes a core idea in ${title}?`;
  const correct = definitional.length > 110 ? definitional.slice(0, 107) + "…" : definitional;
  const others = sents.filter((s) => s !== definitional).slice(0, 2);
  const distractors = pickDistractors(correct, others, 3);
  const { items, answer } = shuffleWithAnswer([correct, ...distractors], 0);

  return {
    q,
    options: items.map((o) => (o.length > 120 ? `${o.slice(0, 117)}…` : o)),
    answer,
    explanation: definitional,
  };
}

/** Build quiz questions grounded in lesson content — not generic study-habit prompts. */
export function generateSkillQuiz(title: string, lesson: string[]): QuizQuestion[] {
  const allSentences = lesson.flatMap((p) => sentences(p));
  const keywords = extractKeywords(lesson.join(" "), title);
  const questions: QuizQuestion[] = [];
  const seen = new Set<string>();

  const builders = [
    () => conceptQuestion(title, lesson),
    () => keywordQuestion(title, lesson, keywords),
    ...allSentences.slice(0, 2).map((s) => () => factQuestion(title, s, allSentences)),
  ];

  for (const build of builders) {
    const q = build();
    if (!q) continue;
    if (seen.has(q.q)) continue;
    seen.add(q.q);
    questions.push(q);
    if (questions.length >= 3) break;
  }

  if (questions.length < 2 && lesson.length > 0) {
    const fallback = conceptQuestion(title, lesson) ?? keywordQuestion(title, lesson, keywords);
    if (fallback && !seen.has(fallback.q)) questions.push(fallback);
  }

  return questions.slice(0, 3);
}
