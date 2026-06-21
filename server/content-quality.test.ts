import { describe, it, expect } from "vitest";
import { SKILLS, getSkill, nodeById } from "./content-data.js";
import {
  isMetaLearningQuestion,
  isSkillKnowledgeQuiz,
  validateNodeContent,
  validateSkillCatalog,
} from "./content-quality.js";

describe("built-in skill catalog", () => {
  it("includes Kubernetes and System Design with nodes", () => {
    expect(SKILLS.map((s) => s.id)).toEqual(["kubernetes", "system-design"]);
    expect(getSkill("kubernetes").nodes.length).toBeGreaterThanOrEqual(8);
    expect(getSkill("system-design").nodes.length).toBeGreaterThanOrEqual(5);
  });

  it("every catalog node passes content + quiz quality checks", () => {
    const result = validateSkillCatalog(SKILLS);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("Pods node lesson and quiz are about Kubernetes Pods", () => {
    const pods = nodeById("pods")!;
    expect(pods.title).toBe("Pods");
    expect(pods.lesson.join(" ")).toMatch(/Pod/i);
    expect(pods.quiz[0].q).toMatch(/smallest deployable unit/i);
    expect(pods.quiz[0].options[pods.quiz[0].answer]).toMatch(/Pod/i);
  });

  it("CAP Theorem quiz tests distributed systems knowledge", () => {
    const cap = nodeById("cap-theorem")!;
    expect(cap.quiz[0].q).toMatch(/partition/i);
    expect(cap.quiz[0].options[cap.quiz[0].answer]).toMatch(/Consistency and Availability/i);
    expect(isMetaLearningQuestion(cap.quiz[0].q)).toBe(false);
  });
});

describe("isSkillKnowledgeQuiz", () => {
  it("rejects generic meta-learning questions", () => {
    const node = nodeById("pods")!;
    const meta = {
      q: "What is the best first step when learning Pods?",
      options: ["Memorize", "Understand the problem", "Skip basics", "Read only"],
      answer: 1,
      explanation: "Generic",
    };
    expect(isMetaLearningQuestion(meta.q)).toBe(true);
    expect(isSkillKnowledgeQuiz(meta, node)).toBe(false);
  });

  it("accepts questions tied to lesson content", () => {
    const node = nodeById("services")!;
    for (const q of node.quiz) {
      expect(isSkillKnowledgeQuiz(q, node)).toBe(true);
    }
  });
});

describe("validateNodeContent", () => {
  it("flags nodes with empty lesson or meta-only quizzes", () => {
    const bad = {
      id: "bad",
      title: "React",
      blurb: "test",
      prereqs: [],
      x: 0.5,
      y: 0.5,
      lesson: ["React is cool."],
      quiz: [
        {
          q: "What is the best first step when learning React?",
          options: ["A", "B", "C", "D"],
          answer: 1,
          explanation: "habit",
        },
      ],
    };
    const result = validateNodeContent(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("not skill-knowledge"))).toBe(true);
  });
});
