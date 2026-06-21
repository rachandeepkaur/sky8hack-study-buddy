import { useRef, useSyncExternalStore } from "react";
import { fetchState, persistState } from "./memory";
import {
  getAllNodes,
  getSkills,
  nodeById,
  registerNode,
  generateTopicNode,
} from "./content-api";
import { fetchNextQuestion, fetchSessionReport } from "./quiz-api";
import type {
  AdaptiveQuizQuestion,
  Mastery,
  SkillNode,
  LoopState,
  SessionRecord,
  QuizAnswerRecord,
  QuizDifficulty,
} from "../../shared/types";

export type { SessionRecord, LoopState };

const QUESTIONS_PER_NODE = 4;

const SEEDED_MASTERY: Record<string, Mastery> = {
  pods: "mastered",
  services: "mastered",
  configmaps: "shaky",
  deployments: "intro",
};

function buildInitialState(nodeIds: string[]): LoopState {
  const mastery: Record<string, Mastery> = {};
  for (const id of nodeIds) mastery[id] = SEEDED_MASTERY[id] ?? "unseen";
  const today = new Date().toLocaleDateString(undefined, { weekday: "long" });
  return {
    mastery,
    xp: 120,
    streak: 1,
    lastSessionDate: null,
    memoryDepth: 0.18,
    sessions: [],
    notes: { configmaps: [`on ${today}`] },
    activeSkillId: "kubernetes",
    customTopic: null,
    customNodes: {},
    plan: null,
    liveSession: null,
  };
}

let state: LoopState = buildInitialState([]);
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

const listeners = new Set<() => void>();

function emit() {
  if (typeof window !== "undefined" && hydrated) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      persistState(state).catch(() => {});
    }, 400);
  }
  for (const l of listeners) l();
}

function set(updater: (s: LoopState) => LoopState) {
  state = updater(state);
  emit();
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
};

export function useLoopState<T>(selector: (s: LoopState) => T): T {
  const ref = useRef<{ state: LoopState; value: T } | null>(null);
  const get = () => {
    if (ref.current && ref.current.state === state) return ref.current.value;
    const value = selector(state);
    ref.current = { state, value };
    return value;
  };
  return useSyncExternalStore(subscribe, get, get);
}

export function getState() { return state; }
export function isHydrated() { return hydrated; }

export async function hydrateStore(): Promise<void> {
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    const remote = await fetchState();
    const nodeIds = getAllNodes().map((n) => n.id);
    const base = buildInitialState(nodeIds.length ? nodeIds : Object.keys(SEEDED_MASTERY));
    if (remote) {
      state = {
        ...base,
        ...remote,
        mastery: { ...base.mastery, ...remote.mastery },
        customNodes: { ...base.customNodes, ...remote.customNodes },
      };
      for (const node of Object.values(state.customNodes)) registerNode(node);
    } else {
      state = base;
    }
    hydrated = true;
    for (const l of listeners) l();
  })();
  return hydratePromise;
}

export function isUnlocked(node: SkillNode, mastery: Record<string, Mastery>) {
  return node.prereqs.every((p) => {
    const m = mastery[p];
    return m === "practiced" || m === "mastered" || m === "shaky" || m === "intro";
  });
}

export function setActiveSkill(skillId: string) {
  if (!getSkills().some((sk) => sk.id === skillId)) return;
  set((s) => ({ ...s, activeSkillId: skillId, plan: null }));
}

export function resolveNode(id: string): SkillNode | undefined {
  return nodeById(id) ?? state.customNodes[id];
}

export async function ensureCustomNode(topic: string): Promise<SkillNode> {
  const existing = Object.values(state.customNodes).find(
    (n) => n.title.toLowerCase() === topic.trim().toLowerCase(),
  );
  if (existing) return existing;

  const node = await generateTopicNode(topic);
  set((s) => ({
    ...s,
    customNodes: { ...s.customNodes, [node.id]: node },
    mastery: { ...s.mastery, [node.id]: s.mastery[node.id] ?? "unseen" },
  }));
  return node;
}

export async function startCustomTopicSession(topic: string): Promise<string> {
  const node = await ensureCustomNode(topic);
  set((s) => ({ ...s, customTopic: topic.trim(), plan: null }));
  startSession([node.id]);
  return node.id;
}

export function pickSession(s: LoopState): { ids: string[]; reason: string } {
  const skillNodes = getSkills().find((sk) => sk.id === s.activeSkillId)?.nodes ?? getAllNodes();
  const unlocked = skillNodes.filter((n) => isUnlocked(n, s.mastery));
  const shaky = unlocked.filter((n) => s.mastery[n.id] === "shaky");
  const practiced = unlocked.filter((n) => s.mastery[n.id] === "practiced");
  const intro = unlocked.filter((n) => s.mastery[n.id] === "intro");
  const fresh = unlocked.filter((n) => s.mastery[n.id] === "unseen");

  const picks: SkillNode[] = [];
  if (shaky.length) picks.push(shaky[0]);
  if (practiced.length && picks.length < 3) picks.push(practiced[0]);
  if (intro.length && picks.length < 3) picks.push(intro[0]);
  while (picks.length < 3 && fresh.length) {
    const next = fresh.shift();
    if (next && !picks.find((p) => p.id === next.id)) picks.push(next);
  }
  if (picks.length === 0) picks.push(unlocked[0] ?? skillNodes[0] ?? getAllNodes()[0]);

  let reason = "";
  if (shaky.length) {
    const note = (s.notes[shaky[0].id] ?? [])[0];
    reason = `Picking ${shaky[0].title} because you stumbled on it ${note ?? "in your last session"}.`;
  } else if (s.sessions.length === 0) {
    reason = `Starting with foundations — ${picks[0].title} is the entry point.`;
  } else {
    reason = `Building on ${picks[0].title} to extend what you've practiced.`;
  }
  return { ids: picks.slice(0, 3).map((p) => p.id), reason };
}

export function timeSinceLast(s: LoopState): string {
  if (!s.lastSessionDate) return "Welcome to Loop.";
  const last = new Date(s.lastSessionDate);
  const days = Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Welcome back. Picking up where you left off.";
  if (days === 1) return "Welcome back. It's been 1 day.";
  return `Welcome back. It's been ${days} days.`;
}

export function ensurePlan() {
  if (state.plan && state.plan.length) return state.plan;
  const { ids } = pickSession(state);
  set((s) => ({ ...s, plan: ids }));
  return ids;
}

function initialDifficultyFor(mastery: Mastery): QuizDifficulty {
  if (mastery === "mastered") return "hard";
  if (mastery === "practiced") return "intermediate";
  return "basic";
}

export function startSession(nodeIds: string[]) {
  const before: Record<string, Mastery> = {};
  for (const id of nodeIds) before[id] = state.mastery[id] ?? "unseen";

  const firstId = nodeIds[0];
  const mastery = before[firstId] ?? "unseen";
  const recovery = mastery === "shaky";

  set((s) => ({
    ...s,
    liveSession: {
      nodeIds,
      activeNodeIndex: 0,
      questionsThisNode: 0,
      maxQuestionsPerNode: QUESTIONS_PER_NODE,
      difficulty: initialDifficultyFor(mastery),
      currentQuestion: null,
      history: [],
      correct: 0,
      incorrect: 0,
      xpEarned: 0,
      before,
      recovery,
      complete: false,
      learningReport: null,
      gapsToReview: [],
    },
  }));
}

export function getActiveNodeId(): string | null {
  const live = state.liveSession;
  if (!live) return null;
  return live.nodeIds[live.activeNodeIndex] ?? null;
}

export function setCurrentQuestion(question: AdaptiveQuizQuestion, difficulty: QuizDifficulty) {
  set((s) => ({
    ...s,
    liveSession: s.liveSession
      ? { ...s.liveSession, currentQuestion: question, difficulty }
      : null,
  }));
}

export async function loadNextQuestion(): Promise<AdaptiveQuizQuestion | null> {
  const live = state.liveSession;
  if (!live || live.complete) return null;

  const nodeId = live.nodeIds[live.activeNodeIndex];
  const node = resolveNode(nodeId);
  if (!node) return null;

  const { question, difficulty } = await fetchNextQuestion({
    nodeId,
    difficulty: live.difficulty,
    history: live.history,
  });

  setCurrentQuestion(question, difficulty);
  return question;
}

const ADVANCE: Record<Mastery, Mastery> = {
  unseen: "intro",
  intro: "practiced",
  practiced: "mastered",
  shaky: "practiced",
  mastered: "mastered",
};

function adjustDifficulty(current: QuizDifficulty, history: QuizAnswerRecord[]): QuizDifficulty {
  const recent = history.slice(-3);
  if (recent.length === 0) return current;
  const rate = recent.filter((h) => h.correct).length / recent.length;

  if (rate >= 0.67) {
    if (current === "basic") return "intermediate";
    if (current === "intermediate") return "hard";
    return "hard";
  }
  if (rate <= 0.34) {
    if (current === "hard") return "intermediate";
    if (current === "intermediate") return "basic";
    return "basic";
  }
  return current;
}

export function answerQuestion(
  pickedIndex: number,
): { xp: number; recovery: boolean; newMastery?: Mastery; correct: boolean } {
  const live = state.liveSession;
  if (!live?.currentQuestion) return { xp: 0, recovery: false, correct: false };

  const q = live.currentQuestion;
  const nodeId = live.nodeIds[live.activeNodeIndex];
  const correct = pickedIndex === q.answer;
  const recovery = live.recovery && correct;
  let xp = 0;
  let newMastery: Mastery | undefined;
  if (correct) xp = recovery ? 20 : 10;

  const record: QuizAnswerRecord = {
    nodeId,
    question: q.q,
    picked: q.options[pickedIndex] ?? "",
    correctAnswer: q.options[q.answer] ?? "",
    correct,
    difficulty: q.difficulty,
    conceptTested: q.conceptTested,
    gapIfWrong: correct ? undefined : q.conceptTested,
  };

  const newHistory = [...live.history, record];
  const newDifficulty = adjustDifficulty(live.difficulty, newHistory);
  const questionsThisNode = live.questionsThisNode + 1;
  const nodeComplete = questionsThisNode >= live.maxQuestionsPerNode;
  const allNodesComplete = nodeComplete && live.activeNodeIndex >= live.nodeIds.length - 1;

  set((s) => {
    const ls = s.liveSession!;
    let mastery = s.mastery;
    let notes = s.notes;

    if (!correct) {
      mastery = { ...mastery, [nodeId]: "shaky" };
      const today = new Date().toLocaleDateString(undefined, { weekday: "long" });
      const existing = notes[nodeId] ?? [];
      notes = { ...notes, [nodeId]: [`on ${today}`, ...existing].slice(0, 4) };
    } else if (nodeComplete) {
      const previous = s.mastery[nodeId] ?? "unseen";
      const next = ADVANCE[previous];
      mastery = { ...mastery, [nodeId]: next };
      newMastery = next;
    }

    let activeNodeIndex = ls.activeNodeIndex;
    let nextQuestionsThisNode = questionsThisNode;
    let nextDifficulty = newDifficulty;
    let nextRecovery = ls.recovery;

    if (nodeComplete && !allNodesComplete) {
      activeNodeIndex += 1;
      nextQuestionsThisNode = 0;
      const nextNodeId = ls.nodeIds[activeNodeIndex];
      const nextMastery = mastery[nextNodeId] ?? "unseen";
      nextDifficulty = initialDifficultyFor(nextMastery);
      nextRecovery = nextMastery === "shaky";
    }

    return {
      ...s,
      liveSession: {
        ...ls,
        history: newHistory,
        questionsThisNode: nextQuestionsThisNode,
        activeNodeIndex,
        difficulty: nextDifficulty,
        recovery: nextRecovery,
        currentQuestion: null,
        correct: ls.correct + (correct ? 1 : 0),
        incorrect: ls.incorrect + (correct ? 0 : 1),
        xpEarned: ls.xpEarned + xp,
        complete: allNodesComplete,
      },
      mastery,
      notes,
    };
  });

  return { xp, recovery, newMastery, correct };
}

export function totalQuestionsInSession(): number {
  const live = state.liveSession;
  if (!live) return 0;
  return live.nodeIds.length * live.maxQuestionsPerNode;
}

export function questionsAnsweredSoFar(): number {
  const live = state.liveSession;
  if (!live) return 0;
  return live.history.length;
}

export async function finalizeSessionReport(): Promise<void> {
  const live = state.liveSession;
  if (!live) return;

  const titles = live.nodeIds
    .map((id) => resolveNode(id)?.title)
    .filter(Boolean)
    .join(", ");

  try {
    const report = await fetchSessionReport({
      title: titles || "Session",
      history: live.history,
      correct: live.correct,
      incorrect: live.incorrect,
    });
    set((s) => ({
      ...s,
      liveSession: s.liveSession
        ? {
            ...s.liveSession,
            learningReport: `${report.recap} ${report.encouragement}`,
            gapsToReview: report.gapsToReview,
          }
        : null,
    }));
  } catch {
    const gaps = live.history
      .filter((h) => !h.correct)
      .map((h) => h.gapIfWrong ?? h.conceptTested);
    set((s) => ({
      ...s,
      liveSession: s.liveSession
        ? {
            ...s.liveSession,
            learningReport: `You answered ${live.correct} correctly and missed ${live.incorrect}.`,
            gapsToReview: gaps.length ? gaps : ["Review the lesson material"],
          }
        : null,
    }));
  }
}

export function endSession(): SessionRecord | null {
  const live = state.liveSession;
  if (!live) return null;
  const after: Record<string, Mastery> = {};
  for (const id of live.nodeIds) after[id] = state.mastery[id];

  const sentences: string[] = [];
  for (const id of live.nodeIds) {
    const node = resolveNode(id);
    if (!node) continue;
    const b = live.before[id], a = after[id];
    if (b !== a) sentences.push(`We worked through ${node.title}, and you moved from ${b} to ${a}.`);
    else if (a === "shaky") sentences.push(`${node.title} is still a little shaky — I'll bring it back next time.`);
    else sentences.push(`${node.title} held steady at ${a}.`);
  }

  const recap =
    live.learningReport ??
    (sentences.join(" ") +
      (live.incorrect === 0 && live.correct > 0
        ? " A clean run. I'll push the difficulty next session."
        : ""));

  const session: SessionRecord = {
    date: new Date().toISOString(),
    nodeIds: live.nodeIds,
    xp: live.xpEarned,
    before: live.before,
    after,
    recap,
    learningReport: live.learningReport ?? undefined,
    gapsToReview: live.gapsToReview.length ? live.gapsToReview : undefined,
  };

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const last = state.lastSessionDate ? new Date(state.lastSessionDate) : null;
  if (last) last.setHours(0, 0, 0, 0);
  let streak = state.streak;
  if (!last) streak = 1;
  else {
    const diffDays = Math.round((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) streak = Math.max(1, streak);
    else if (diffDays === 1) streak += 1;
    else streak = 1;
  }

  const noteCount = Object.values(state.notes).reduce((a, b) => a + b.length, 0);
  const newDepth = Math.min(1, (state.sessions.length + 1) * 0.08 + noteCount * 0.04);

  set((s) => ({
    ...s,
    xp: s.xp + live.xpEarned,
    streak,
    lastSessionDate: new Date().toISOString(),
    memoryDepth: newDepth,
    sessions: [session, ...s.sessions].slice(0, 30),
    plan: null,
    liveSession: null,
  }));
  return session;
}

export function resetAll() {
  state = buildInitialState(getAllNodes().map((n) => n.id));
  hydrated = true;
  emit();
}

// Test helpers
export function _setLiveSessionForTest(session: LoopState["liveSession"]) {
  state = { ...state, liveSession: session };
}

export function _adjustDifficultyForTest(
  current: QuizDifficulty,
  history: QuizAnswerRecord[],
): QuizDifficulty {
  return adjustDifficulty(current, history);
}
