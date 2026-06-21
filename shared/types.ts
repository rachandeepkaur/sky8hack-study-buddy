export type Mastery = "unseen" | "intro" | "practiced" | "shaky" | "mastered";

export type QuizDifficulty = "basic" | "intermediate" | "hard";

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface AdaptiveQuizQuestion extends QuizQuestion {
  difficulty: QuizDifficulty;
  conceptTested: string;
}

export interface QuizAnswerRecord {
  nodeId: string;
  question: string;
  picked: string;
  correctAnswer: string;
  correct: boolean;
  difficulty: QuizDifficulty;
  conceptTested: string;
  gapIfWrong?: string;
}

export interface SkillNode {
  id: string;
  title: string;
  blurb: string;
  prereqs: string[];
  x: number;
  y: number;
  lesson: string[];
  quiz: QuizQuestion[];
}

export interface Skill {
  id: string;
  name: string;
  nodes: SkillNode[];
}

export interface SessionRecord {
  date: string;
  nodeIds: string[];
  xp: number;
  before: Record<string, Mastery>;
  after: Record<string, Mastery>;
  recap: string;
  learningReport?: string;
  gapsToReview?: string[];
}

export interface LiveSession {
  nodeIds: string[];
  activeNodeIndex: number;
  questionsThisNode: number;
  maxQuestionsPerNode: number;
  difficulty: QuizDifficulty;
  currentQuestion: AdaptiveQuizQuestion | null;
  history: QuizAnswerRecord[];
  correct: number;
  incorrect: number;
  xpEarned: number;
  before: Record<string, Mastery>;
  recovery: boolean;
  complete: boolean;
  learningReport: string | null;
  gapsToReview: string[];
}

export interface LoopState {
  mastery: Record<string, Mastery>;
  xp: number;
  streak: number;
  lastSessionDate: string | null;
  memoryDepth: number;
  sessions: SessionRecord[];
  notes: Record<string, string[]>;
  activeSkillId: string;
  customTopic: string | null;
  customNodes: Record<string, SkillNode>;
  plan: string[] | null;
  liveSession: LiveSession | null;
}
