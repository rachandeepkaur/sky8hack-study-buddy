import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/loop/AppShell";
import { MasteryChip } from "@/components/loop/MasteryDot";
import { nodeById } from "@/lib/loop-data";
import { resolveNode, useLoopState } from "@/lib/loop-store";

export const Route = createFileRoute("/learn/$nodeId")({
  head: () => ({ meta: [{ title: "Learning — Loop" }] }),
  component: LearnPage,
});

const EMPTY_NOTES: string[] = [];

function LearnPage() {
  const { nodeId } = Route.useParams();
  const node = resolveNode(nodeId);
  const mastery = useLoopState((s) => s.mastery[nodeId] ?? "unseen");
  const masteryMap = useLoopState((s) => s.mastery);
  const notesMap = useLoopState((s) => s.notes);
  const notes = notesMap[nodeId] ?? EMPTY_NOTES;
  const navigate = useNavigate();
  const [showQuizCta, setShowQuizCta] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const masteredTitles = useMemo(
    () =>
      Object.entries(masteryMap)
        .filter(([id, m]) => m === "mastered" && id !== nodeId)
        .map(([id]) => nodeById(id)?.title ?? "")
        .filter(Boolean),
    [masteryMap, nodeId],
  );

  useEffect(() => {
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      const scrolled = window.scrollY + window.innerHeight;
      const target = el.offsetTop + el.offsetHeight * 0.7;
      if (scrolled >= target) setShowQuizCta(true);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    const t = window.setTimeout(() => setShowQuizCta(true), 6000);
    return () => { window.removeEventListener("scroll", onScroll); window.clearTimeout(t); };
  }, [nodeId]);

  if (!node) return <AppShell><p>Unknown subtopic.</p></AppShell>;

  return (
    <AppShell>
      <article className="mx-auto max-w-2xl space-y-7">
        <header className="space-y-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Learning</div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">{node.title}</h1>
          <p className="text-muted-foreground">{node.blurb}</p>
          <div className="flex flex-wrap items-center gap-3">
            <MasteryChip mastery={mastery} label={`Now: ${mastery}`} />
            {notes[0] && (
              <span className="text-xs" style={{ color: "var(--memory)" }}>
                ⟲ You stumbled here {notes[0]}.
              </span>
            )}
          </div>
        </header>

        <div ref={ref} className="space-y-5 text-[1.05rem] leading-[1.85] text-foreground/90">
          {node.lesson.map((p, i) => (
            <p
              key={i}
              className="fade-in-up"
              style={{ animationDelay: `${i * 80}ms` }}
              dangerouslySetInnerHTML={{ __html: highlightMastered(p, masteredTitles) }}
            />
          ))}
        </div>

        <div className={"sticky bottom-6 flex justify-center transition-opacity duration-700 " + (showQuizCta ? "opacity-100" : "pointer-events-none opacity-0")}>
          <button
            onClick={() => navigate({ to: "/quiz" })}
            className="rounded-xl bg-primary px-7 py-3 font-medium text-primary-foreground shadow-[var(--shadow-violet)] transition-transform hover:-translate-y-0.5"
          >
            Ready for the quiz →
          </button>
        </div>
      </article>
    </AppShell>
  );
}

function highlightMastered(text: string, titles: string[]): string {
  let out = escapeHtml(text);
  for (const t of titles) {
    const re = new RegExp(`\\b(${escapeReg(t)})\\b`, "g");
    out = out.replace(
      re,
      `<span style="text-decoration:underline; text-decoration-color: var(--memory); text-underline-offset: 4px; cursor: help;" title="you mastered this">$1</span>`,
    );
  }
  return out;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
function escapeReg(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
