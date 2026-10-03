import { setRank, useRank, RANK_LABEL, type RankBucket } from "@/lib/rank";
import { cn } from "@/lib/utils";

const OPTIONS: { value: RankBucket; label: string }[] = [
  { value: "all", label: "ทุกแรงก์" },
  { value: "high", label: "Commander+" },
];

// ชิปเลือกช่วงแรงก์ (all / high) ในหน้า ใช้ state เดียวกับ RankToggle บน Header
// จึงเปลี่ยนอันไหนก็ตรงกันทั้งสองที่ และสถิติทั้งเว็บเปลี่ยนตาม
export function RankFilterRow() {
  const rank = useRank();
  return (
    <div role="group" aria-label="ช่วงแรงก์ของสถิติ" className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setRank(o.value)}
          aria-pressed={rank === o.value}
          title={RANK_LABEL[o.value]}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            rank === o.value ? "border-accent bg-accent text-accent-fg" : "border-border bg-bg-surface text-text-muted hover:text-text"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
