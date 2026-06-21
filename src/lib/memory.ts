import type { LoopState } from "../../shared/types";

const USER_KEY = "loop.userId";

export function getUserId(): string {
  if (typeof window === "undefined") return "anonymous";
  let id = localStorage.getItem(USER_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(USER_KEY, id);
  }
  return id;
}

function headers(): HeadersInit {
  return { "X-Loop-User": getUserId() };
}

export async function fetchState(): Promise<LoopState | null> {
  try {
    const res = await fetch("/api/memory/state", { headers: headers() });
    if (!res.ok) return null;
    return (await res.json()) as LoopState;
  } catch {
    return null;
  }
}

export async function persistState(state: LoopState): Promise<void> {
  try {
    await fetch("/api/memory/state", {
      method: "PUT",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
  } catch {
    // offline — state remains in memory until next successful save
  }
}
