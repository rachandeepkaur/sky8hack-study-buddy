import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toSkillNode } from "./gemini.js";

vi.mock("./hydra.js", () => ({
  loadLoopState: vi.fn(async () => ({
    mastery: { configmaps: "shaky" },
    notes: { configmaps: ["on Sunday"] },
    activeSkillId: "kubernetes",
    xp: 120,
    streak: 2,
    memoryDepth: 0.3,
    sessions: [{ recap: "Worked through ConfigMaps." }],
    customTopic: null,
  })),
  queryTopicContext: vi.fn(async () => [
    "React hooks include useState for state and useEffect for side effects.",
  ]),
  ingestLearnerMemory: vi.fn(async () => {}),
}));

const mockLessonResponse = {
  title: "React Hooks",
  blurb: "State and effects in functional components.",
  lesson: [
    "React hooks let functional components use state via useState and side effects via useEffect.",
    "The rules of hooks require calling them only at the top level of a component.",
    "Custom hooks extract reusable stateful logic shared across components.",
  ],
};

describe("generatePersonalizedContent", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify(mockLessonResponse) }] } }],
        }),
      })),
    );
    process.env.GEMINI_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    delete process.env.GEMINI_API_KEY;
  });

  it("uses Gemini to produce skill-specific lesson without upfront quiz", async () => {
    const { generatePersonalizedContent } = await import("./agent.js");

    const node = await generatePersonalizedContent({
      topic: "React Hooks",
      subTenantId: "test-user",
    });

    expect(node.title).toBe("React Hooks");
    expect(node.lesson.length).toBeGreaterThanOrEqual(3);
    expect(node.quiz).toEqual([]);
  });

  it("falls back to template when Gemini fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, text: async () => "error" })),
    );

    const { generatePersonalizedContent } = await import("./agent.js");

    const node = await generatePersonalizedContent({
      topic: "Rust",
      subTenantId: "test-user",
    });

    expect(node.title).toBe("Rust");
    expect(node.lesson.length).toBeGreaterThan(0);
  });
});

describe("toSkillNode", () => {
  it("maps generated JSON to SkillNode shape with empty quiz", () => {
    const node = toSkillNode("custom:react", mockLessonResponse);
    expect(node.id).toBe("custom:react");
    expect(node.quiz).toEqual([]);
    expect(node.lesson.length).toBe(3);
  });
});

describe("generateNextQuestion", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    delete process.env.GEMINI_API_KEY;
  });

  it("generates one adaptive question via Gemini", async () => {
    const mockQuestion = {
      q: "Which hook manages state?",
      options: ["useContext", "useState", "useRef", "useMemo"],
      answer: 1,
      explanation: "useState manages local state.",
      difficulty: "basic",
      conceptTested: "useState",
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify(mockQuestion) }] } }],
        }),
      })),
    );

    const { generateNextQuestion } = await import("./agent.js");

    const q = await generateNextQuestion({
      subTenantId: "test-user",
      nodeId: "custom:react",
      title: "React Hooks",
      lesson: mockLessonResponse.lesson,
      difficulty: "basic",
      history: [],
      recovery: false,
    });

    expect(q.q).toMatch(/hook/i);
    expect(q.difficulty).toBe("basic");
    expect(q.conceptTested).toBeTruthy();
  });
});
