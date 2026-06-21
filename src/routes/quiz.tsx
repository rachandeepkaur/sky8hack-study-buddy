import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/loop/AppShell";
import {
  answerQuestion,
  endSession,
  finalizeSessionReport,
  getState,
  loadNextQuestion,
  questionsAnsweredSoFar,
  resolveNode,
  totalQuestionsInSession,
  useLoopState,
} from "@/lib/loop-store";

export const Route = createFileRoute("/quiz")({
  head: () => ({ meta: [{ title: "Quiz — Loop" }] }),
  component: QuizPage,
});

interface FloatXP { id: number; text: string; gold: boolean }

const DIFFICULTY_LABEL = {
  basic: "Foundations",
  intermediate: "Applied",
  hard: "Challenge",
} as const;

function QuizPage() {
  const live = useLoopState((s) => s.liveSession);
  const navigate = useNavigate();
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [floats, setFloats] = useState<FloatXP[]>([]);
  const [keyN, setKeyN] = useState(0);
  const [loading, setLoading] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const finishSession = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    await finalizeSessionReport();
    const session = endSession();
    if (session) sessionStorage.setItem("loop.lastRecap", session.date);
    navigate({ to: "/recap" });
  }, [finishing, navigate]);

  useEffect(() => {
    if (!live) navigate({ to: "/" });
  }, [live, navigate]);

  useEffect(() => {
    if (!live || live.currentQuestion || live.complete) return;
    setLoading(true);
    loadNextQuestion()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [live?.currentQuestion, live?.complete, live?.history.length]);

  useEffect(() => {
    if (live?.complete && !live.currentQuestion && !finishing) {
      void finishSession();
    }
  }, [live?.complete, live?.currentQuestion, finishing, finishSession]);

  if (!live) return <AppShell><p>No active session.</p></AppShell>;

  if (finishing) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl py-20 text-center text-muted-foreground">
          Building your personalized report…
        </div>
      </AppShell>
    );
  }

  const nodeId = live.nodeIds[live.activeNodeIndex];
  const node = resolveNode(nodeId);
  const question = live.currentQuestion;
  const isRecovery = live.recovery;

  const choose = (idx: number) => {
    if (revealed || !question) return;
    setPicked(idx);
    setRevealed(true);
    const res = answerQuestion(idx);
    if (res.correct) {
      const id = Date.now();
      setFloats((f) => [...f, { id, text: res.recovery ? "+20 Recovery XP" : "+10 XP", gold: res.recovery }]);
      setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 2200);
      if (!live.complete) {
        setTimeout(() => cont(), 850);
      }
    }
  };

  const cont = () => {
    setPicked(null);
    setRevealed(false);
    setKeyN((k) => k + 1);
    if (getState().liveSession?.complete) {
      void finishSession();
    }
  };

  const total = totalQuestionsInSession();
  const answered = questionsAnsweredSoFar();
  const progress = total > 0 ? (answered / total) * 100 : 0;

  if (loading || !question) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl space-y-6 py-16 text-center">
          <div className="font-display text-lg font-semibold">
            {node ? `Generating your next ${node.title} question…` : "Loading question…"}
          </div>
          <p className="text-sm text-muted-foreground">
            Adapting difficulty based on how you're doing
          </p>
          <div className="mx-auto h-1 w-48 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/2 animate-pulse bg-primary" />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <div className="flex items-baseline justify-between text-xs uppercase tracking-wider text-muted-foreground">
            <span>{node?.title ?? "Quiz"}</span>
            <span className="tabular">Question {answered + 1} / {total}</span>
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div
          key={keyN}
          className="slide-in-right relative rounded-2xl border bg-card p-8 shadow-[var(--shadow-elevated)]"
          style={{
            borderColor: isRecovery ? "var(--memory)" : "var(--border)",
            boxShadow: isRecovery ? "var(--shadow-gold), var(--shadow-elevated)" : "var(--shadow-elevated)",
          }}
        >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {isRecovery && (
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium" style={{ background: "color-mix(in oklab, var(--memory) 15%, transparent)", color: "var(--memory)" }}>
                ⟲ Recovery — bringing this back
              </div>
            )}
            <div className="inline-flex rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
              {DIFFICULTY_LABEL[question.difficulty]}
            </div>
          </div>
          <h2 className="font-display text-2xl font-semibold leading-snug">{question.q}</h2>

          <div className="mt-7 space-y-3">
            {question.options.map((opt, i) => {
              const isPicked = picked === i;
              const isCorrect = i === question.answer;
              let cls = "border-border bg-background/40 hover:border-foreground/40";
              if (revealed) {
                if (isCorrect) cls = "flash-correct border-[var(--mastery-mastered)] bg-[color-mix(in_oklab,var(--mastery-mastered)_12%,transparent)]";
                else if (isPicked) cls = "flash-wrong border-[var(--mastery-shaky)] bg-[color-mix(in_oklab,var(--mastery-shaky)_12%,transparent)]";
              }
              return (
                <button
                  key={i}
                  onClick={() => choose(i)}
                  disabled={revealed}
                  className={"flex w-full items-center gap-3 rounded-xl border px-5 py-4 text-left transition-colors " + cls}
                >
                  <span className="font-display text-sm tabular text-muted-foreground">{String.fromCharCode(65 + i)}</span>
                  <span className="text-base">{opt}</span>
                </button>
              );
            })}
          </div>

          {revealed && picked !== question.answer && (
            <div className="mt-5 rounded-lg border border-border bg-background/50 p-4 text-sm leading-relaxed">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Why</div>
              <p className="mt-1.5">{question.explanation}</p>
              <button onClick={cont} className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
                {live.complete ? "See your report →" : "Continue →"}
              </button>
            </div>
          )}

          <div className="pointer-events-none absolute right-6 top-6">
            {floats.map((f) => (
              <div
                key={f.id}
                className={f.gold ? "xp-float-long" : "xp-float"}
                style={{
                  fontFamily: "Space Grotesk, sans-serif",
                  fontWeight: 600,
                  fontSize: f.gold ? 22 : 18,
                  color: f.gold ? "var(--memory)" : "var(--mastery-mastered)",
                  textShadow: f.gold ? "0 0 14px color-mix(in oklab, var(--memory) 60%, transparent)" : "none",
                }}
              >
                {f.text}
              </div>
            ))}
          </div>
        </div>

        <div className="text-center text-xs text-muted-foreground tabular">
          {live.correct} correct · {live.incorrect} missed · {live.xpEarned} XP earned
        </div>
      </div>
    </AppShell>
  );
}
