import type { BuildItemEntry } from "@/types/item";
import { MOCK_ITEMS } from "@/data/items.mock";

export function BuildItemRow({ entry }: { entry: BuildItemEntry }) {
  const item = MOCK_ITEMS.find((i) => i.slug === entry.itemSlug);
  if (!item) return null;
  return (
    <div className="flex gap-3 rounded-lg border border-border bg-bg-raised p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-bg font-display text-[10px] text-text-faint">
        {item.name.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-display text-sm font-medium">{item.nameTh}</p>
          <span className="shrink-0 text-xs text-text-faint">{item.cost.toLocaleString()}g</span>
        </div>
        <p className="text-xs text-text-faint">{item.stats.join(" · ")}</p>
        <p className="mt-1 text-sm text-text-muted">{entry.reason}</p>
      </div>
    </div>
  );
}
