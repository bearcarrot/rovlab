import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftRight, GitCompareArrows, X } from "lucide-react";
import { getHeroes, getHeroBySlug } from "@/services/heroes";
import { getMatchup } from "@/services/matchups";
import { useAsync } from "@/hooks/useAsync";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { HeroIcon } from "@/components/HeroIcon";
import { useCoachQuickChats } from "@/features/coach/CoachChatContext";
import { HeroFilterBar, useHeroFilters } from "@/features/heroes/HeroFilterBar";
import { useFilterLabels } from "@/features/heroes/HeroFilters";
import { HeroBalanceBadge } from "@/features/balance/HeroBalanceBadge";
import { StatCompare } from "@/features/matchup/StatCompare";
import { heroLanes } from "@/lib/heroPositions";
import type { HeroDetail, HeroSummary } from "@/types/hero";
import type { MatchupDetail } from "@/types/matchup";
import { cn } from "@/lib/utils";

type Slot = "a" | "b";

// ช่องแสดงฮีโร่ที่เลือก (ฮีโร่ของคุณ / ฮีโร่ศัตรู) แตะเพื่อเลือกว่าจะใส่ฮีโร่ลงช่องไหนจากกริดด้านล่าง
function HeroSlot({ label, hero, active, onSelect, onClear }: { label: string; hero: HeroSummary | null; active: boolean; onSelect: () => void; onClear: () => void }) {
  return (
    <div className={cn("flex min-w-0 flex-1 items-center gap-1 rounded-lg border p-2", active ? "border-accent bg-accent/10" : "border-border bg-bg-surface")}>
      <button type="button" onClick={onSelect} aria-pressed={active} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        {hero ? (
          <HeroIcon
            icon={hero.icon}
            name={hero.nameTh}
            fallback={hero.name.slice(0, 2).toUpperCase()}
            className="h-10 w-10 shrink-0 rounded-md border border-border"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-dashed border-border font-display text-text-faint">?</div>
        )}
        <span className="min-w-0">
          <span className={cn("block text-[11px]", active ? "text-accent" : "text-text-faint")}>{label}</span>
          <span className="block truncate text-sm">{hero ? hero.nameTh : "แตะเพื่อเลือก"}</span>
        </span>
      </button>
      {hero && (
        <button type="button" onClick={onClear} aria-label={`ล้าง${label}`} className="shrink-0 rounded p-1 text-text-faint hover:text-text">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// กริดฮีโร่อันเดียวใช้ร่วมกันทั้งสองฝั่ง: แตะฮีโร่แล้วใส่ช่องที่ active อยู่ ตัวที่อีกช่องเลือกไว้แล้วจะไม่แสดง (เลือกซ้ำกันไม่ได้เหมือนเดิม)
function HeroGrid({ heroes, slot, current, exclude, onPick }: { heroes: HeroSummary[]; slot: Slot; current: HeroSummary | null; exclude?: string; onPick: (h: HeroSummary) => void }) {
  const filters = useHeroFilters("matchup");
  const list = heroes.filter((h) => h.slug !== exclude && filters.match(h));
  return (
    <div className="min-w-0 space-y-2">
      <p className="text-xs font-medium text-text-faint">
        กำลังเลือก: <span className="text-accent">{slot === "a" ? "ฮีโร่ของคุณ" : "ฮีโร่ศัตรู"}</span>
      </p>
      <HeroFilterBar role={filters.role} lane={filters.lane} onRole={filters.setRole} onLane={filters.setLane} />
      {list.length === 0 ? (
        <p className="text-sm text-text-faint">ไม่พบฮีโร่ที่ตรงกับตัวกรอง</p>
      ) : (
        // จำกัดความสูงให้เลื่อนในกรอบ เพื่อให้ช่องเลือกและตัวกรองยังอยู่ในสายตา หน้าไม่ยาวตามจำนวนฮีโร่
        <div className="max-h-[52vh] overflow-y-auto overscroll-contain pr-1">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
            {list.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => onPick(h)}
                className={cn(
                  "flex flex-col items-center gap-1 overflow-hidden rounded-lg border p-0 pb-1 text-center",
                  current?.slug === h.slug ? "border-accent bg-accent/10" : "border-border bg-bg-surface hover:border-accent/40"
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

// ข้อมูลที่ส่งให้ Coach Ai: เฉพาะข้อมูลจริงในระบบ (สกิล สถิติ ความสัมพันธ์ชนะทาง แผนเล่นถ้ามี)
// stat เป็น null = ยังไม่มีสถิติจริง (ai-coach ถูกสั่งไม่ให้อ้างตัวเลขในกรณีนี้)
function heroContext(s: HeroSummary, d: HeroDetail | null, laneLabel: (code: string) => string) {
  return {
    name: s.nameTh,
    roles: s.roles,
    lanes: heroLanes(s).map((l) => laneLabel(l)),
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
  // ไม่มีเลนร่วม (เฉพาะผลแบบ heuristic) = ปกติสองตัวนี้ไม่เจอกันในเลนเดียว ห้ามแสดงเลนที่ไม่จริง
  const noSharedLane = m.source === "heuristic" && !lane;

  const matchupContext = {
    source:
      m.source !== "curated"
        ? "ยังไม่มีแผนเล่นเจาะจงคู่นี้ (มีเฉพาะข้อมูลสถิติด้านล่าง)"
        : reversedPlan
          ? `แผนเล่นที่ทีมงานเขียนไว้สำหรับฝั่ง ${b.nameTh} (ศัตรูของผู้เล่น) เมื่อเจอ ${a.nameTh} ไม่ใช่แผนของผู้เล่น`
          : "แผนเล่นที่ทีมงานเขียนไว้",
    lane: noSharedLane ? "ไม่มีเลนร่วมกัน (ปกติไม่ได้เจอกันในเลนเดียว)" : lane,
    difficulty: m.difficulty,
    ...(m.early ? { early: m.early } : {}),
    ...(m.mid ? { mid: m.mid } : {}),
    ...(m.late ? { late: m.late } : {}),
    ...(m.winCondition ? { winCondition: m.winCondition } : {}),
    ...(m.tips ? { tips: m.tips } : {}),
    ...(m.summary ? { summary: m.summary } : {}),
    counterNotes: notes.map((n) => ({ winner: nameOf(n.winner), loser: nameOf(n.loser), reason: n.reason, laneTip: n.laneTip })),
  };

  // FAB Coach Ai: ลงทะเบียนเมื่อโหลดสกิลของทั้งสองตัวเสร็จ (โหลดไม่สำเร็จก็ยังถามได้ แค่ไม่มีข้อมูลสกิล)
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
          * ยังไม่มีแผนเล่นเจาะจงคู่นี้ แสดงเฉพาะข้อมูลที่มีจากสถิติจริง ถาม Coach Ai เพื่อให้สรุปจากสกิลและสถิติของทั้งสองตัวได้
        </p>
      )}
      {noSharedLane && (
        <p className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-accent">
          * {a.nameTh} กับ {b.nameTh} ปกติไม่ได้เจอกันในเลนเดียวกัน ข้อมูลด้านล่างเป็นเพียงการเทียบสถิติของแต่ละตัว ไม่ใช่แมตช์อัปในเลน
        </p>
      )}
      {reversedPlan && (
        <p className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-accent">
          * แผนเล่นด้านล่างทีมงานเขียนไว้จากมุมมองของ {b.nameTh} เมื่อเจอ {a.nameTh} คือแผนของฝั่งศัตรู ใช้ดูว่าศัตรูจะเล่นอย่างไร ไม่ใช่แผนของ {a.nameTh}
        </p>
      )}
      <div className="space-y-4 rounded-card border border-border bg-bg-surface p-4 text-sm">
        <p>
          {!noSharedLane && (
            <>
              <span className="font-medium text-text">เลน: </span>
              <span className="text-text-muted">{lane}</span> ·{" "}
            </>
          )}
          <span className="font-medium text-text">ความยาก: </span>
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

// ไอคอนฮีโร่ในหัวผล Matchup (แทนชื่อ) กดแล้วไปหน้ารายละเอียดฮีโร่ ชื่ออยู่ใน aria-label/title สำหรับ screen reader และ tooltip
function MatchupHeroIcon({ hero }: { hero: HeroSummary }) {
  return (
    <Link to={`/heroes/${hero.slug}`} aria-label={hero.nameTh} title={hero.nameTh} className="shrink-0">
      <HeroIcon
        icon={hero.icon}
        name={hero.nameTh}
        fallback={hero.name.slice(0, 2).toUpperCase()}
        className="h-16 w-16 rounded-lg border border-border sm:h-20 sm:w-20"
      />
    </Link>
  );
}

export function Matchup() {
  const heroesQ = useAsync(() => getHeroes(), []);
  const [a, setA] = useState<HeroSummary | null>(null);
  const [b, setB] = useState<HeroSummary | null>(null);
  // ช่องที่กำลังเลือกจากกริด และสถานะเปิดกริดซ้ำหลังเลือกครบแล้ว (เลือกครบ = พับกริดเพื่อให้เห็นผลทันที)
  const [slot, setSlot] = useState<Slot>("a");
  const [editing, setEditing] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  // ผลอยู่ใต้กริดเลือกฮีโร่: เมื่อเลือกครบทั้งคู่ให้เลื่อนไปหาผล ไม่งั้นบนมือถือต้องเลื่อนลงมาดูเอง (เหมือนหน้า Counter Pick)
  useEffect(() => {
    if (!a || !b) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    resultRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [a?.slug, b?.slug]);

  const matchupQ = useAsync(() => (a && b ? getMatchup(a, b) : Promise.resolve(null)), [a?.slug, b?.slug]);
  // สกิลของทั้งสองตัว ใช้เป็นข้อมูลให้ Coach Ai (โหลดไม่สำเร็จก็ยังถาม Coach Ai ได้ แค่ไม่มีข้อมูลสกิล)
  const detailsQ = useAsync(
    () => (a && b ? Promise.all([getHeroBySlug(a.slug), getHeroBySlug(b.slug)]) : Promise.resolve(null)),
    [a?.slug, b?.slug]
  );
  const heroes = heroesQ.status === "success" ? heroesQ.data : [];
  const details = detailsQ.status === "success" ? detailsQ.data : null;

  const showGrid = !(a && b) || editing;

  const pick = (h: HeroSummary) => {
    if (slot === "a") setA(h);
    else setB(h);
    const otherValue = slot === "a" ? b : a;
    if (!otherValue) setSlot(slot === "a" ? "b" : "a");
    else setEditing(false);
  };
  const selectSlot = (s: Slot) => {
    setSlot(s);
    setEditing(true);
  };
  const clearSlot = (s: Slot) => {
    if (s === "a") setA(null);
    else setB(null);
    setSlot(s);
  };
  const swap = () => {
    setA(b);
    setB(a);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-semibold">Matchup</h1>
        <p className="mt-1 text-sm text-text-muted">เทียบฮีโร่สองตัวในเลนเดียวกัน เพื่อดูจังหวะได้เปรียบ-เสียเปรียบ</p>
      </div>

      {heroesQ.status === "loading" && <Skeleton className="h-48" />}
      {heroesQ.status === "error" && <ErrorState message={heroesQ.message} onRetry={heroesQ.refetch} />}
      {heroesQ.status === "success" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <HeroSlot label="ฮีโร่ของคุณ" hero={a} active={showGrid && slot === "a"} onSelect={() => selectSlot("a")} onClear={() => clearSlot("a")} />
            <button
              type="button"
              onClick={swap}
              disabled={!a || !b}
              aria-label="สลับฮีโร่ของคุณกับฮีโร่ศัตรู"
              className="shrink-0 rounded-lg border border-border bg-bg-surface p-2 text-text-faint hover:text-text disabled:opacity-40"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
            <HeroSlot label="ฮีโร่ศัตรู" hero={b} active={showGrid && slot === "b"} onSelect={() => selectSlot("b")} onClear={() => clearSlot("b")} />
          </div>
          {showGrid ? (
            <HeroGrid heroes={heroes} slot={slot} current={slot === "a" ? a : b} exclude={slot === "a" ? b?.slug : a?.slug} onPick={pick} />
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="text-xs text-accent hover:underline">
              เปลี่ยนฮีโร่
            </button>
          )}
        </div>
      )}

      {a && b && (
        <div ref={resultRef} className="scroll-mt-20 space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-center gap-4 text-center">
            <MatchupHeroIcon hero={a} />
            <GitCompareArrows className="h-5 w-5 text-accent" />
            <MatchupHeroIcon hero={b} />
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
        <EmptyState icon={GitCompareArrows} title="เลือกฮีโร่ 2 ตัวเพื่อเทียบ" description="เลือกฮีโร่ของคุณและฮีโร่ศัตรูจากกริดด้านบน" />
      )}
    </div>
  );
}
