import { cn } from "@/lib/utils";
import type { HeroLane, HeroRole } from "@/types/hero";

export const ROLE_OPTIONS: { value: HeroRole; label: string }[] = [
  { value: "assassin", label: "แอสแซสซิน" },
  { value: "fighter", label: "ไฟท์เตอร์" },
  { value: "mage", label: "เมจ" },
  { value: "marksman", label: "มาร์กแมน" },
  { value: "support", label: "ซัพพอร์ต" },
  { value: "tank", label: "แทงค์" },
];

export const LANE_OPTIONS: { value: HeroLane; label: string }[] = [
  { value: "slayer", label: "Slayer" },
  { value: "jungle", label: "Jungle" },
  { value: "mid", label: "Mid" },
  { value: "abyssal", label: "Abyssal" },
  { value: "support", label: "Support" },
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "border-accent bg-accent text-accent-fg" : "border-border bg-bg-surface text-text-muted hover:text-text"
      )}
    >
      {children}
    </button>
  );
}

export function RoleFilterRow({ value, onChange }: { value: HeroRole | null; onChange: (v: HeroRole | null) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
      <Chip active={value === null} onClick={() => onChange(null)}>ทั้งหมด</Chip>
      {ROLE_OPTIONS.map((r) => (
        <Chip key={r.value} active={value === r.value} onClick={() => onChange(value === r.value ? null : r.value)}>
          {r.label}
        </Chip>
      ))}
    </div>
  );
}

export function LaneFilterRow({ value, onChange }: { value: HeroLane | null; onChange: (v: HeroLane | null) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
      <Chip active={value === null} onClick={() => onChange(null)}>ทุกเลน</Chip>
      {LANE_OPTIONS.map((l) => (
        <Chip key={l.value} active={value === l.value} onClick={() => onChange(value === l.value ? null : l.value)}>
          {l.label}
        </Chip>
      ))}
    </div>
  );
}
