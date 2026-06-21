import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/loop/AppShell";
import { TopicPicker } from "@/components/loop/TopicPicker";
import { MASTERY_LABEL, MASTERY_VAR, getSkill, type SkillNode } from "@/lib/loop-data";
import { isUnlocked, startSession, useLoopState } from "@/lib/loop-store";

export const Route = createFileRoute("/tree")({
  head: () => ({ meta: [{ title: "Skill tree — Loop" }, { name: "description", content: "Your full skill map." }] }),
  component: TreePage,
});

const W = 720;
const H = 720;

function TreePage() {
  const mastery = useLoopState((s) => s.mastery);
  const activeSkillId = useLoopState((s) => s.activeSkillId);
  const activeSkill = getSkill(activeSkillId);

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="space-y-4">
          <div>
            <h1 className="font-display text-3xl font-semibold">Skill tree</h1>
            <p className="text-sm text-muted-foreground">
              Click any unlocked node to drop into a focused session on {activeSkill.name}.
            </p>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <TopicPicker compact showCustomInput={false} />
            <Legend />
          </div>
        </header>

        <TreeCanvas
          key={activeSkill.id}
          skillId={activeSkill.id}
          nodes={activeSkill.nodes}
          mastery={mastery}
        />
      </div>
    </AppShell>
  );
}

function TreeCanvas({
  skillId,
  nodes,
  mastery,
}: {
  skillId: string;
  nodes: SkillNode[];
  mastery: Record<string, Mastery>;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const navigate = useNavigate();

  const positions = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {};
    for (const n of nodes) map[n.id] = { x: n.x * W, y: n.y * H };
    return map;
  }, [nodes]);

  return (
    <div
      className="rounded-2xl border border-border bg-card/50 p-4 shadow-[var(--shadow-elevated)] fade-in-up"
      style={{ animationDuration: "200ms" }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${skillId} skill tree`}>
        <defs>
          <radialGradient id={`bg-glow-${skillId}`} cx="50%" cy="0%" r="80%">
            <stop offset="0%" stopColor="oklch(0.65 0.27 295 / 0.18)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        <rect x={0} y={0} width={W} height={H} fill={`url(#bg-glow-${skillId})`} />

        {nodes.flatMap((n, ni) =>
          n.prereqs.map((p) => {
            const a = positions[p], b = positions[n.id];
            if (!a || !b) return null;
            return (
              <line
                key={`${p}-${n.id}`}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="oklch(0.45 0.05 265)" strokeWidth={1.8}
                className="draw-edge"
                style={{ animationDelay: `${ni * 90}ms` }}
                strokeLinecap="round"
              />
            );
          })
        )}

        {nodes.map((n) => {
          const pos = positions[n.id];
          const m = mastery[n.id] ?? "unseen";
          const unlocked = isUnlocked(n, mastery);
          const breatheClass = m === "shaky" ? "node-breathe-shaky" : "node-breathe";
          return (
            <g
              key={n.id}
              transform={`translate(${pos.x} ${pos.y})`}
              style={{ cursor: unlocked ? "pointer" : "not-allowed", opacity: unlocked ? 1 : 0.35 }}
              onMouseEnter={() => setHover(n.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => {
                if (!unlocked) return;
                startSession([n.id]);
                navigate({ to: "/learn/$nodeId", params: { nodeId: n.id } });
              }}
            >
              <circle r={32} fill="oklch(0.18 0.04 265)" stroke={MASTERY_VAR[m]} strokeWidth={2.5} className={breatheClass} />
              <circle r={14} fill={MASTERY_VAR[m]} opacity={0.85} className={breatheClass} />
              {hover === n.id && (
                <circle r={42} fill="none" stroke={MASTERY_VAR[m]} strokeWidth={1.4} opacity={0.6} />
              )}
              <text y={56} textAnchor="middle" fontSize={14} fontFamily="Space Grotesk, sans-serif" fill="oklch(0.96 0.01 250)" fontWeight={500}>
                {n.title}
              </text>
              <text y={73} textAnchor="middle" fontSize={10.5} fill="oklch(0.7 0.03 260)" letterSpacing="1">
                {MASTERY_LABEL[m].toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      {(Object.keys(MASTERY_LABEL) as (keyof typeof MASTERY_LABEL)[]).map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5 text-muted-foreground">
          <span style={{ width: 10, height: 10, borderRadius: 999, background: MASTERY_VAR[k] }} />
          {MASTERY_LABEL[k]}
        </span>
      ))}
    </div>
  );
}
