import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Clock } from "lucide-react";
import { getGuides, getGuideCategories } from "@/services/guides";
import { useAsync } from "@/hooks/useAsync";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const DIFFICULTY_LABEL: Record<string, string> = { easy: "ง่าย", medium: "ปานกลาง", hard: "ยาก" };

export function Learn() {
  const guidesQ = useAsync(() => getGuides(), []);
  const categoriesQ = useAsync(() => getGuideCategories(), []);
  const [category, setCategory] = useState<string | null>(null);

  const categories = categoriesQ.status === "success" ? categoriesQ.data : [];
  const filtered = useMemo(() => {
    if (guidesQ.status !== "success") return [];
    return guidesQ.data.filter((g) => category === null || g.categorySlug === category);
  }, [guidesQ, category]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold">คู่มือ</h1>
        <p className="mt-1 text-sm text-text-muted">บทเรียน Macro, Micro, การเล่นเลน, Objective และการดราฟต์</p>
      </div>

      {categoriesQ.status === "success" && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setCategory(null)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
              category === null ? "border-accent bg-accent text-accent-fg" : "border-border bg-bg-surface text-text-muted"
            )}
          >
            ทั้งหมด
          </button>
          {categories.map((c) => (
            <button
              key={c.slug}
              onClick={() => setCategory(category === c.slug ? null : c.slug)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
                category === c.slug ? "border-accent bg-accent text-accent-fg" : "border-border bg-bg-surface text-text-muted"
              )}
            >
              {c.nameTh}
            </button>
          ))}
        </div>
      )}

      {guidesQ.status === "loading" && (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      )}
      {guidesQ.status === "error" && <ErrorState message={guidesQ.message} onRetry={guidesQ.refetch} />}
      {guidesQ.status === "success" && filtered.length === 0 && (
        <EmptyState icon={BookOpen} title="ยังไม่มีคู่มือในหมวดนี้" description="ลองเลือกหมวดอื่น" />
      )}
      {guidesQ.status === "success" && filtered.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((g) => (
            <Link
              key={g.id}
              to={`/learn/${g.slug}`}
              className="block rounded-card border border-border bg-bg-surface p-4 hover:border-accent/40"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-display text-sm font-medium leading-snug">{g.title}</p>
                {g.difficulty && (
                  <Badge difficulty={g.difficulty} className="shrink-0">
                    {DIFFICULTY_LABEL[g.difficulty]}
                  </Badge>
                )}
              </div>
              <p className="mt-1.5 text-sm text-text-muted">{g.excerpt}</p>
              <p className="mt-2 flex items-center gap-1 text-xs text-text-faint">
                <Clock className="h-3 w-3" /> อ่าน {g.readingMinutes} นาที
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
