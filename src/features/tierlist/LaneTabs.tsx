import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Chip, LANE_OPTIONS, useFilterIcons } from "@/features/heroes/HeroFilters";
import { LANE_ALL_LABEL, LANE_IDS, MAX_LANES, type LaneId } from "./tierData";

/** Lane display name: DB label (hero_lanes) when loaded, else the fallback in LANE_OPTIONS; "all" is the general board. */
export function useLaneName(): (id: LaneId) => string {
  const icons = useFilterIcons();
  return (id) => (id === "all" ? LANE_ALL_LABEL : icons.laneLabels[id] ?? LANE_OPTIONS.find((o) => o.value === id)?.label ?? id);
}

/**
 * Lane switcher for one Tier List. Read-only (Community viewer) when onAdd / onRemove are not given.
 * Switching only changes which board is shown: it never edits data.
 */
export function LaneTabs({
  lanes,
  active,
  onSelect,
  onAdd,
  onRemove,
}: {
  lanes: LaneId[];
  active: LaneId;
  onSelect: (id: LaneId) => void;
  onAdd?: (id: LaneId) => void;
  onRemove?: (id: LaneId) => void;
}) {
  const icons = useFilterIcons();
  const name = useLaneName();
  const [adding, setAdding] = useState(false);
  const addable = LANE_IDS.filter((id) => !lanes.includes(id));
  const iconOf = (id: LaneId) => (id === "all" ? undefined : icons.lanes[id]);

  return (
    <div data-tour="custom-lanes" className="space-y-2">
      <div role="group" aria-label="เลน" className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {lanes.map((id) => (
          <Chip key={id} active={id === active} onClick={() => onSelect(id)} label={name(id)} icon={iconOf(id)} showLabel />
        ))}
        {onAdd && (
          <button
            type="button"
            disabled={lanes.length >= MAX_LANES}
            aria-expanded={adding}
            onClick={() => setAdding((a) => !a)}
            className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            เพิ่มเลน
          </button>
        )}
        {onRemove && lanes.length > 1 && (
          <button
            type="button"
            onClick={() => onRemove(active)}
            className="ml-auto flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-loss hover:bg-bg-raised"
          >
            <Trash2 className="h-3.5 w-3.5" />
            ลบเลน {name(active)}
          </button>
        )}
      </div>
      {onAdd && adding && addable.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-bg-surface p-2">
          <span className="text-xs text-text-faint">เลือกเลนที่ต้องการเพิ่ม</span>
          {addable.map((id) => (
            <Chip
              key={id}
              active={false}
              onClick={() => {
                onAdd(id);
                setAdding(false);
              }}
              label={name(id)}
              icon={iconOf(id)}
              showLabel
            />
          ))}
        </div>
      )}
    </div>
  );
}
