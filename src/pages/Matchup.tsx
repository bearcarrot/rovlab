import { useState } from "react";
import { GitCompareArrows } from "lucide-react";
import { getHeroes } from "@/services/heroes";
import { getMatchup } from "@/services/matchups";
import { useAsync } from "@/hooks/useAsync";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import type { HeroSummary } from "@/types/hero";
import { cn } from "@/lib/utils";

function HeroPicker({ label, heroes, value, onChange, exclude }: { label: string; heroes: HeroSummary[]; value: HeroSummary | null; onChange: (h: HeroSummary) => void; exclude?: string }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-text-faint">{label}</p>
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-7">
        {heroes.filter((h) => h.slug !== exclude).map((h) => (
          <button
            key={h.id}
            onClick={() => onChange(h)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg border p-1.5 text-center",
              value?.slug === h.slug ? "border-accent bg-accent/10" : "border-border bg-bg-surface hover:border-accent/40"
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-bg-raised text-[10px] font-display text-text-faint">
              {h.icon ? (
    <img
      src={h.icon}
      alt={h.nameTh}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="h-full w-full object-cover"
      onError={(e) => {
        e.currentTarget.style.display = "none";
        e.currentTarget.nextElementSibling?.classList.remove("hidden");
      }}
    />
  ) : null}

  <span className={`text-2xl font-display text-text-faint ${h.icon ? "hidden" : ""}`}>
    {h.name.slice(0, 2).toUpperCase()}
  </span>
            </div>
            <span className="truncate text-[10px] leading-tight">{h.nameTh}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Matchup() {
  const heroesQ = useAsync(() => getHeroes(), []);
  const [a, setA] = useState<HeroSummary | null>(null);
  const [b, setB] = useState<HeroSummary | null>(null);
  const matchupQ = useAsync(() => (a && b ? getMatchup(a, b) : Promise.resolve(null)), [a?.slug, b?.slug]);
  const heroes = heroesQ.status === "success" ? heroesQ.data : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-semibold">Matchup</h1>
        <p className="mt-1 text-sm text-text-muted">เทียบฮีโร่สองตัวในเลนเดียวกัน เพื่อดูจังหวะได้เปรียบ-เสียเปรียบ</p>
      </div>

      {heroesQ.status === "loading" && <Skeleton className="h-48" />}
      {heroesQ.status === "error" && <ErrorState message={heroesQ.message} onRetry={heroesQ.refetch} />}
      {heroesQ.status === "success" && (
        <div className="space-y-4">
          <HeroPicker label="ฮีโร่ของคุณ" heroes={heroes} value={a} onChange={setA} exclude={b?.slug} />
          <HeroPicker label="ฮีโร่ศัตรู" heroes={heroes} value={b} onChange={setB} exclude={a?.slug} />
        </div>
      )}

      {a && b && (
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-center gap-3 text-center">
            <span className="font-display text-lg font-semibold">{a.nameTh}</span>
            <GitCompareArrows className="h-4 w-4 text-accent" />
            <span className="font-display text-lg font-semibold">{b.nameTh}</span>
          </div>

          {matchupQ.status === "loading" && <Skeleton className="h-56" />}
          {matchupQ.status === "error" && <ErrorState message={matchupQ.message} />}
          {matchupQ.status === "success" && matchupQ.data && (
            <div className="space-y-3">
              {matchupQ.data.source === "heuristic" && (
                <p className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-accent">
                  * ยังไม่มีข้อมูลเจาะจงคู่นี้ ระบบประเมินแบบ Heuristic จาก Win Rate ปัจจุบัน
                </p>
              )}
              <div className="rounded-card border border-border bg-bg-surface p-4 space-y-3 text-sm">
                <p><span className="font-medium text-text">เลน: </span><span className="text-text-muted">{matchupQ.data.lane}</span> · <span className="font-medium text-text">ความยาก: </span><span className="text-text-muted">{matchupQ.data.difficulty}</span></p>
                <div><p className="font-medium text-text">ช่วงต้นเกม</p><p className="text-text-muted">{matchupQ.data.early}</p></div>
                <div><p className="font-medium text-text">ช่วงกลางเกม</p><p className="text-text-muted">{matchupQ.data.mid}</p></div>
                <div><p className="font-medium text-text">ช่วงปลายเกม</p><p className="text-text-muted">{matchupQ.data.late}</p></div>
                <div><p className="font-medium text-text">เงื่อนไขชนะ</p><p className="text-text-muted">{matchupQ.data.winCondition}</p></div>
                <div><p className="font-medium text-text">เคล็ดลับ</p><p className="text-text-muted">{matchupQ.data.tips}</p></div>
              </div>
            </div>
          )}
        </div>
      )}

      {(!a || !b) && heroesQ.status === "success" && (
        <EmptyState icon={GitCompareArrows} title="เลือกฮีโร่ 2 ตัวเพื่อเทียบ" description="เลือกฮีโร่ของคุณและฮีโร่ศัตรูด้านบน" />
      )}
    </div>
  );
}
