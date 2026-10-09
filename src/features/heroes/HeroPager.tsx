import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { HeroNeighbors } from "@/features/heroes/useHeroNeighbors";

const linkClass =
  "flex min-w-0 items-center gap-1 rounded-lg border border-border bg-bg-surface px-2 py-1.5 text-sm text-text-muted hover:bg-bg-raised hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

// ปุ่ม < > ไปฮีโร่ตัวก่อนหน้า/ถัดไป ใช้ replace เพื่อให้กดย้อนกลับครั้งเดียวกลับหน้ารายชื่อ (ไม่ไล่ย้อนทีละตัว)
// เดสก์ท็อป: กดลูกศร ซ้าย/ขวา ได้ (ไม่ดักตอนพิมพ์ในช่องกรอก หรือมี dialog เปิดอยู่ เช่นแชทโค้ช)
export function HeroPager({ neighbors, caption }: { neighbors: HeroNeighbors; caption: string }) {
  const navigate = useNavigate();
  const { prev, next } = neighbors;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === "ArrowLeft") navigate(`/heroes/${prev.slug}`, { replace: true });
      else if (e.key === "ArrowRight") navigate(`/heroes/${next.slug}`, { replace: true });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, prev.slug, next.slug]);

  return (
    <nav aria-label="เปลี่ยนฮีโร่" className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <Link
        to={`/heroes/${prev.slug}`}
        replace
        aria-label={`ฮีโร่ก่อนหน้า: ${prev.nameTh}`}
        className={`${linkClass} justify-self-start`}
      >
        <ChevronLeft aria-hidden className="h-4 w-4 shrink-0" />
        <span className="max-w-[6.5rem] truncate sm:max-w-[12rem]">{prev.nameTh}</span>
      </Link>
      <p className="text-center text-[11px] text-text-faint">{caption}</p>
      <Link
        to={`/heroes/${next.slug}`}
        replace
        aria-label={`ฮีโร่ถัดไป: ${next.nameTh}`}
        className={`${linkClass} justify-self-end`}
      >
        <span className="max-w-[6.5rem] truncate sm:max-w-[12rem]">{next.nameTh}</span>
        <ChevronRight aria-hidden className="h-4 w-4 shrink-0" />
      </Link>
    </nav>
  );
}
