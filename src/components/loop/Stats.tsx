import { useLoopState } from "@/lib/loop-store";

export function StatsStrip() {
  const xp = useLoopState((s) => s.xp);
  const streak = useLoopState((s) => s.streak);
  const depth = useLoopState((s) => s.memoryDepth);

  return (
    <div className="grid grid-cols-3 gap-4">
      <Stat label="Streak" value={
        <span className="inline-flex items-center gap-2">
          <FlameIcon />
          <span className="tabular text-3xl font-display font-semibold">{streak}</span>
        </span>
      } />
      <Stat label="Total XP" value={
        <span className="tabular text-3xl font-display font-semibold">{xp.toLocaleString()}</span>
      } />
      <Stat label={<span className="inline-flex items-center gap-1.5"><span style={{ color: "var(--memory)" }}>Memory Depth</span></span>} value={<MemoryMeter value={depth} />} />
    </div>
  );
}

function Stat({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 px-5 py-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2">{value}</div>
    </div>
  );
}

function FlameIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3c1 3.5-2 4.5-2 7a2 2 0 0 0 4 0c0 2 2 3.5 2 6a6 6 0 0 1-12 0c0-3.5 3-5 4-8 .5-1.5 2-3 4-5z"
        fill="oklch(0.78 0.14 60)" stroke="oklch(0.85 0.16 70)" strokeWidth="0.7"/>
    </svg>
  );
}

export function MemoryMeter({ value, height = 10 }: { value: number; height?: number }) {
  const pct = Math.max(0.04, Math.min(1, value));
  return (
    <div className="memory-pulse" style={{
      height,
      width: "100%",
      borderRadius: 999,
      background: "color-mix(in oklab, var(--memory) 10%, transparent)",
      border: "1px solid color-mix(in oklab, var(--memory) 35%, transparent)",
      overflow: "hidden",
    }}>
      <div
        style={{
          height: "100%",
          width: `${pct * 100}%`,
          background: "linear-gradient(90deg, color-mix(in oklab, var(--memory) 70%, transparent), var(--memory))",
          transition: "width 800ms cubic-bezier(.2,.8,.2,1)",
        }}
      />
    </div>
  );
}
