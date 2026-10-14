import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROW_COLOR_PRESETS, TIER_LABEL_MAX, type TierRow } from "./tierData";

const iconBtn = "rounded-md border border-border p-1.5 text-text hover:bg-bg-raised disabled:opacity-40 disabled:hover:bg-transparent";

/** Controls for one row: rename, recolor, move up/down, delete. Plain buttons/inputs, so touch and keyboard both work. */
export function TierRowEditor({
  row,
  index,
  count,
  onLabel,
  onColor,
  onMove,
  onDelete,
}: {
  row: TierRow;
  index: number;
  count: number;
  onLabel: (label: string) => void;
  onColor: (color: string) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(row.label);
  useEffect(() => setDraft(row.label), [row.label]);
  const pos = `แถวที่ ${index + 1}`;
  const commit = () => {
    const t = draft.trim();
    if (t && t !== row.label) onLabel(t);
    else setDraft(row.label); // empty label is not allowed: keep the previous one
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-bg px-2 py-1.5">
      <input
        value={draft}
        maxLength={TIER_LABEL_MAX}
        aria-label={`ชื่อ ${pos}`}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="w-24 rounded-md border border-border bg-bg-surface px-2 py-1 text-sm outline-none focus:border-accent/60"
      />
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label={`สี ${pos}`}>
        {ROW_COLOR_PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`สี ${c}`}
            aria-pressed={row.color.toUpperCase() === c}
            onClick={() => onColor(c)}
            style={{ backgroundColor: c }}
            className={cn("h-6 w-6 rounded-full border", row.color.toUpperCase() === c ? "ring-2 ring-accent ring-offset-1 ring-offset-bg" : "border-border")}
          />
        ))}
        <input
          type="color"
          value={row.color.toLowerCase()}
          aria-label={`เลือกสีเอง ${pos}`}
          onChange={(e) => onColor(e.target.value)}
          className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent p-0"
        />
      </div>
      <div className="ml-auto flex items-center gap-1">
        <button type="button" aria-label={`เลื่อน ${pos} ขึ้น`} disabled={index === 0} onClick={() => onMove(-1)} className={iconBtn}>
          <ArrowUp className="h-4 w-4" />
        </button>
        <button type="button" aria-label={`เลื่อน ${pos} ลง`} disabled={index === count - 1} onClick={() => onMove(1)} className={iconBtn}>
          <ArrowDown className="h-4 w-4" />
        </button>
        <button type="button" aria-label={`ลบ ${pos}`} disabled={count <= 1} onClick={onDelete} className={cn(iconBtn, "text-red-400")}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
