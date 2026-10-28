import { ChevronLeft, ChevronRight } from "lucide-react";
import { pageCount } from "./paginate";

const btn =
  "inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-border bg-bg-surface px-4 py-2 text-sm font-medium text-text hover:border-accent/40 disabled:pointer-events-none disabled:opacity-40";

/** Previous / next for the saved-matches list. Renders nothing when everything fits on one page. */
export function MatchPager({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  const pages = pageCount(total);
  if (pages <= 1) return null;
  return (
    <nav aria-label="เลือกหน้ารายการแมตช์" className="flex items-center justify-between gap-2">
      <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ChevronLeft className="h-4 w-4" />
        ก่อนหน้า
      </button>
      <span className="text-center text-xs text-text-muted" aria-live="polite">
        หน้า {page} จาก {pages} · {total} แมตช์
      </span>
      <button type="button" className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)}>
        ถัดไป
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
