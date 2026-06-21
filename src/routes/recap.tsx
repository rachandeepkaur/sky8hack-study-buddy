import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/loop/AppShell";
import { MASTERY_LABEL, MASTERY_VAR } from "@/lib/loop-data";
import { resolveNode, useLoopState } from "@/lib/loop-store";

export const Route = createFileRoute("/recap")({
  head: () => ({ meta: [{ title: "Session recap — Loop" }] }),
  component: RecapPage,
});

function RecapPage() {
  const session = useLoopState((s) => s.sessions[0]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!session) return;
    const target = session.xp;
    if (target <= 0) return;
    const start = performance.now();
    const dur = 1100;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setCount(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [session?.date]);

  if (!session) {
    return (
      <AppShell>
        <p className="text-muted-foreground">No recent session yet.</p>
        <Link to="/" className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Back home</Link>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-10">
        <header className="space-y-3 text-center">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Session recap</div>
          <div className="font-display tabular text-7xl font-semibold leading-none">
            +{count.toLocaleString()}
            <span className="ml-2 text-xl text-muted-foreground">XP</span>
          </div>
          <p className="text-sm text-muted-foreground">{new Date(session.date).toLocaleString(undefined, { weekday: "long", hour: "numeric", minute: "2-digit" })}</p>
        </header>

        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold">Subtopics covered</h2>
          <div className="space-y-3">
            {session.nodeIds.map((id) => {
              const n = resolveNode(id);
              if (!n) return null;
              const before = session.before[id];
              const after = session.after[id];
              const moved = before !== after;
              return (
                <div key={id} className="rounded-xl border border-border bg-card/60 px-5 py-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-display text-base font-semibold">{n.title}</h3>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      {moved ? "advanced" : "held"}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <BeforeAfterBar before={before} after={after} />
                    <div className="text-sm text-muted-foreground">
                      {MASTERY_LABEL[before]} <span className="mx-1.5 opacity-60">→</span>
                      <span style={{ color: MASTERY_VAR[after] }}>{MASTERY_LABEL[after]}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card/40 p-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider" style={{ color: "var(--memory)" }}>
            <span>⟲</span> Loop's note to itself
          </div>
          <p className="mt-3 font-serif text-lg italic leading-relaxed text-foreground/95">
            {session.recap}
          </p>
        </section>

        {session.gapsToReview && session.gapsToReview.length > 0 && (
          <section className="space-y-4">
            <h2 className="font-display text-lg font-semibold">Still to learn</h2>
            <p className="text-sm text-muted-foreground">
              Based on your answers and question difficulty, focus on these next:
            </p>
            <ul className="space-y-2">
              {session.gapsToReview.map((gap) => (
                <li
                  key={gap}
                  className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm leading-relaxed"
                >
                  {gap}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex justify-center gap-3">
          <Link to="/tree" className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent">View skill tree</Link>
          <Link to="/" className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">Back home</Link>
        </div>
      </div>
    </AppShell>
  );
}

function BeforeAfterBar({ before, after }: { before: keyof typeof MASTERY_VAR; after: keyof typeof MASTERY_VAR }) {
  return (
    <div className="relative h-2 w-40 overflow-hidden rounded-full" style={{ background: "color-mix(in oklab, var(--border) 60%, transparent)" }}>
      <div
        className="absolute inset-y-0 left-0 transition-all"
        style={{
          width: "100%",
          background: `linear-gradient(90deg, ${MASTERY_VAR[before]}, ${MASTERY_VAR[after]})`,
        }}
      />
    </div>
  );
}
