import type {
  AdaptiveQuizQuestion,
  QuizAnswerRecord,
  QuizDifficulty,
} from "../../shared/types";
import { getUserId } from "./memory";

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Loop-User": getUserId(),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchNextQuestion(opts: {
  nodeId: string;
  difficulty: QuizDifficulty;
  history: QuizAnswerRecord[];
}): Promise<{ question: AdaptiveQuizQuestion; difficulty: QuizDifficulty }> {
  return apiPost("/api/quiz/next", opts);
}

export async function fetchSessionReport(opts: {
  title: string;
  history: QuizAnswerRecord[];
  correct: number;
  incorrect: number;
}): Promise<{ recap: string; gapsToReview: string[]; encouragement: string }> {
  return apiPost("/api/quiz/report", opts);
}
