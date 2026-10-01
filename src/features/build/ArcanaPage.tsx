import { HeroIcon } from "@/components/HeroIcon";
import type { ArcanaColor, BuildArcanaEntry } from "@/types/item";

const GROUPS: { color: ArcanaColor; label: string; dot: string }[] = [
  { color: "red", label: "รูนแดง", dot: "bg-[#e5484d]" },
  { color: "purple", label: "รูนม่วง", dot: "bg-[#8e4ec6]" },
  { color: "green", label: "รูนเขียว", dot: "bg-[#30a46c]" },
];
const MAX_SLOTS_PER_COLOR = 10;

interface StatPart { label: string; value: number; unit: string }

// "พลังโจมตี +2 · เจาะเกราะ +3.6" -> [{label, value, unit}]
function parseStats(text: string): StatPart[] {
  return text
    .split("·")
    .map((s) => s.trim())
    .map((s) => {
      const m = s.match(/^(.+?)\s*\+([\d.]+)(%?)$/);
      return m ? { label: m[1].trim(), value: parseFloat(m[2]), unit: m[3] } : null;
    })
    .filter((x): x is StatPart => x !== null);
}

const fmt = (n: number) => String(Math.round(n * 10) / 10);

function scaled(text: string, qty: number): string {
  const parts = parseStats(text);
  if (parts.length === 0) return text;
  return parts.map((p) => `${p.label} +${fmt(p.value * qty)}${p.unit}`).join(" · ");
}

function totals(arcana: BuildArcanaEntry[]): string[] {
  const sum = new Map<string, StatPart>();
  for (const a of arcana) {
    for (const p of parseStats(a.stats)) {
      const key = `${p.label}|${p.unit}`;
      const cur = sum.get(key);
      sum.set(key, { ...p, value: (cur?.value ?? 0) + p.value * a.quantity });
    }
  }
  return [...sum.values()].map((p) => `${p.label} +${fmt(p.value)}${p.unit}`);
}

export function ArcanaPage({ arcana }: { arcana: BuildArcanaEntry[] }) {
  if (arcana.length === 0) {
    return <p className="text-sm text-text-faint">ยังไม่มีข้อมูลรูนสำหรับฮีโร่นี้</p>;
  }
  const total = totals(arcana);

  return (
    <div className="space-y-4">
      {GROUPS.map(({ color, label, dot }) => {
        const list = arcana.filter((a) => a.color === color);
        if (list.length === 0) return null;
        const used = list.reduce((n, a) => n + a.quantity, 0);
        return (
          <div key={color}>
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-2 text-xs font-medium text-text-faint">
                <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                {label}
              </p>
              <span className="text-xs text-text-faint">{used}/{MAX_SLOTS_PER_COLOR} ช่อง</span>
            </div>
            <div className="space-y-2">
              {list.map((a) => (
                <div key={a.name} className="flex gap-3 rounded-lg border border-border bg-bg-raised p-3">
                  <HeroIcon icon={a.icon} name={a.name} className="bg-bg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-display text-sm font-medium">{a.name}</p>
                      <span className="shrink-0 text-xs font-medium text-accent">x{a.quantity}</span>
                    </div>
                    {a.stats && <p className="text-xs text-text-faint">{scaled(a.stats, a.quantity)}</p>}
                    {a.reason && <p className="mt-1 text-sm text-text-muted">{a.reason}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {total.length > 0 && (
        <div className="rounded-lg border border-border bg-bg-surface p-3">
          <p className="mb-1 text-xs font-medium text-text-faint">สเตตัสรวมทั้งหน้ารูน</p>
          <p className="text-sm text-text-muted">{total.join(" · ")}</p>
        </div>
      )}
    </div>
  );
}
