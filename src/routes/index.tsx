import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { AppShell } from "@/components/loop/AppShell";
import { Typewriter } from "@/components/loop/Typewriter";
import { StatsStrip } from "@/components/loop/Stats";
import { MasteryChip } from "@/components/loop/MasteryDot";
import { TopicPicker } from "@/components/loop/TopicPicker";
import {
  ensurePlan,
  pickSession,
  resolveNode,
  startSession,
  timeSinceLast,
  useLoopState,
} from "@/lib/loop-store";
import { getSkill, MASTERY_LABEL, MASTERY_VAR } from "@/lib/loop-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Loop — your adaptive study buddy" },
      { name: "description", content: "Short, personalized sessions on Kubernetes, system design, and ML — Loop remembers what tripped you up." },
    ],
  }),
  component: Home,
});

function Home() {
  const state = useLoopState((s) => s);
  const navigate = useNavigate();
  const activeSkill = getSkill(state.activeSkillId);

  useEffect(() => { ensurePlan(); }, [state.activeSkillId]);
  const planIds = state.plan ?? pickSession(state).ids;
  const reason = useMemo(
    () => pickSession(state).reason,
    [state.mastery, state.notes, state.sessions.length, state.activeSkillId],
  );
  const greeting = timeSinceLast(state);

  const begin = () => {
    startSession(planIds);
    navigate({ to: "/learn/$nodeId", params: { nodeId: planIds[0] } });
  };

  return (
    <AppShell>
      <div className="space-y-10">
        <header className="space-y-2">
          <h1 className="font-display text-4xl font-semibold sm:text-5xl">
            <Typewriter text={greeting} />
          </h1>
          <p className="text-muted-foreground">
            Skill: <span className="text-foreground">{activeSkill.name}</span>
          </p>
        </header>

        <section className="rounded-2xl border border-border bg-card/40 p-6 fade-in-up">
          <TopicPicker />
        </section>

        <section className="rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-elevated)] fade-in-up">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-xl font-semibold">Today's session</h2>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              {planIds.length} subtopics
            </span>
          </div>

          <div className="mt-5 flex flex-wrap gap-2.5">
            {planIds.map((id) => {
              const n = resolveNode(id);
              if (!n) return null;
              const m = state.mastery[id];
              return <MasteryChip key={id} mastery={m} label={n.title} />;
            })}
          </div>

          <p className="mt-5 flex items-start gap-2.5 text-sm" style={{ color: "var(--memory)" }}>
            <MemoryGlyph />
            <span className="leading-relaxed">{reason}</span>
          </p>

          <div className="mt-7">
            <button
              onClick={begin}
              className="loop-pulse inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-base font-medium text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              Start session
              <span aria-hidden>→</span>
            </button>
          </div>
        </section>

        <StatsStrip />

        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h3 className="font-display text-lg font-semibold">Skill tree preview</h3>
            <Link to="/tree" className="text-sm text-muted-foreground hover:text-foreground">Open full map →</Link>
          </div>
          <div className="rounded-xl border border-border bg-card/40 p-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {activeSkill.nodes.slice(0, 8).map((n) => {
                const m = state.mastery[n.id];
                return (
                  <div key={n.id} className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-background/40 px-3 py-2">
                    <span style={{
                      width: 14, height: 14, borderRadius: 999,
                      background: MASTERY_VAR[m],
                      boxShadow: `0 0 10px ${MASTERY_VAR[m]}`,
                    }} />
                    <div className="min-w-0">
                      <div className="truncate text-sm">{n.title}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{MASTERY_LABEL[m]}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {state.sessions[0] && (
          <section className="rounded-xl border border-border bg-card/40 p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Last session</div>
            <p className="mt-2 font-serif text-base leading-relaxed">{state.sessions[0].recap}</p>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function MemoryGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden style={{ marginTop: 2 }}>
      <circle cx="8" cy="8" r="6" stroke="var(--memory)" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="2" fill="var(--memory)" />
    </svg>
  );
}
