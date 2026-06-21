import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MASTERY_ORDER, MASTERY_VAR, getSkills, type Mastery } from "@/lib/loop-data";
import {
  getState,
  pickSession,
  setActiveSkill,
  startCustomTopicSession,
  startSession,
  useLoopState,
} from "@/lib/loop-store";

export function TopicPicker({
  compact = false,
  showCustomInput = true,
}: {
  compact?: boolean;
  showCustomInput?: boolean;
}) {
  const activeSkillId = useLoopState((s) => s.activeSkillId);
  const mastery = useLoopState((s) => s.mastery);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const skills = getSkills();

  const submitTopic = async () => {
    const trimmed = draft.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    try {
      const matchedSkill = skills.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
      if (matchedSkill) {
        setActiveSkill(matchedSkill.id);
        const { ids } = pickSession(getState());
        startSession(ids);
        navigate({ to: "/learn/$nodeId", params: { nodeId: ids[0] } });
        return;
      }

      const nodeId = await startCustomTopicSession(trimmed);
      navigate({ to: "/learn/$nodeId", params: { nodeId } });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={compact ? "space-y-3" : "space-y-5"}>
      <div className="space-y-2">
        {!compact && (
          <Label className="text-muted-foreground">What do you want to learn?</Label>
        )}
        <SkillChips
          activeId={activeSkillId}
          mastery={mastery}
          skills={skills}
          onSelect={setActiveSkill}
        />
      </div>

      {showCustomInput && (
        <div className="space-y-2">
          <Label htmlFor="custom-topic" className="text-muted-foreground">
            Or type any topic
          </Label>
          <Input
            id="custom-topic"
            placeholder="e.g. React hooks, SQL joins, AWS Lambda…"
            value={draft}
            disabled={loading}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submitTopic();
              }
            }}
            className="rounded-xl border-border bg-background/60"
          />
          <p className="text-xs text-muted-foreground leading-relaxed">
            {loading ? "Generating your session…" : "Press Enter to start a session on your topic."}
          </p>
        </div>
      )}
    </div>
  );
}

function SkillChips({
  activeId,
  mastery,
  skills,
  onSelect,
}: {
  activeId: string;
  mastery: Record<string, Mastery>;
  skills: ReturnType<typeof getSkills>;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {skills.map((skill) => {
        const active = skill.id === activeId;
        const counts: Record<Mastery, number> = {
          unseen: 0, intro: 0, practiced: 0, shaky: 0, mastered: 0,
        };
        for (const n of skill.nodes) counts[mastery[n.id] ?? "unseen"]++;
        const total = skill.nodes.length;
        return (
          <button
            key={skill.id}
            type="button"
            onClick={() => onSelect(skill.id)}
            className={
              "group rounded-full border px-4 py-1.5 text-sm transition-all " +
              (active
                ? "border-primary text-foreground shadow-[0_0_0_3px_oklch(0.65_0.27_295_/_0.25)]"
                : "border-border text-muted-foreground hover:text-foreground hover:border-border/80")
            }
            style={active ? { background: "color-mix(in oklab, var(--primary) 12%, transparent)" } : undefined}
          >
            <span className="font-medium">{skill.name}</span>
            {!active && (
              <span className="mt-1.5 flex h-[3px] w-full overflow-hidden rounded-full" aria-hidden>
                {MASTERY_ORDER.map((m) => {
                  const w = counts[m] / total;
                  if (w === 0) return null;
                  return (
                    <span
                      key={m}
                      style={{
                        width: `${w * 100}%`,
                        background: MASTERY_VAR[m],
                        opacity: m === "unseen" ? 0.5 : 0.9,
                      }}
                    />
                  );
                })}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
