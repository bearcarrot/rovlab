import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { HeroIcon } from "@/components/HeroIcon";
import type { CounterEntry } from "@/types/hero";
import { MOCK_HEROES } from "@/data/heroes.mock";
import { cn } from "@/lib/utils";

const STRENGTH_LABEL: Record<CounterEntry["strength"], string> = {
  best: "สวนได้ดีที่สุด",
  good: "สวนได้ดี",
  situational: "ใช้ได้เฉพาะสถานการณ์",
};

const STRENGTH_ORDER: Record<CounterEntry["strength"], number> = { best: 0, good: 1, situational: 2 };

type Props = {
  entries: CounterEntry[];
  emptyText: string;
  /** slug → icon URL (ใช้เมื่อ entry ไม่มี heroIcon ในตัว เช่นข้อมูล mock) */
  icons?: Record<string, string>;
  /** จัดเป็น 2 คอลัมน์บนจอ md ขึ้นไป (ใช้เมื่อรายการอยู่เต็มความกว้างหน้า) */
  grid?: boolean;
};

export function CounterList({ entries, emptyText, icons, grid = false }: Props) {
  if (entries.length === 0) {
    return <p className="text-sm text-text-faint">{emptyText}</p>;
  }
  // เรียงจากสวนได้ดีที่สุด → ใช้ได้เฉพาะสถานการณ์ (sort แบบ stable คงลำดับเดิมในกลุ่มเดียวกัน)
  const sorted = [...entries].sort(
    (a, b) => (STRENGTH_ORDER[a.strength] ?? 3) - (STRENGTH_ORDER[b.strength] ?? 3)
  );
  return (
    <div className={cn(grid ? "grid gap-2.5 md:grid-cols-2" : "space-y-2.5")}>
      {sorted.map((c) => {
        const mock = MOCK_HEROES.find((h) => h.slug === c.heroSlug);
        const nameTh = c.heroNameTh ?? mock?.nameTh;
        if (!nameTh) return null;
        const icon = c.heroIcon || icons?.[c.heroSlug] || mock?.icon || "";
        return (
          <div key={c.heroSlug} className="flex gap-3 rounded-lg border border-border bg-bg-raised p-3">
            <Link to={`/heroes/${c.heroSlug}`} className="shrink-0">
              <HeroIcon
                icon={icon}
                name={nameTh}
                fallback={mock?.name.slice(0, 2).toUpperCase()}
                className="h-11 w-11 sm:h-12 sm:w-12"
              />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <Link to={`/heroes/${c.heroSlug}`} className="font-display text-sm font-medium hover:text-accent">
                  {nameTh}
                </Link>
                <Badge>{STRENGTH_LABEL[c.strength]}</Badge>
              </div>
              <p className="mt-1.5 text-sm text-text-muted">{c.reason}</p>
              <p className="mt-1 text-xs text-text-faint">เลน: {c.laneTip}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
