import { describe, it, expect, beforeEach } from "vitest";
import { SKILLS } from "./content-data.js";
import { registerNode } from "../src/lib/content-api.js";
import {
  startSession,
  answerQuestion,
  getState,
  resetAll,
  _setLiveSessionForTest,
  _adjustDifficultyForTest,
} from "../src/lib/loop-store.js";
import { adjustDifficulty, initialDifficulty } from "./agent.js";
import type { AdaptiveQuizQuestion, QuizAnswerRecord } from "../shared/types.js";

function seedCatalog() {
  for (const skill of SKILLS) {
    for (const node of skill.nodes) registerNode(node);
  }
}

const sampleQuestion: AdaptiveQuizQuestion = {
  q: "What is a Pod?",
  options: ["A container", "Smallest deployable unit", "A node", "A cluster"],
  answer: 1,
  explanation: "Pods are the smallest deployable units in Kubernetes.",
  difficulty: "basic",
  conceptTested: "Pod definition",
};

describe("adaptive difficulty", () => {
  it("starts basic for unseen mastery", () => {
    expect(initialDifficulty("unseen")).toBe("basic");
    expect(initialDifficulty("shaky")).toBe("basic");
  });

  it("ramps up after correct streak", () => {
    const history: QuizAnswerRecord[] = [
      { nodeId: "pods", question: "q1", picked: "a", correctAnswer: "a", correct: true, difficulty: "basic", conceptTested: "c1" },
      { nodeId: "pods", question: "q2", picked: "b", correctAnswer: "b", correct: true, difficulty: "basic", conceptTested: "c2" },
    ];
    expect(adjustDifficulty("basic", history)).toBe("intermediate");
    expect(adjustDifficulty("intermediate", [...history, { nodeId: "pods", question: "q3", picked: "c", correctAnswer: "c", correct: true, difficulty: "intermediate", conceptTested: "c3" }])).toBe("hard");
  });

  it("drops difficulty after misses", () => {
    const history: QuizAnswerRecord[] = [
      { nodeId: "pods", question: "q1", picked: "a", correctAnswer: "b", correct: false, difficulty: "hard", conceptTested: "c1" },
      { nodeId: "pods", question: "q2", picked: "a", correctAnswer: "b", correct: false, difficulty: "hard", conceptTested: "c2" },
    ];
    expect(adjustDifficulty("hard", history)).toBe("intermediate");
  });
});

describe("adaptive quiz session", () => {
  beforeEach(() => {
    resetAll();
    seedCatalog();
    startSession(["pods"]);
    _setLiveSessionForTest({
      ...getState().liveSession!,
      currentQuestion: sampleQuestion,
    });
  });

  it("records answer and clears current question", () => {
    answerQuestion(1);
    const live = getState().liveSession!;
    expect(live.correct).toBe(1);
    expect(live.currentQuestion).toBeNull();
    expect(live.history).toHaveLength(1);
    expect(live.history[0].conceptTested).toBe("Pod definition");
  });

  it("adjusts difficulty in store after performance", () => {
    _setLiveSessionForTest({
      ...getState().liveSession!,
      currentQuestion: sampleQuestion,
      history: [
        { nodeId: "pods", question: "q1", picked: "a", correctAnswer: "a", correct: true, difficulty: "basic", conceptTested: "c1" },
        { nodeId: "pods", question: "q2", picked: "b", correctAnswer: "b", correct: true, difficulty: "basic", conceptTested: "c2" },
      ],
      difficulty: "basic",
    });
    answerQuestion(1);
    expect(getState().liveSession!.difficulty).toBe("intermediate");
  });

  it("marks shaky mastery on wrong answer", () => {
    answerQuestion(0);
    expect(getState().mastery.pods).toBe("shaky");
    expect(getState().liveSession!.incorrect).toBe(1);
  });

  it("client adjustDifficulty matches server", () => {
    const history: QuizAnswerRecord[] = [
      { nodeId: "pods", question: "q", picked: "x", correctAnswer: "y", correct: false, difficulty: "intermediate", conceptTested: "c" },
    ];
    expect(_adjustDifficultyForTest("intermediate", history)).toBe(adjustDifficulty("intermediate", history));
  });
});
