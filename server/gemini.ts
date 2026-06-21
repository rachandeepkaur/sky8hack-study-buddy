import "./env.js";
import { z } from "zod";
import type { QuizDifficulty, QuizQuestion, SkillNode } from "../shared/types.js";

const QuizSchema = z.object({
  q: z.string().min(10),
  options: z.array(z.string().min(1)).min(2).max(6),
  answer: z.number().int().min(0),
  explanation: z.string().min(5),
});

const AdaptiveQuizSchema = QuizSchema.extend({
  difficulty: z.enum(["basic", "intermediate", "hard"]),
  conceptTested: z.string().min(2),
});

const LessonOnlySchema = z.object({
  title: z.string().min(1),
  blurb: z.string().min(5),
  lesson: z.array(z.string().min(20)).min(2).max(6),
});

const SessionReportSchema = z.object({
  recap: z.string().min(20),
  gapsToReview: z.array(z.string().min(3)).min(1).max(8),
  encouragement: z.string().min(10),
});

export type GeneratedLesson = z.infer<typeof LessonOnlySchema>;
export type SessionReport = z.infer<typeof SessionReportSchema>;

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

function getApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY;
}

export function isGeminiConfigured(): boolean {
  return Boolean(getApiKey());
}

async function callGeminiJson<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("Gemini returned empty response");

  return schema.parse(JSON.parse(raw));
}

export async function generateLessonWithGemini(prompt: string): Promise<GeneratedLesson> {
  return callGeminiJson(prompt, LessonOnlySchema);
}

export async function generateAdaptiveQuestionWithGemini(
  prompt: string,
): Promise<z.infer<typeof AdaptiveQuizSchema>> {
  const q = await callGeminiJson(prompt, AdaptiveQuizSchema);
  if (q.answer >= q.options.length) {
    throw new Error(`Quiz answer index out of range: ${q.q}`);
  }
  return q;
}

export async function generateSessionReportWithGemini(
  prompt: string,
): Promise<SessionReport> {
  return callGeminiJson(prompt, SessionReportSchema);
}

export function toSkillNode(
  id: string,
  generated: GeneratedLesson,
  prereqs: string[] = [],
): SkillNode {
  return {
    id,
    title: generated.title,
    blurb: generated.blurb,
    prereqs,
    x: 0.5,
    y: 0.5,
    lesson: generated.lesson,
    quiz: [],
  };
}

export type { QuizQuestion };
