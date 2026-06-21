import { MASTERY_VAR, type Mastery } from "@/lib/loop-data";

export function MasteryDot({ mastery, size = 10 }: { mastery: Mastery; size?: number }) {
  return (
    <span
      aria-label={mastery}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: 999,
        background: MASTERY_VAR[mastery],
        boxShadow: `0 0 8px ${MASTERY_VAR[mastery]}`,
      }}
    />
  );
}

export function MasteryChip({ mastery, label }: { mastery: Mastery; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium"
      style={{
        borderColor: MASTERY_VAR[mastery],
        color: MASTERY_VAR[mastery],
        background: `color-mix(in oklab, ${MASTERY_VAR[mastery]} 10%, transparent)`,
      }}
    >
      <MasteryDot mastery={mastery} size={8} />
      {label}
    </span>
  );
}
