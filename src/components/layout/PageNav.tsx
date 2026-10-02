import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type Crumb = { label: string; to?: string };

export function PageNav({ crumbs, fallback = "/" }: { crumbs: Crumb[]; fallback?: string }) {
  const navigate = useNavigate();

  function goBack() {
    // idx > 0 = มีหน้าก่อนหน้าในแอปเรา (กันเปิดลิงก์ตรงแล้วย้อนออกนอกเว็บ)
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate(fallback);
  }

  return (
    <div className="mb-4 flex items-center gap-2">
      <button
        type="button"
        onClick={goBack}
        aria-label="ย้อนกลับ"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-bg-surface text-text-muted hover:text-text"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="no-scrollbar flex items-center gap-1 overflow-x-auto whitespace-nowrap text-xs text-text-faint">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <li key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
                {c.to && !last ? (
                  <Link to={c.to} className="hover:text-text">{c.label}</Link>
                ) : (
                  <span aria-current={last ? "page" : undefined} className={last ? "max-w-[50vw] truncate text-text-muted" : ""}>
                    {c.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
