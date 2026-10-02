import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getFilterIcons, type FilterIcons } from "@/services/filterIcons";
import type { HeroLane, HeroRole } from "@/types/hero";

export const ROLE_OPTIONS: { value: HeroRole; label: string }[] = [
  { value: "assassin", label: "แอแซสซิน" },
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

const NO_ICONS: FilterIcons = { roles: {}, lanes: {} };

// Icons come from the DB (hero_roles / hero_lanes). Until they load, or if none are set, chips render text only.
function useFilterIcons(): FilterIcons {
  const [icons, setIcons] = useState<FilterIcons>(NO_ICONS);
  useEffect(() => {
    let cancelled = false;
    void getFilterIcons().then((v) => {
      if (!cancelled) setIcons(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return icons;
}

// With an icon: icon only on small screens, icon + text from `sm` up. Without an icon (or if it fails to
// load): text only, as before. `label` is always exposed via title / aria-label.
function Chip({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [icon]);
  const showIcon = !!icon && !failed;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border py-1.5 text-xs font-medium transition-colors",
        showIcon ? "px-2.5 sm:px-3" : "px-3",
        active ? "border-accent bg-accent text-accent-fg" : "border-border bg-bg-surface text-text-muted hover:text-text"
      )}
    >
      {showIcon && (
        <img
          src={icon}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-5 w-5 shrink-0 object-contain"
          onError={() => setFailed(true)}
        />
      )}
      <span className={showIcon ? "hidden sm:inline" : undefined}>{label}</span>
    </button>
  );
}

export function RoleFilterRow({ value, onChange }: { value: HeroRole | null; onChange: (v: HeroRole | null) => void }) {
  const icons = useFilterIcons();
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
      <Chip active={value === null} onClick={() => onChange(null)} label="ทั้งหมด" />
      {ROLE_OPTIONS.map((r) => (
        <Chip
          key={r.value}
          active={value === r.value}
          onClick={() => onChange(value === r.value ? null : r.value)}
          label={r.label}
          icon={icons.roles[r.value]}
        />
      ))}
    </div>
  );
}

export function LaneFilterRow({ value, onChange }: { value: HeroLane | null; onChange: (v: HeroLane | null) => void }) {
  const icons = useFilterIcons();
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
      <Chip active={value === null} onClick={() => onChange(null)} label="ทุกเลน" />
      {LANE_OPTIONS.map((l) => (
        <Chip
          key={l.value}
          active={value === l.value}
          onClick={() => onChange(value === l.value ? null : l.value)}
          label={l.label}
          icon={icons.lanes[l.value]}
        />
      ))}
    </div>
  );
}
