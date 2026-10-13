import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Hammer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { ReadOnlyBuild } from "@/features/build/buildView";
import { toViewBuild } from "@/features/build/toViewBuild";
import { Chip } from "./HeroFilters";
import type { HeroBuildsState } from "./useHeroBuilds";

const dateTh = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "");

// บิลด์แนะนำของฮีโร่บนหน้า Hero Detail — ข้อมูลชุดเดียวกับหน้า Item Build (ตาราง item_builds*) ไม่ปนกับ Community Build
export function HeroBuilds({ hero, state }: { hero: { slug: string; nameTh: string }; state: HeroBuildsState }) {
  const { q, data, selected, index, setIndex } = state;
  const view = useMemo(() => (data && selected ? toViewBuild(selected, data.items, true) : null), [data, selected]);

  const itemBuildHref = `/build?hero=${hero.slug}`;
  const linkCls = "text-sm text-accent hover:underline";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Hammer className="h-4 w-4 text-accent" />
          <CardTitle>บิลด์แนะนำ {hero.nameTh}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {q.status === "loading" && <Skeleton className="h-48" />}
        {q.status === "error" && <ErrorState message={q.message} onRetry={q.refetch} />}

        {q.status === "success" && data && data.builds.length === 0 && (
          <p className="text-sm text-text-faint">
            ยังไม่มีบิลด์แนะนำของฮีโร่นี้ในระบบ ·{" "}
            <Link to={`${itemBuildHref}&tab=community`} className="text-accent hover:underline">ดู Community Build</Link>
          </p>
        )}

        {q.status === "success" && data && selected && view && (
          <>
            {data.builds.length > 1 && (
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="เลือกบิลด์">
                {data.builds.map((b, i) => (
                  <Chip key={b.id ?? i} active={i === index} onClick={() => setIndex(i)} label={`บิลด์ ${i + 1} · Patch ${b.patch}`} />
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-text-muted">
              <span className="rounded-full border border-accent/40 px-2 py-0.5 text-accent">
                {selected.source === "curated" ? "บิลด์ทีมงาน RoV LAB" : "แนวทางทั่วไป (Heuristic)"}
              </span>
              <span className="rounded-full border border-border px-2 py-0.5">Patch {selected.patch}</span>
              {selected.createdAt && <span>บันทึกเมื่อ {dateTh(selected.createdAt)}</span>}
            </div>

            {/* ห้ามเรียกบิลด์ที่เก่ากว่าแพตช์ปัจจุบันว่าเมต้าล่าสุด */}
            {data.latestPatch && selected.patch !== data.latestPatch && (
              <p className="flex items-start gap-1.5 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-accent">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>บิลด์นี้อ้างอิง Patch {selected.patch} แต่แพตช์ล่าสุดคือ {data.latestPatch} อาจยังไม่ตรงกับเมต้าปัจจุบัน</span>
              </p>
            )}

            <ReadOnlyBuild build={view} />
            <p className="flex flex-wrap gap-x-4 gap-y-1">
              <Link to={itemBuildHref} className={linkCls}>ดูรายละเอียดที่หน้า Item Build →</Link>
              <Link to={`${itemBuildHref}&tab=community`} className={linkCls}>Community Build →</Link>
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
