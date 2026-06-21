import type { QuizQuestion, SkillNode } from "../shared/types.js";

/** Generic study-habit questions — not skill knowledge. */
const META_QUESTION_PATTERNS = [
  /best first step when learning/i,
  /stick long-term/i,
  /approach helps .+ stick/i,
  /passive reading only/i,
  /memorize every detail before trying/i,
  /avoiding quizzes and self-checks/i,
  /studying once and never revisiting/i,
];

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "must", "shall", "can", "need", "dare",
  "ought", "used", "to", "of", "in", "for", "on", "with", "at", "by",
  "from", "as", "into", "through", "during", "before", "after", "above",
  "below", "between", "under", "again", "further", "then", "once", "here",
  "there", "when", "where", "why", "how", "all", "each", "few", "more",
  "most", "other", "some", "such", "no", "nor", "not", "only", "own",
  "same", "so", "than", "too", "very", "just", "and", "but", "if", "or",
  "because", "until", "while", "this", "that", "these", "those", "it",
  "its", "they", "them", "their", "you", "your", "we", "our", "one", "two",
]);

export function extractKeywords(text: string, title: string): string[] {
  const words = `${title} ${text}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));

  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([w]) => w);
}

export function isMetaLearningQuestion(question: string): boolean {
  return META_QUESTION_PATTERNS.some((p) => p.test(question));
}

export function isSkillKnowledgeQuiz(question: QuizQuestion, node: SkillNode): boolean {
  if (isMetaLearningQuestion(question.q)) return false;

  const lessonText = node.lesson.join(" ").toLowerCase();
  const qText = question.q.toLowerCase();
  const title = node.title.toLowerCase();
  const answer = question.options[question.answer]?.toLowerCase() ?? "";
  const keywords = extractKeywords(lessonText, node.title);

  const mentionsTopic = qText.includes(title) || lessonText.includes(title);
  const answerInLesson =
    answer.length > 0 &&
    (lessonText.includes(answer) ||
      keywords.some((kw) => answer.includes(kw) && lessonText.includes(kw)));

  const questionUsesLessonTerms = keywords.some(
    (kw) => qText.includes(kw) || answer.includes(kw),
  );

  // Built-in catalog nodes: question or answer should tie to lesson vocabulary
  return mentionsTopic || answerInLesson || questionUsesLessonTerms;
}

export function validateNodeContent(node: SkillNode): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!node.title?.trim()) errors.push("missing title");
  if (!node.lesson?.length) errors.push("missing lesson paragraphs");
  if (!node.quiz?.length) errors.push("missing quiz questions");

  for (const p of node.lesson) {
    if (p.length < 40) errors.push(`lesson paragraph too short: "${p.slice(0, 30)}…"`);
  }

  const lessonBlob = node.lesson.join(" ").toLowerCase();
  if (!lessonBlob.includes(node.title.toLowerCase().split(/\s+/)[0])) {
    // At least first word of title or a keyword should appear
    const kw = extractKeywords(lessonBlob, node.title);
    if (kw.length === 0) errors.push("lesson does not mention topic keywords");
  }

  for (const [i, q] of node.quiz.entries()) {
    if (q.options.length < 2) errors.push(`quiz ${i}: needs at least 2 options`);
    if (q.answer < 0 || q.answer >= q.options.length) errors.push(`quiz ${i}: invalid answer index`);
    if (!q.explanation?.trim()) errors.push(`quiz ${i}: missing explanation`);
    if (!isSkillKnowledgeQuiz(q, node)) {
      errors.push(`quiz ${i}: not skill-knowledge focused — "${q.q}"`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function validateSkillCatalog(skills: { id: string; name: string; nodes: SkillNode[] }[]): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  for (const skill of skills) {
    for (const node of skill.nodes) {
      const result = validateNodeContent(node);
      if (!result.ok) {
        errors.push(`${skill.id}/${node.id}: ${result.errors.join("; ")}`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}
