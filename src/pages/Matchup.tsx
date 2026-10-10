import { useState } from "react";
import { GitCompareArrows } from "lucide-react";
import { getHeroes, getHeroBySlug } from "@/services/heroes";
import { getMatchup } from "@/services/matchups";
import { useAsync } from "@/hooks/useAsync";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { useCoachQuickChats } from "@/features/coach/CoachChatContext";
import { HeroFilterBar, useHeroFilters } from "@/features/heroes/HeroFilterBar";
import { useFilterLabels } from "@/features/heroes/HeroFilters";
import { HeroBalanceBadge } from "@/features/balance/HeroBalanceBadge";
import { StatCompare } from "@/features/matchup/StatCompare";
import type { HeroDetail, HeroSummary } from "@/types/hero";
import type { MatchupDetail } from "@/types/matchup";
import { cn } from "@/lib/utils";

function HeroPicker({ label, scope, heroes, value, onChange, exclude }: { label: string; scope: string; heroes: HeroSummary[]; value: HeroSummary | null; onChange: (h: HeroSummary) => void; exclude?: string }) {
  // ตัวกรองแยกต่อ picker เพื่อให้เลือกเช่น "เมจของเรา vs แอแซสซินศัตรู" ได้ (scope แยกกัน จึงจำค่าแยกกันด้วย)
  const filters = useHeroFilters(scope);
  const list = heroes.filter((h) => h.slug !== exclude && filters.match(h));
  return (
    <div className="min-w-0 space-y-2">
      <p className="text-xs font-medium text-text-faint">
        {label}
        {value && <span className="ml-2 text-accent">เลือกอยู่: {value.nameTh}</span>}
      </p>
      <HeroFilterBar role={filters.role} lane={filters.lane} onRole={filters.setRole} onLane={filters.setLane} />
      {list.length === 0 ? (
        <p className="text-sm text-text-faint">ไม่พบฮีโร่ที่ตรงกับตัวกรอง</p>
      ) : (
        // lg+ วาง picker สองฝั่งคู่กัน เลยลดจำนวนคอลัมน์ต่อฝั่งลง
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-5 xl:grid-cols-6">
          {list.map((h) => (
            <button
              key={h.id}
              onClick={() => onChange(h)}
              className={cn(
                "flex flex-col items-center gap-1 overflow-hidden rounded-lg border p-0 pb-1 text-center",
                value?.slug === h.slug ? "border-accent bg-accent/10" : "border-border bg-bg-surface hover:border-accent/40"
              )}
            >
              <div className="relative flex aspect-square w-full items-center justify-center bg-bg-raised text-xs font-display text-text-faint">
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

                <span className={`text-sm font-display text-text-faint sm:text-base ${h.icon ? "hidden" : ""}`}>
                  {h.name.slice(0, 2).toUpperCase()}
                </span>
                <HeroBalanceBadge heroId={h.id} size="md" inside />
              </div>
              <span className="w-full truncate px-1 text-[11px] leading-tight sm:text-xs">{h.nameTh}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// หัวข้อที่ไม่มีข้อความจะไม่แสดง (ข้อมูลคู่นี้ยังไม่ครบ ไม่ต้องขึ้นว่า "ยังไม่มีข้อมูล" ซ้ำทุกหัวข้อ)
function Section({ title, text }: { title: string; text: string }) {
  if (!text.trim()) return null;
  return (
    <div>
      <p className="font-medium text-text">{title}</p>
      <p className="whitespace-pre-line text-text-muted">{text}</p>
    </div>
  );
}

// เลนในผล Matchup อาจเป็นรหัส (heuristic: "mid" หรือ "mid/jungle") หรือข้อความที่แอดมินกรอก (curated: "Mid")
// แปลงรหัสเป็นชื่อเลนจาก DB (hero_lanes.label) ถ้าไม่ใช่รหัสที่รู้จักให้แสดงตามที่เก็บไว้
function formatLane(raw: string, laneLabel: (code: string) => string): string {
  return raw
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const code = p.toLowerCase();
      const label = laneLabel(code);
      return label === code ? p : label;
    })
    .join(" / ");
}

// ข้อมูลที่ส่งให้ Coach AI: เฉพาะข้อมูลจริงในระบบ (สกิล สถิติ ความสัมพันธ์ชนะทาง แผนเล่นถ้ามี)
// stat เป็น null = ยังไม่มีสถิติจริง (ai-coach ถูกสั่งไม่ให้อ้างตัวเลขในกรณีนี้)
function heroContext(s: HeroSummary, d: HeroDetail | null, laneLabel: (code: string) => string) {
  return {
    name: s.nameTh,
    roles: s.roles,
    lanes: s.lanes.map((l) => laneLabel(l)),
    difficulty: s.difficulty,
    stat: s.stat.hasStats
      ? { patch: s.stat.patch, winRate: s.stat.winRate, pickRate: s.stat.pickRate, banRate: s.stat.banRate, tier: s.stat.tier, matches: s.stat.matches }
      : null,
    abilities: (d?.abilities ?? []).slice(0, 6).map((x) => ({
      slot: x.slot,
      name: x.name,
      description: (x.description ?? "").slice(0, 120),
    })),
  };
}

function MatchupResult({ a, b, m, coachReady, detailA, detailB }: { a: HeroSummary; b: HeroSummary; m: MatchupDetail; coachReady: boolean; detailA: HeroDetail | null; detailB: HeroDetail | null }) {
  const { laneLabel } = useFilterLabels();
  const nameOf = (slug: string) => (slug === a.slug ? a.nameTh : b.nameTh);
  const lane = formatLane(m.lane, laneLabel);
  const notes = m.counterNotes ?? [];
  // มีสถิติของทั้งสองตัว → แสดงเป็นแถบเปรียบเทียบ (แทนข้อความสรุป Win Rate ที่ซ้ำกัน)
  const showBars = a.stat.hasStats && b.stat.hasStats;
  const hasPlan = [m.early, m.mid, m.late, m.winCondition, m.tips].some((t) => t.trim());
  // แผนที่เก็บไว้ทิศ B vs A เขียนจากมุมมองของ B (ฝั่งศัตรูของผู้ใช้) ไม่ใช่มุมมองของ A ที่ผู้ใช้เลือก
  const reversedPlan = hasPlan && !!m.planFor && m.planFor !== a.slug;
  const hasAnything = hasPlan || showBars || !!m.summary || notes.length > 0;

  const matchupContext = {
    source:
      m.source !== "curated"
        ? "ยังไม่มีแผนเล่นเจาะจงคู่นี้ (มีเฉพาะข้อมูลสถิติด้านล่าง)"
        : reversedPlan
          ? `แผนเล่นที่ทีมงานเขียนไว้สำหรับฝั่ง ${b.nameTh} (ศัตรูของผู้เล่น) เมื่อเจอ ${a.nameTh} ไม่ใช่แผนของผู้เล่น`
          : "แผนเล่นที่ทีมงานเขียนไว้",
    lane,
    difficulty: m.difficulty,
    ...(m.early ? { early: m.early } : {}),
    ...(m.mid ? { mid: m.mid } : {}),
    ...(m.late ? { late: m.late } : {}),
    ...(m.winCondition ? { winCondition: m.winCondition } : {}),
    ...(m.tips ? { tips: m.tips } : {}),
    ...(m.summary ? { summary: m.summary } : {}),
    counterNotes: notes.map((n) => ({ winner: nameOf(n.winner), loser: nameOf(n.loser), reason: n.reason, laneTip: n.laneTip })),
  };

  // FAB โค้ช AI: ลงทะเบียนเมื่อโหลดสกิลของทั้งสองตัวเสร็จ (โหลดไม่สำเร็จก็ยังถามได้ แค่ไม่มีข้อมูลสกิล)
  useCoachQuickChats(
    coachReady
      ? [
          {
            id: "matchup-plan",
            label: "แผนเล่นคู่นี้",
            prompt: `ผู้เล่นใช้ ${a.nameTh} เจอ ${b.nameTh} สรุปแผนเล่นที่ควรทำ 3-4 ประโยค อ้างอิงจากสกิล สถิติ และข้อมูลชนะทางที่ให้เท่านั้น ถ้าข้อมูลส่วนไหนไม่พอให้บอกตรงๆ`,
            context: { me: heroContext(a, detailA, laneLabel), enemy: heroContext(b, detailB, laneLabel), matchup: matchupContext },
          },
        ]
      : [],
    `${a.slug}-${b.slug}`,
  );

  return (
    <div className="space-y-3">
      {m.source === "heuristic" && (
        <p className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-accent">
          * ยังไม่มีแผนเล่นเจาะจงคู่นี้ แสดงเฉพาะข้อมูลที่มีจากสถิติจริง ถามโค้ช AI เพื่อให้สรุปจากสกิลและสถิติของทั้งสองตัวได้
        </p>
      )}
      {reversedPlan && (
        <p className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-accent">
          * แผนเล่นด้านล่างทีมงานเขียนไว้จากมุมมองของ {b.nameTh} เมื่อเจอ {a.nameTh} คือแผนของฝั่งศัตรู ใช้ดูว่าศัตรูจะเล่นอย่างไร ไม่ใช่แผนของ {a.nameTh}
        </p>
      )}
      <div className="space-y-4 rounded-card border border-border bg-bg-surface p-4 text-sm">
        <p>
          <span className="font-medium text-text">เลน: </span>
          <span className="text-text-muted">{lane}</span> · <span className="font-medium text-text">ความยาก: </span>
          <span className="text-text-muted">{m.difficulty}</span>
        </p>

        {showBars && <StatCompare a={a} b={b} />}

        {notes.length > 0 && (
          <div>
            <p className="font-medium text-text">ชนะทางกันตามสถิติแรงค์จริง</p>
            <ul className="mt-1 space-y-1 text-text-muted">
              {notes.map((n, i) => (
                <li key={i}>
                  <span className="text-text">{nameOf(n.winner)}</span> ชนะทาง <span className="text-text">{nameOf(n.loser)}</span>
                  {n.reason ? ` — ${n.reason}` : ""}
                  {n.laneTip ? ` · ${n.laneTip}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
        {!showBars && <Section title="สถิติรวม" text={m.summary ?? ""} />}
        <Section title="ช่วงต้นเกม" text={m.early} />
        <Section title="ช่วงกลางเกม" text={m.mid} />
        <Section title="ช่วงปลายเกม" text={m.late} />
        <Section title="เงื่อนไขชนะ" text={m.winCondition} />
        <Section title="เคล็ดลับ" text={m.tips} />

        {!hasAnything && <p className="text-text-muted">ยังไม่มีข้อมูลเฉพาะคู่นี้ในระบบ</p>}
      </div>
    </div>
  );
}

export function Matchup() {
  const heroesQ = useAsync(() => getHeroes(), []);
  const [a, setA] = useState<HeroSummary | null>(null);
  const [b, setB] = useState<HeroSummary | null>(null);
  const matchupQ = useAsync(() => (a && b ? getMatchup(a, b) : Promise.resolve(null)), [a?.slug, b?.slug]);
  // สกิลของทั้งสองตัว ใช้เป็นข้อมูลให้ Coach AI (โหลดไม่สำเร็จก็ยังถามโค้ชได้ แค่ไม่มีข้อมูลสกิล)
  const detailsQ = useAsync(
    () => (a && b ? Promise.all([getHeroBySlug(a.slug), getHeroBySlug(b.slug)]) : Promise.resolve(null)),
    [a?.slug, b?.slug]
  );
  const heroes = heroesQ.status === "success" ? heroesQ.data : [];
  const details = detailsQ.status === "success" ? detailsQ.data : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-semibold">Matchup</h1>
        <p className="mt-1 text-sm text-text-muted">เทียบฮีโร่สองตัวในเลนเดียวกัน เพื่อดูจังหวะได้เปรียบ-เสียเปรียบ</p>
      </div>

      {heroesQ.status === "loading" && <Skeleton className="h-48" />}
      {heroesQ.status === "error" && <ErrorState message={heroesQ.message} onRetry={heroesQ.refetch} />}
      {heroesQ.status === "success" && (
        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          <HeroPicker label="ฮีโร่ของคุณ" scope="mine" heroes={heroes} value={a} onChange={setA} exclude={b?.slug} />
          <HeroPicker label="ฮีโร่ศัตรู" scope="enemy" heroes={heroes} value={b} onChange={setB} exclude={a?.slug} />
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
          {matchupQ.status === "error" && <ErrorState message={matchupQ.message} onRetry={matchupQ.refetch} />}
          {matchupQ.status === "success" && matchupQ.data && (
            <MatchupResult
              a={a}
              b={b}
              m={matchupQ.data}
              coachReady={detailsQ.status !== "loading"}
              detailA={details ? details[0] : null}
              detailB={details ? details[1] : null}
            />
          )}
        </div>
      )}

      {(!a || !b) && heroesQ.status === "success" && (
        <EmptyState icon={GitCompareArrows} title="เลือกฮีโร่ 2 ตัวเพื่อเทียบ" description="เลือกฮีโร่ของคุณและฮีโร่ศัตรูด้านบน" />
      )}
    </div>
  );
}
