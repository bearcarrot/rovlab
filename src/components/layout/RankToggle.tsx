import { setRank, useRank, RANK_LABEL, type RankBucket } from "@/lib/rank";
import { cn } from "@/lib/utils";

const OPTIONS: { value: RankBucket; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "high", label: "Commander+" },
];

export function RankToggle({ className }: { className?: string }) {
  const rank = useRank();
  return (
    <div
      role="group"
      aria-label="ช่วงแรงก์ของสถิติ"
      className={cn("flex shrink-0 rounded-lg border border-border bg-bg-surface p-0.5 text-xs", className)}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setRank(o.value)}
          aria-pressed={rank === o.value}
          title={RANK_LABEL[o.value]}
          className={cn(
            "rounded-md px-2.5 py-1 font-medium transition-colors",
            rank === o.value ? "bg-accent text-accent-fg" : "text-text-muted hover:text-text"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
