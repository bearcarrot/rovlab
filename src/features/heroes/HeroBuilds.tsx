import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Hammer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { ReadOnlyBuild } from "@/features/build/buildView";
import { BuildCard } from "@/features/build/BuildCard";
import { toViewBuild } from "@/features/build/toViewBuild";
import { useAsync } from "@/hooks/useAsync";
import { listCommunityBuilds } from "@/services/userBuilds";
import { Chip } from "./HeroFilters";
import type { HeroBuildsState } from "./useHeroBuilds";

const dateTh = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "");

type BuildTab = "recommended" | "community";
const BUILD_TABS: [BuildTab, string][] = [
  ["recommended", "Build แนะนำ"],
  ["community", "Community"],
];

type BuildHero = { id: string; slug: string; nameTh: string };

// Community Build ของฮีโร่ตัวนี้ — การ์ดเดียวกับหน้า Item Build (แท็บ Community)
function HeroCommunityBuilds({ hero }: { hero: BuildHero }) {
  const q = useAsync(() => listCommunityBuilds(hero.id), [hero.id]);
  return (
    <div className="space-y-3">
      {q.status === "loading" && <Skeleton className="h-32" />}
      {q.status === "error" && <ErrorState message={q.message} onRetry={q.refetch} />}
      {q.status === "success" && q.data.length === 0 && (
        <EmptyState icon={Hammer} title="ยังไม่มี Community Build" description="สร้างบิลด์ของคุณแล้วเผยแพร่เป็นคนแรกของฮีโร่ตัวนี้" />
      )}
      {q.status === "success" && q.data.length > 0 && (
        <div className="space-y-3">{q.data.map((b) => <BuildCard key={b.id} b={b} showHero={false} />)}</div>
      )}
      <p className="flex flex-wrap gap-x-4 gap-y-1">
        <Link to={`/build?hero=${hero.slug}&tab=community`} className="text-sm text-accent hover:underline">ดูที่หน้า Item Build →</Link>
        <Link to={`/build/edit/new?hero=${hero.slug}`} className="text-sm text-accent hover:underline">สร้างบิลด์ {hero.nameTh} →</Link>
      </p>
    </div>
  );
}

// บิลด์ของฮีโร่บนหน้า Hero Detail — chip สลับระหว่าง Build แนะนำ (ตาราง item_builds*) และ Community Build (ไม่ปนกัน)
export function HeroBuilds({ hero, state }: { hero: BuildHero; state: HeroBuildsState }) {
  const { q, data, selected, index, setIndex } = state;
  const [tab, setTab] = useState<BuildTab>("recommended");
  const view = useMemo(() => (data && selected ? toViewBuild(selected, data.items, true) : null), [data, selected]);

  const itemBuildHref = `/build?hero=${hero.slug}`;
  const linkCls = "text-sm text-accent hover:underline";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Hammer className="h-4 w-4 text-accent" />
          <CardTitle>บิลด์ {hero.nameTh}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="หมวดบิลด์">
          {BUILD_TABS.map(([t, label]) => (
            <Chip key={t} active={tab === t} onClick={() => setTab(t)} label={label} />
          ))}
        </div>

        {tab === "community" && <HeroCommunityBuilds hero={hero} />}

        {tab === "recommended" && (
          <>
            {q.status === "loading" && <Skeleton className="h-48" />}
            {q.status === "error" && <ErrorState message={q.message} onRetry={q.refetch} />}

            {q.status === "success" && data && data.builds.length === 0 && (
              <p className="text-sm text-text-faint">
                ยังไม่มีบิลด์แนะนำของฮีโร่นี้ในระบบ ·{" "}
                <button type="button" onClick={() => setTab("community")} className="text-accent hover:underline">ดู Community Build</button>
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
