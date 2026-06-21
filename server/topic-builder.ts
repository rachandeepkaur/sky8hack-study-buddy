import type { SkillNode } from "../shared/types.js";
import { generateSkillQuiz } from "./quiz-generator.js";

export function slugTopic(topic: string): string {
  const slug = topic
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug ? `custom:${slug}` : "custom:topic";
}

export function buildTopicNode(topic: string, contextChunks: string[]): SkillNode {
  const id = slugTopic(topic);
  const title = topic.trim();

  const lesson =
    contextChunks.length > 0
      ? contextChunks.map((c) => c.trim()).filter(Boolean)
      : [
          `${title} is the focus of this session. A ${title} system or concept solves a specific problem in software — understanding that problem comes before memorizing APIs or syntax.`,
          `Practitioners working with ${title} typically start with core building blocks, common patterns, and the trade-offs that appear in real projects.`,
          `Pay attention to terms and relationships introduced below — the quiz checks whether you understood the ${title} material, not generic study habits.`,
        ];

  return {
    id,
    title,
    blurb: `A focused intro session on ${title}.`,
    prereqs: [],
    x: 0.5,
    y: 0.5,
    lesson,
    quiz: generateSkillQuiz(title, lesson),
  };
}
