import type { Skill, SkillNode } from "../../shared/types";
import { getUserId } from "./memory";

let skills: Skill[] = [];
let nodeMap: Record<string, SkillNode> = {};
let loaded = false;

function userHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-Loop-User": getUserId(),
  };
}

export function isContentLoaded() {
  return loaded;
}

export function getSkills(): Skill[] {
  return skills;
}

export function getAllNodes(): SkillNode[] {
  return Object.values(nodeMap);
}

export function getSkill(id: string): Skill {
  return skills.find((s) => s.id === id) ?? skills[0];
}

export function nodeById(id: string): SkillNode | undefined {
  return nodeMap[id];
}

export function registerNode(node: SkillNode) {
  nodeMap[node.id] = node;
}

export async function loadSkillsCatalog(): Promise<Skill[]> {
  if (loaded && skills.length) return skills;
  const res = await fetch("/api/content/skills");
  if (!res.ok) throw new Error("Failed to load skills");
  skills = (await res.json()) as Skill[];
  nodeMap = {};
  for (const skill of skills) {
    for (const node of skill.nodes) nodeMap[node.id] = node;
  }
  loaded = true;
  return skills;
}

export async function fetchNode(nodeId: string): Promise<SkillNode | null> {
  const cached = nodeMap[nodeId];
  if (cached) return cached;

  const res = await fetch(`/api/content/nodes/${encodeURIComponent(nodeId)}`, {
    headers: { "X-Loop-User": getUserId() },
  });
  if (!res.ok) return null;
  const node = (await res.json()) as SkillNode;
  registerNode(node);
  return node;
}

/** Agent-generated personalized lesson + quiz for a custom topic. */
export async function generateTopicNode(topic: string): Promise<SkillNode> {
  const res = await fetch("/api/content/topics", {
    method: "POST",
    headers: userHeaders(),
    body: JSON.stringify({ topic }),
  });
  if (!res.ok) throw new Error("Failed to generate topic");
  const node = (await res.json()) as SkillNode;
  registerNode(node);
  return node;
}

/** Agent-generated personalized version of a catalog node. */
export async function personalizeNode(nodeId: string): Promise<SkillNode> {
  const res = await fetch("/api/content/personalize", {
    method: "POST",
    headers: userHeaders(),
    body: JSON.stringify({ nodeId }),
  });
  if (!res.ok) throw new Error("Failed to personalize node");
  const node = (await res.json()) as SkillNode;
  registerNode(node);
  return node;
}

export function skillForNode(id: string): Skill {
  return skills.find((s) => s.nodes.some((n) => n.id === id)) ?? skills[0];
}
