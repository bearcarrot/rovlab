import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import type { CounterEntry } from "@/types/hero";
import { MOCK_HEROES } from "@/data/heroes.mock";

const STRENGTH_LABEL: Record<CounterEntry["strength"], string> = {
  best: "สวนได้ดีที่สุด",
  good: "สวนได้ดี",
  situational: "ใช้ได้เฉพาะสถานการณ์",
};

export function CounterList({ entries, emptyText }: { entries: CounterEntry[]; emptyText: string }) {
  if (entries.length === 0) {
    return <p className="text-sm text-text-faint">{emptyText}</p>;
  }
  return (
    <div className="space-y-2.5">
      {entries.map((c) => {
        const nameTh = c.heroNameTh ?? MOCK_HEROES.find((h) => h.slug === c.heroSlug)?.nameTh;
        if (!nameTh) return null;
        return (
          <div key={c.heroSlug} className="rounded-lg border border-border bg-bg-raised p-3">
            <div className="flex items-center justify-between gap-2">
              <Link to={`/heroes/${c.heroSlug}`} className="font-display text-sm font-medium hover:text-accent">
                {nameTh}
              </Link>
              <Badge>{STRENGTH_LABEL[c.strength]}</Badge>
            </div>
            <p className="mt-1.5 text-sm text-text-muted">{c.reason}</p>
            <p className="mt-1 text-xs text-text-faint">เลน: {c.laneTip}</p>
          </div>
        );
      })}
    </div>
  );
}
