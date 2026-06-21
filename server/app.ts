import "./env.js";
import cors from "cors";
import express from "express";
import {
  adjustDifficulty,
  generateLearningReport,
  generateNextQuestion,
  generatePersonalizedContent,
  initialDifficulty,
} from "./agent.js";
import { SKILLS, NODES, getSkill, nodeById } from "./content-data.js";
import {
  cacheCustomNode,
  getCachedCustomNode,
  ingestCustomNode,
  loadLoopState,
  saveLoopState,
} from "./hydra.js";
import { slugTopic } from "./topic-builder.js";
import type { LoopState } from "../shared/types.js";

export const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

function subTenant(req: express.Request): string {
  return (req.headers["x-loop-user"] as string) || "anonymous";
}

export function defaultState(allNodeIds: string[]): LoopState {
  const mastery: LoopState["mastery"] = {};
  for (const id of allNodeIds) mastery[id] = "unseen";
  mastery.pods = "mastered";
  mastery.services = "mastered";
  mastery.configmaps = "shaky";
  mastery.deployments = "intro";
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

app.get("/api/memory/state", async (req, res) => {
  try {
    const stored = await loadLoopState(subTenant(req));
    if (stored) return res.json(stored);
    res.json(defaultState(NODES.map((n) => n.id)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load state" });
  }
});

app.put("/api/memory/state", async (req, res) => {
  try {
    await saveLoopState(subTenant(req), req.body as LoopState);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save state" });
  }
});

app.get("/api/content/skills", (_req, res) => {
  res.json(SKILLS);
});

app.get("/api/content/nodes/:nodeId", (req, res) => {
  const user = subTenant(req);
  const node = nodeById(req.params.nodeId) ?? getCachedCustomNode(req.params.nodeId, user);
  if (node) return res.json(node);
  res.status(404).json({ error: "Node not found" });
});

/** Agent: generate personalized lesson + quiz (Hydra memory + Gemini). */
app.post("/api/content/topics", async (req, res) => {
  const topic = String(req.body?.topic ?? "").trim();
  if (!topic) return res.status(400).json({ error: "topic is required" });

  try {
    const user = subTenant(req);
    const cached = getCachedCustomNode(slugTopic(topic), user);
    if (cached && !req.body.force) return res.json(cached);

    const node = await generatePersonalizedContent({ topic, subTenantId: user });
    cacheCustomNode(node, user);
    await ingestCustomNode(node);
    res.json(node);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate topic" });
  }
});

/** Agent: personalize an existing catalog node for this learner. */
app.post("/api/content/personalize", async (req, res) => {
  const nodeId = String(req.body?.nodeId ?? "").trim();
  if (!nodeId) return res.status(400).json({ error: "nodeId is required" });

  const base = nodeById(nodeId);
  if (!base) return res.status(404).json({ error: "Node not found" });

  try {
    const user = subTenant(req);
    const personalizedId = `personalized:${user.slice(0, 8)}:${nodeId}`;
    const cached = getCachedCustomNode(personalizedId, user);
    if (cached && !req.body.force) return res.json(cached);

    const node = await generatePersonalizedContent({
      topic: base.title,
      subTenantId: user,
      baseNode: base,
    });
    const personalized = { ...node, id: personalizedId, prereqs: base.prereqs };
    cacheCustomNode(personalized, user);
    await ingestCustomNode(personalized);
    res.json(personalized);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to personalize content" });
  }
});

app.get("/api/content/skills/:skillId", (req, res) => {
  res.json(getSkill(req.params.skillId));
});

/** Adaptive quiz: generate the next question based on prior answers. */
app.post("/api/quiz/next", async (req, res) => {
  const nodeId = String(req.body?.nodeId ?? "").trim();
  const history = req.body?.history ?? [];
  const difficulty = req.body?.difficulty as import("../shared/types.js").QuizDifficulty | undefined;

  if (!nodeId) return res.status(400).json({ error: "nodeId is required" });

  const user = subTenant(req);
  const node =
    nodeById(nodeId) ??
    getCachedCustomNode(nodeId, user) ??
    (await loadLoopState(user))?.customNodes?.[nodeId];

  if (!node) return res.status(404).json({ error: "Node not found" });

  const mastery = (await loadLoopState(user))?.mastery?.[nodeId] ?? "unseen";
  const recovery = mastery === "shaky";
  const resolvedDifficulty =
    difficulty ?? initialDifficulty(mastery);

  try {
    const question = await generateNextQuestion({
      subTenantId: user,
      nodeId,
      title: node.title,
      lesson: node.lesson,
      difficulty: resolvedDifficulty,
      history,
      recovery,
    });
    res.json({ question, difficulty: resolvedDifficulty });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate question" });
  }
});

/** Adaptive quiz: personalized learning report from session history. */
app.post("/api/quiz/report", async (req, res) => {
  const title = String(req.body?.title ?? "Session").trim();
  const history = req.body?.history ?? [];
  const correct = Number(req.body?.correct ?? 0);
  const incorrect = Number(req.body?.incorrect ?? 0);

  try {
    const report = await generateLearningReport({ title, history, correct, incorrect });
    res.json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

export { adjustDifficulty, initialDifficulty };
