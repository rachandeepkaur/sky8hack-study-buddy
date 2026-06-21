import "./env.js";
import { HydraDBClient } from "@hydradb/sdk";
import type { LoopState, SkillNode } from "../shared/types.js";

export const TENANT_ID = process.env.HYDRA_DB_TENANT_ID ?? "loop-study-buddy";
export const STATE_MEMORY_ID = "loop-state-v2";

const apiKey = process.env.HYDRA_DB_API_KEY;
if (!apiKey) {
  console.warn("[hydra] HYDRA_DB_API_KEY is not set — memory and query calls will fail.");
}

export const hydra = new HydraDBClient({ token: apiKey ?? "" });

const stateCache = new Map<string, LoopState>();
const customNodeCache = new Map<string, SkillNode>();

function cacheKey(subTenantId: string, nodeId: string) {
  return `${subTenantId}:${nodeId}`;
}

export function cacheCustomNode(node: SkillNode, subTenantId = "anonymous") {
  customNodeCache.set(cacheKey(subTenantId, node.id), node);
}

export function getCachedCustomNode(nodeId: string, subTenantId = "anonymous"): SkillNode | undefined {
  return customNodeCache.get(cacheKey(subTenantId, nodeId));
}

export async function ensureTenant(): Promise<void> {
  if (!apiKey) return;
  try {
    const list = await hydra.tenants.list();
    const tenants = list.data?.tenants ?? [];
    if (tenants.includes(TENANT_ID)) return;
    await hydra.tenants.create({ tenantId: TENANT_ID });
    console.log(`[hydra] Created tenant ${TENANT_ID}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("409") || msg.toLowerCase().includes("exist")) return;
    console.warn("[hydra] ensureTenant:", msg);
  }
}

export async function loadLoopState(subTenantId: string): Promise<LoopState | null> {
  const cached = stateCache.get(subTenantId);
  if (cached) return cached;
  if (!apiKey) return null;

  try {
    const resp = await hydra.context.inspect({
      tenantId: TENANT_ID,
      subTenantId,
      id: STATE_MEMORY_ID,
      mode: "content",
    });
    const content = resp.data?.content;
    const text =
      typeof content === "string"
        ? content
        : typeof content === "object" && content && "text" in content
          ? String((content as { text?: string }).text ?? "")
          : "";
    if (!text) return null;
    const parsed = JSON.parse(text) as LoopState;
    stateCache.set(subTenantId, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export async function saveLoopState(subTenantId: string, state: LoopState): Promise<void> {
  stateCache.set(subTenantId, state);
  if (!apiKey) return;

  await hydra.context.ingest({
    type: "memory",
    tenantId: TENANT_ID,
    subTenantId,
    upsert: true,
    memories: JSON.stringify([
      {
        id: STATE_MEMORY_ID,
        title: "Loop study state",
        text: JSON.stringify(state),
        infer: false,
      },
    ]),
  });
}

export async function ingestKnowledgeEntry(entry: {
  id: string;
  title: string;
  body: string;
  metadata?: Record<string, string>;
}): Promise<void> {
  if (!apiKey) return;

  await hydra.context.ingest({
    type: "knowledge",
    tenantId: TENANT_ID,
    subTenantId: "catalog",
    upsert: true,
    appKnowledge: JSON.stringify([
      {
        id: entry.id,
        title: entry.title,
        type: "loop_node",
        content: { text: entry.body },
        tenant_metadata: entry.metadata ?? {},
        document_metadata: { source: "loop-seed" },
      },
    ]),
  });
}

/** Hybrid search over knowledge + user memory for a topic. */
export async function queryTopicContext(topic: string, subTenantId?: string): Promise<string[]> {
  if (!apiKey) return [];

  try {
    const resp = await hydra.query({
      tenantId: TENANT_ID,
      subTenantId,
      query: `Fundamentals and key concepts for learning ${topic}. Include definitions, mental models, and practical patterns.`,
      type: "all",
      queryBy: "hybrid",
      maxResults: 8,
    });
    const chunks = resp.data?.chunks ?? [];
    return chunks
      .map((c) => c.content ?? c.text ?? "")
      .filter(Boolean);
  } catch (err) {
    console.warn("[hydra] queryTopicContext:", err);
    return [];
  }
}

/** Store a learning event in Hydra memory for future personalization. */
export async function ingestLearnerMemory(
  subTenantId: string,
  event: { topic: string; summary: string },
): Promise<void> {
  if (!apiKey) return;

  const id = `learn-${event.topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}-${Date.now()}`;

  await hydra.context.ingest({
    type: "memory",
    tenantId: TENANT_ID,
    subTenantId,
    upsert: false,
    memories: JSON.stringify([
      {
        id,
        title: `Learning: ${event.topic}`,
        text: event.summary,
        infer: true,
      },
    ]),
  });
}

export { buildTopicNode, slugTopic } from "./topic-builder.js";

export async function ingestCustomNode(node: SkillNode): Promise<void> {
  await ingestKnowledgeEntry({
    id: node.id,
    title: node.title,
    body: JSON.stringify(node),
    metadata: { kind: "custom_node", topic: node.title },
  });
}
