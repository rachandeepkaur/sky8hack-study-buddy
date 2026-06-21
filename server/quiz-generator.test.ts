import { describe, it, expect } from "vitest";
import { generateSkillQuiz } from "./quiz-generator.js";
import { isMetaLearningQuestion, isSkillKnowledgeQuiz } from "./content-quality.js";
import type { SkillNode } from "../shared/types.js";

const REACT_LESSON = [
  "React is a JavaScript library for building user interfaces with components. Components are reusable functions or classes that return JSX describing UI.",
  "State in React lets a component remember data between renders. When state changes via setState or useState updaters, React re-renders the component tree.",
  "Props pass data from parent to child components. Unidirectional data flow makes React apps easier to reason about than two-way binding in older frameworks.",
];

describe("generateSkillQuiz", () => {
  it("creates at least 2 questions from lesson content", () => {
    const quiz = generateSkillQuiz("React", REACT_LESSON);
    expect(quiz.length).toBeGreaterThanOrEqual(2);
  });

  it("does not produce generic study-habit questions", () => {
    const quiz = generateSkillQuiz("React", REACT_LESSON);
    for (const q of quiz) {
      expect(isMetaLearningQuestion(q.q)).toBe(false);
    }
  });

  it("questions reference the topic or lesson terms", () => {
    const quiz = generateSkillQuiz("React", REACT_LESSON);
    const node: SkillNode = {
      id: "custom:react",
      title: "React",
      blurb: "UI library",
      prereqs: [],
      x: 0.5,
      y: 0.5,
      lesson: REACT_LESSON,
      quiz,
    };
    for (const q of quiz) {
      expect(isSkillKnowledgeQuiz(q, node)).toBe(true);
    }
  });

  it("correct answers are grounded in lesson text", () => {
    const quiz = generateSkillQuiz("React", REACT_LESSON);
    const lessonBlob = REACT_LESSON.join(" ").toLowerCase();
    for (const q of quiz) {
      const answer = q.options[q.answer].toLowerCase();
      const overlap =
        lessonBlob.includes(answer.slice(0, 30)) ||
        ["react", "component", "state", "props", "jsx"].some(
          (term) => answer.includes(term) && lessonBlob.includes(term),
        );
      expect(overlap).toBe(true);
    }
  });
});

describe("generateSkillQuiz with Hydra-style chunks", () => {
  const K8S_CHUNKS = [
    "A Pod is the smallest unit you can schedule in Kubernetes. It wraps one or more containers that share the same network namespace.",
    "Services provide stable network endpoints for Pods using label selectors.",
  ];

  it("builds quiz from retrieved context chunks", () => {
    const quiz = generateSkillQuiz("Kubernetes", K8S_CHUNKS);
    expect(quiz.length).toBeGreaterThanOrEqual(2);
    expect(quiz.some((q) => /Pod|Service|Kubernetes/i.test(q.q + q.options.join(" ")))).toBe(true);
  });
});
