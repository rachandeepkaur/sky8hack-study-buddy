import { describe, it, expect } from "vitest";
import { buildTopicNode, slugTopic } from "./topic-builder.js";
import { validateNodeContent } from "./content-quality.js";
import { isMetaLearningQuestion } from "./content-quality.js";

describe("buildTopicNode", () => {
  it("slugifies topic into custom node id", () => {
    expect(slugTopic("React Hooks")).toBe("custom:react-hooks");
  });

  it("uses Hydra context chunks as lesson when provided", () => {
    const chunks = [
      "GraphQL is a query language for APIs. Clients request exactly the fields they need.",
      "A GraphQL schema defines types, queries, and mutations on a single endpoint.",
    ];
    const node = buildTopicNode("GraphQL", chunks);
    expect(node.title).toBe("GraphQL");
    expect(node.lesson).toEqual(chunks);
    expect(node.lesson.join(" ")).toMatch(/GraphQL/i);
  });

  it("falls back to topic-specific lesson when no chunks", () => {
    const node = buildTopicNode("Rust", []);
    expect(node.lesson.join(" ")).toMatch(/Rust/i);
    expect(node.lesson.some((p) => p.length > 50)).toBe(true);
  });

  it("generates skill-knowledge quizzes, not meta-learning prompts", () => {
    const node = buildTopicNode("TypeScript", [
      "TypeScript adds static types to JavaScript. Types catch errors at compile time before runtime.",
      "Interfaces and type aliases describe object shapes used across a codebase.",
    ]);
    expect(node.quiz.length).toBeGreaterThanOrEqual(2);
    for (const q of node.quiz) {
      expect(isMetaLearningQuestion(q.q)).toBe(false);
    }
    const validation = validateNodeContent(node);
    expect(validation.ok).toBe(true);
  });

  it("quiz checks TypeScript material from the lesson", () => {
    const node = buildTopicNode("TypeScript", [
      "TypeScript adds static types to JavaScript. Types catch errors at compile time.",
      "Generics let functions and classes work with multiple types while staying type-safe.",
    ]);
    const combined = node.quiz.map((q) => q.q + q.options[q.answer]).join(" ");
    expect(combined).toMatch(/TypeScript|type|JavaScript|Generics/i);
  });
});
