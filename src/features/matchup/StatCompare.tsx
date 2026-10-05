import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { HeroSummary } from "@/types/hero";

// เทียบสถิติสองตัวด้วยแถบความคืบหน้าแบบแบ่งสองฝั่ง: ความยาวของแต่ละฝั่ง = สัดส่วนของค่าตัวนั้นจากผลรวมสองตัว
// (Win Rate ใกล้กัน แถบก็จะเกือบครึ่งต่อครึ่ง = ใกล้เคียงกันจริง / Ban Rate ต่างกันมากแถบก็เอียงชัด)
// ใช้ข้อมูลสถิติรวมของแต่ละตัว ไม่ใช่ผลเจอกันโดยตรง จึงมีหมายเหตุกำกับไว้ใต้แถบ

const METRICS = [
  { key: "winRate", label: "Win Rate" },
  { key: "pickRate", label: "Pick Rate" },
  { key: "banRate", label: "Ban Rate" },
] as const;

function CompareRow({ label, a, b, aName, bName }: { label: string; a: number; b: number; aName: string; bName: string }) {
  const total = a + b;
  const aPct = total > 0 ? (a / total) * 100 : 50;
  const aLead = a > b;
  const bLead = b > a;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className={cn("font-semibold tabular-nums", aLead ? "text-accent" : "text-text-muted")}>{a.toFixed(1)}%</span>
        <span className="text-text-faint">{label}</span>
        <span className={cn("font-semibold tabular-nums", bLead ? "text-tier-c" : "text-text-muted")}>{b.toFixed(1)}%</span>
      </div>
      <div
        role="img"
        aria-label={`${label}: ${aName} ${a.toFixed(1)}% เทียบกับ ${bName} ${b.toFixed(1)}%`}
        className="mt-1 flex h-2 gap-0.5 overflow-hidden rounded-full bg-bg-raised"
      >
        <div className={cn("h-full rounded-l-full bg-accent", !aLead && "opacity-50")} style={{ width: `${aPct}%` }} />
        <div className={cn("h-full rounded-r-full bg-tier-c", !bLead && "opacity-50")} style={{ width: `${100 - aPct}%` }} />
      </div>
    </div>
  );
}

export function StatCompare({ a, b }: { a: HeroSummary; b: HeroSummary }) {
  if (!a.stat.hasStats || !b.stat.hasStats) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="flex min-w-0 items-center gap-1.5 font-medium text-accent">
          <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
          <span className="truncate">{a.nameTh}</span>
          {a.stat.tier && <Badge tier={a.stat.tier}>{a.stat.tier}</Badge>}
        </span>
        <span className="flex min-w-0 items-center justify-end gap-1.5 font-medium text-tier-c">
          {b.stat.tier && <Badge tier={b.stat.tier}>{b.stat.tier}</Badge>}
          <span className="truncate">{b.nameTh}</span>
          <span className="h-2 w-2 shrink-0 rounded-full bg-tier-c" />
        </span>
      </div>

      {METRICS.map((m) => (
        <CompareRow
          key={m.key}
          label={m.label}
          a={Number(a.stat[m.key]) || 0}
          b={Number(b.stat[m.key]) || 0}
          aName={a.nameTh}
          bName={b.nameTh}
        />
      ))}

      <p className="text-[11px] text-text-faint">แพตช์ {a.stat.patch} · สถิติรวมของแต่ละตัว ไม่ใช่ผลเจอกันโดยตรง</p>
    </div>
  );
}
