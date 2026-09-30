import type { BuildItemEntry } from "@/types/item";
import { getItems } from "@/services/items";
import { useAsync } from "@/hooks/useAsync";
import { HeroIcon } from "@/components/HeroIcon";
import { Skeleton } from "@/components/layout/Skeleton";

// Some DB rows keep long skill descriptions inside `stats`; only show short stat lines here.
const MAX_STAT_LENGTH = 40;

export function BuildItemRow({ entry }: { entry: BuildItemEntry }) {
  const itemsQ = useAsync(() => getItems(), []);

  if (itemsQ.status === "loading") return <Skeleton className="h-[72px] rounded-lg" />;

  const item = itemsQ.status === "success" ? itemsQ.data.find((i) => i.slug === entry.itemSlug) : undefined;
  const title = item?.nameTh ?? entry.itemSlug;
  const stats = (item?.stats ?? []).filter((s) => s.length <= MAX_STAT_LENGTH);

  return (
    <div className="flex gap-3 rounded-lg border border-border bg-bg-raised p-3">
      <HeroIcon icon={item?.icon} name={title} className="bg-bg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-display text-sm font-medium">{title}</p>
          {item && <span className="shrink-0 text-xs text-text-faint">{item.cost.toLocaleString()}g</span>}
        </div>
        {stats.length > 0 && <p className="text-xs text-text-faint">{stats.join(" · ")}</p>}
        <p className="mt-1 text-sm text-text-muted">{entry.reason}</p>
      </div>
    </div>
  );
}
