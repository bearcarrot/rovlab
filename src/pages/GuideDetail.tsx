import { useParams, Link } from "react-router-dom";
import { Clock, BookOpen } from "lucide-react";
import { getGuideBySlug } from "@/services/guides";
import { useAsync } from "@/hooks/useAsync";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { Badge } from "@/components/ui/badge";
import { MOCK_HEROES } from "@/data/heroes.mock";

const DIFFICULTY_LABEL: Record<string, string> = { easy: "ง่าย", medium: "ปานกลาง", hard: "ยาก" };

export function GuideDetail() {
  const { slug = "" } = useParams();
  const guide = useAsync(() => getGuideBySlug(slug), [slug]);

  if (guide.status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (guide.status === "error") return <ErrorState message={guide.message} onRetry={guide.refetch} />;
  if (guide.status === "success" && !guide.data) {
    return <EmptyState icon={BookOpen} title="ไม่พบคู่มือนี้" description="ตรวจสอบลิงก์อีกครั้ง หรือกลับไปหน้ารายการคู่มือ" />;
  }
  if (guide.status !== "success" || !guide.data) return null;

  const g = guide.data;

  return (
    <div className="space-y-5 pb-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge>{DIFFICULTY_LABEL[g.difficulty]}</Badge>
          <span className="flex items-center gap-1 text-xs text-text-faint">
            <Clock className="h-3 w-3" /> อ่าน {g.readingMinutes} นาที
          </span>
        </div>
        <h1 className="font-display text-xl font-semibold leading-snug">{g.title}</h1>
      </div>

      <div className="space-y-3 text-sm leading-relaxed text-text-muted">
        {g.content.map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>

      {g.heroRefs.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-text-faint">ฮีโร่ที่เกี่ยวข้อง</p>
          <div className="flex flex-wrap gap-2">
            {g.heroRefs.map((slug) => {
              const hero = MOCK_HEROES.find((h) => h.slug === slug);
              if (!hero) return null;
              return (
                <Link key={slug} to={`/heroes/${slug}`} className="rounded-full border border-border bg-bg-surface px-3 py-1.5 text-xs hover:border-accent/40">
                  {hero.nameTh}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {g.isMock && <p className="text-[11px] text-text-faint">* เนื้อหาตัวอย่าง ทีมงานกำลังทยอยเพิ่มคู่มือฉบับเต็ม</p>}
    </div>
  );
}
