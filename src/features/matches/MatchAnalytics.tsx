import { useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { RotateCcw } from "lucide-react";
import {
  COMPARE_SIZE,
  DEFAULT_FILTERS,
  MIN_GAMES_FOR_INSIGHTS,
  MIN_HERO_GAMES,
  MIN_TREND_POINTS,
  SMALL_SAMPLE,
  STAT_WINDOW,
  WIN_WINDOW,
  applyFilters,
  buildInsights,
  byHero,
  compare,
  heroOptions,
  sortHeroes,
  summarize,
  trends,
  type Delta,
  type Filters,
  type HeroSort,
  type RangePreset,
  type TrendPoint,
} from "./stats";
import { ImageSelect, type ImgOpt } from "@/features/admin/ImageSelect";
import { cn } from "@/lib/utils";
import type { MatchRecord } from "@/types/match";

const RANGES: { value: RangePreset; label: string }[] = [
  { value: "all", label: "ทั้งหมดที่บันทึก" },
  { value: "last10", label: "10 แมตช์ล่าสุด" },
  { value: "last20", label: "20 แมตช์ล่าสุด" },
  { value: "days7", label: "7 วัน" },
  { value: "days30", label: "30 วัน" },
];

const SORTS: { value: HeroSort; label: string }[] = [
  { value: "games", label: "เล่นบ่อย" },
  { value: "winRate", label: "ชนะสูง" },
  { value: "kda", label: "KDA สูง" },
];

const HERO_PREVIEW = 8; // hero cards shown before "ดูทั้งหมด" (2 columns x 4 rows on a phone)

const pct = (x: number) => `${Math.round(x * 100)}%`;
const fmtDate = (s: string) => {
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString("th-TH", { day: "numeric", month: "short" }) : "—";
};

// Same size as the chips on the other pages (HeroFilters Chip, Stats metric chips).
const chip = (active: boolean) =>
  cn(
    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
    active ? "border-accent bg-accent text-accent-fg" : "border-border bg-bg-surface text-text-muted hover:text-text"
  );

export function MatchAnalytics({
  matches,
  iconById,
  loadLimit,
}: {
  matches: MatchRecord[]; // newest first, as loaded
  iconById: Map<string, string>;
  loadLimit: number;
}) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [heroSort, setHeroSort] = useState<HeroSort>("games");
  const [showAllHeroes, setShowAllHeroes] = useState(false);

  const options = useMemo(() => heroOptions(matches), [matches]);
  // ตัวเลือกของ dropdown ฮีโร่ (แสดงไอคอน + ชื่อ + จำนวนเกม; ค้นหาได้เมื่อมีฮีโร่มากกว่า 8 ตัว)
  const heroImgOptions = useMemo<ImgOpt[]>(
    () =>
      options.map((o) => ({
        id: o.key,
        label: `${o.heroName} (${o.games})`,
        alt: o.heroName,
        icon: o.heroId ? iconById.get(o.heroId) : undefined,
      })),
    [options, iconById]
  );
  // A hero that disappeared (its matches were deleted) must not leave the page stuck on an empty filter.
  const activeFilters = useMemo<Filters>(
    () => (filters.heroKey && !options.some((o) => o.key === filters.heroKey) ? { ...filters, heroKey: null } : filters),
    [filters, options]
  );
  const filtered = useMemo(() => applyFilters(matches, activeFilters), [matches, activeFilters]);
  const summary = useMemo(() => summarize(filtered), [filtered]);
  const tr = useMemo(() => trends(filtered), [filtered]);
  const cmp = useMemo(() => compare(filtered), [filtered]);
  const insights = useMemo(() => buildInsights(filtered, Number.POSITIVE_INFINITY), [filtered]);
  // Hero table ignores the hero filter (it is the hero breakdown) but follows the time range.
  const heroLines = useMemo(
    () => sortHeroes(byHero(applyFilters(matches, { ...activeFilters, heroKey: null })), heroSort),
    [matches, activeFilters, heroSort]
  );
  const shownHeroes = showAllHeroes ? heroLines : heroLines.slice(0, HERO_PREVIEW);

  const isFiltered = activeFilters.range !== "all" || activeFilters.heroKey !== null;
  const reset = () => setFilters(DEFAULT_FILTERS);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <section aria-label="ตัวกรองสถิติ" className="space-y-3">
        <div role="group" aria-label="ช่วงเวลา" className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              aria-pressed={activeFilters.range === r.value}
              onClick={() => setFilters({ ...activeFilters, range: r.value })}
              className={chip(activeFilters.range === r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <div role="group" aria-label="ฮีโร่" className="min-w-0 flex-1 sm:max-w-xs">
            <ImageSelect
              value={activeFilters.heroKey ?? ""}
              options={heroImgOptions}
              onChange={(id) => setFilters({ ...activeFilters, heroKey: id || null })}
              placeholder="ทุกฮีโร่"
            />
          </div>
          {isFiltered && (
            <button
              type="button"
              onClick={reset}
              className="flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-bg-surface px-3 text-xs text-text-muted hover:text-text"
            >
              <RotateCcw className="h-3.5 w-3.5" /> ล้างตัวกรอง
            </button>
          )}
        </div>
        <p className="text-xs text-text-faint" aria-live="polite">
          {filtered.length} จาก {matches.length} แมตช์
          {matches.length >= loadLimit && ` · โหลดเฉพาะ ${loadLimit} แมตช์ล่าสุด`}
        </p>
      </section>

      {!summary ? (
        <div className="rounded-card border border-dashed border-border p-6 text-center text-sm text-text-muted">
          ไม่มีแมตช์ที่ตรงเงื่อนไขนี้
          {isFiltered && (
            <button type="button" onClick={reset} className="ml-2 min-h-11 text-accent underline underline-offset-2">
              ล้างตัวกรอง
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Overview */}
          <section aria-labelledby="summary-heading" className="space-y-3">
            <h2 id="summary-heading" className="font-display text-base font-semibold">สรุป {summary.games} แมตช์</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="อัตราชนะ" value={pct(summary.winRate)} sub={`${summary.wins} ชนะ / ${summary.games - summary.wins} แพ้ (${summary.games} เกม)`} />
              <Stat label="KDA เฉลี่ย" value={summary.kda.toFixed(2)} sub={`${summary.avgKills.toFixed(1)} / ${summary.avgDeaths.toFixed(1)} / ${summary.avgAssists.toFixed(1)}`} />
              <Stat label="ทองเฉลี่ย" value={Math.round(summary.avgGold).toLocaleString()} sub={`${summary.games} เกม`} />
              <Stat label="คะแนนเฉลี่ย" value={summary.avgRating.toFixed(1)} sub={`MVP ${summary.mvpCount} ครั้ง · ${summary.games} เกม`} />
            </div>
            {summary.games < SMALL_SAMPLE && (
              <p className="text-xs text-text-faint">มีเพียง {summary.games} แมตช์ ตัวเลขนี้ยังบอกฝีมือในระยะยาวไม่ได้</p>
            )}
          </section>

          {/* Trends */}
          <section aria-labelledby="trend-heading" className="space-y-3">
            <h2 id="trend-heading" className="font-display text-base font-semibold">แนวโน้ม</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <TrendChart
                title="อัตราชนะ"
                caption={`เฉลี่ยทุก ${WIN_WINDOW} แมตช์ล่าสุด`}
                points={tr.winRate}
                need={WIN_WINDOW + MIN_TREND_POINTS - 1}
                games={tr.games}
                format={pct}
                fixed={[0, 1]}
              />
              <TrendChart
                title="KDA"
                caption={`เฉลี่ยทุก ${STAT_WINDOW} แมตช์ล่าสุด`}
                points={tr.kda}
                need={STAT_WINDOW + MIN_TREND_POINTS - 1}
                games={tr.games}
                format={(v) => v.toFixed(2)}
              />
              <TrendChart
                title="คะแนนแมตช์"
                caption={`เฉลี่ยทุก ${STAT_WINDOW} แมตช์ล่าสุด`}
                points={tr.rating}
                need={STAT_WINDOW + MIN_TREND_POINTS - 1}
                games={tr.games}
                format={(v) => v.toFixed(1)}
              />
            </div>
          </section>

          {/* Comparison */}
          <section aria-labelledby="cmp-heading" className="space-y-3">
            <h2 id="cmp-heading" className="font-display text-base font-semibold">เทียบช่วงล่าสุดกับช่วงก่อนหน้า</h2>
            {!cmp ? (
              <p className="text-sm text-text-muted">
                ต้องมีอย่างน้อย {COMPARE_SIZE * 2} แมตช์ในเงื่อนไขที่เลือก ({COMPARE_SIZE} ล่าสุด เทียบกับ {COMPARE_SIZE} ก่อนหน้า) ตอนนี้มี {filtered.length}
              </p>
            ) : (
              <div className="space-y-2 rounded-card border border-border bg-bg-surface p-3">
                <div className="grid grid-cols-[1.2fr_1fr_1fr_1.1fr] gap-2 text-[11px] text-text-faint">
                  <span />
                  <span>ก่อนหน้า</span>
                  <span>ล่าสุด</span>
                  <span>เปลี่ยน</span>
                </div>
                <CmpRow label="อัตราชนะ" d={cmp.winRate} fmt={pct} scale={100} digits={0} unit=" จุด" better="up" />
                <CmpRow label="KDA" d={cmp.kda} fmt={(v) => v.toFixed(2)} digits={2} better="up" />
                <CmpRow label="ตายเฉลี่ย" d={cmp.deaths} fmt={(v) => v.toFixed(1)} digits={1} better="down" />
                <CmpRow label="ทองเฉลี่ย" d={cmp.gold} fmt={(v) => Math.round(v).toLocaleString()} digits={0} better={null} />
                <CmpRow label="คะแนนเฉลี่ย" d={cmp.rating} fmt={(v) => v.toFixed(1)} digits={1} better="up" />
                <p className="pt-1 text-[11px] leading-relaxed text-text-faint">
                  ก่อนหน้า {cmp.size} เกม ({fmtDate(cmp.previousRange[0])}–{fmtDate(cmp.previousRange[1])}) · ล่าสุด {cmp.size} เกม (
                  {fmtDate(cmp.recentRange[0])}–{fmtDate(cmp.recentRange[1])})
                  <br />
                  * เทียบตัวเลขเฉยๆ ไม่ได้ยืนยันว่าฝีมือดีขึ้นหรือแย่ลง ผลอาจมาจากฮีโร่ บทบาท ทีม และปัจจัยอื่นที่สกอร์บอร์ดไม่ได้บันทึก
                </p>
              </div>
            )}
          </section>

          {/* Heroes */}
          <section aria-labelledby="hero-heading" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="hero-heading" className="font-display text-base font-semibold">ฮีโร่ที่เล่น</h2>
              <div role="group" aria-label="เรียงตาม" className="flex gap-2">
                {SORTS.map((s) => (
                  <button key={s.value} type="button" aria-pressed={heroSort === s.value} onClick={() => setHeroSort(s.value)} className={chip(heroSort === s.value)}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {shownHeroes.map((h) => {
                const icon = h.heroId ? iconById.get(h.heroId) : undefined;
                const active = activeFilters.heroKey === h.key;
                const low = h.games < MIN_HERO_GAMES;
                return (
                  <li key={h.key}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setFilters({ ...activeFilters, heroKey: active ? null : h.key })}
                      className={cn(
                        "flex h-full w-full flex-col gap-1.5 rounded-card border bg-bg-surface p-2 text-left hover:bg-bg-raised",
                        active ? "border-accent bg-accent/10" : "border-border"
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {icon ? (
                          <img src={icon} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-8 w-8 shrink-0 rounded object-cover" />
                        ) : (
                          <span className="h-8 w-8 shrink-0 rounded bg-bg-raised" />
                        )}
                        <span className="truncate text-sm font-medium">{h.heroName}</span>
                      </span>
                      <span className="flex items-baseline justify-between text-xs tabular-nums">
                        <span className="text-text-muted">{h.games} เกม</span>
                        <span className="font-medium">
                          {pct(h.winRate)}
                          {low ? " *" : ""}
                        </span>
                      </span>
                      <span className="text-[11px] tabular-nums text-text-faint">
                        {h.wins}ช/{h.games - h.wins}พ · KDA {h.kda.toFixed(1)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {heroLines.length > HERO_PREVIEW && (
              <button
                type="button"
                onClick={() => setShowAllHeroes((v) => !v)}
                className="mx-auto block rounded-full border border-border bg-bg-surface px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text"
              >
                {showAllHeroes ? "แสดงน้อยลง" : `ดูทั้งหมด (${heroLines.length})`}
              </button>
            )}
            <p className="text-[11px] text-text-faint">
              * เล่นน้อยกว่า {MIN_HERO_GAMES} เกม อัตราชนะยังไม่น่าเชื่อถือ (เรียงไว้ท้ายตารางเมื่อเรียงตามอัตราชนะ/KDA) แตะการ์ดเพื่อกรองดูเฉพาะฮีโร่นั้น
            </p>
          </section>

          {/* Insights */}
          <section aria-labelledby="insights-heading" className="space-y-3">
            <h2 id="insights-heading" className="font-display text-base font-semibold">ข้อสังเกตจากแมตช์ของคุณ</h2>
            {filtered.length < MIN_GAMES_FOR_INSIGHTS ? (
              <p className="text-sm text-text-muted">
                ต้องมีอย่างน้อย {MIN_GAMES_FOR_INSIGHTS} แมตช์ในเงื่อนไขที่เลือก (ตอนนี้ {filtered.length}) ข้อมูลน้อยเกินไปจะทำให้สรุปผิด
              </p>
            ) : insights.length === 0 ? (
              <p className="text-sm text-text-muted">ยังไม่พบจุดที่โดดเด่นเป็นพิเศษจากแมตช์ที่เลือก</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {insights.map((i) => (
                  <li key={i.id} className={cn("rounded-card border p-3", i.tone === "warn" ? "border-accent/40 bg-accent/5" : "border-win/30 bg-win/5")}>
                    <p className={cn("font-display text-sm font-medium", i.tone === "warn" ? "text-accent" : "text-win")}>{i.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-text-muted">{i.detail}</p>
                    {i.suggestion && <p className="mt-1 text-xs leading-relaxed text-text">ลอง: {i.suggestion}</p>}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-text-faint">
              * คำนวณจากแมตช์ที่คุณบันทึกเอง เทียบกับเพื่อนร่วมทีมในรูปเดียวกัน ไม่ใช่ข้อมูลทางการของเกม ทอง/คะแนนเป็นตัวชี้วัดประกอบ ไม่ใช่คะแนนฝีมือ
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-card border border-border bg-bg-surface p-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-0.5 font-display text-xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-text-faint tabular-nums">{sub}</p>}
    </div>
  );
}

// The change is judged AFTER rounding to what the user sees: a change that rounds to 0 reads "ไม่เปลี่ยน" and stays neutral
// (before, it showed "−0" in red/green by the sign of the unrounded value).
function changeOf(d: Delta, digits: number, scale: number, unit: string) {
  const v = Number((d.diff * scale).toFixed(digits));
  if (v === 0) return { text: "ไม่เปลี่ยน", dir: 0 as const };
  return {
    text: `${v > 0 ? "▲ +" : "▼ −"}${Math.abs(v).toFixed(digits)}${unit}`,
    dir: v > 0 ? (1 as const) : (-1 as const),
  };
}

function CmpRow({
  label,
  d,
  fmt,
  digits,
  scale = 1,
  unit = "",
  better,
}: {
  label: string;
  d: Delta;
  fmt: (v: number) => string;
  digits: number;
  scale?: number;
  unit?: string;
  better: "up" | "down" | null; // null: no clear good/bad direction (e.g. gold depends on role), shown neutral
}) {
  const c = changeOf(d, digits, scale, unit);
  const good = c.dir === 0 || better === null ? null : (c.dir > 0) === (better === "up");
  return (
    <div className="grid grid-cols-[1.2fr_1fr_1fr_1.1fr] items-center gap-2 border-t border-border pt-2 text-xs tabular-nums">
      <span className="text-text-muted">{label}</span>
      <span>{fmt(d.previous)}</span>
      <span className="font-medium">{fmt(d.current)}</span>
      <span className={cn("whitespace-nowrap", good === null ? "text-text-faint" : good ? "text-win" : "text-loss")}>{c.text}</span>
    </div>
  );
}

// Small inline-SVG line chart (the project has no chart dependency). Pointer or arrow keys move the readout.
function TrendChart({
  title,
  caption,
  points,
  need,
  games,
  format,
  fixed,
}: {
  title: string;
  caption: string;
  points: TrendPoint[];
  need: number;
  games: number;
  format: (v: number) => string;
  fixed?: [number, number];
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (points.length < MIN_TREND_POINTS) {
    return (
      <div className="rounded-card border border-dashed border-border p-3">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs text-text-muted">ต้องมีอย่างน้อย {need} แมตช์ถึงจะแสดงแนวโน้ม ({caption}) ตอนนี้มี {games}</p>
      </div>
    );
  }

  const W = 300;
  const H = 100;
  const PAD = 8;
  const vals = points.map((p) => p.value);
  const lo = fixed ? fixed[0] : Math.min(...vals);
  const hi = fixed ? fixed[1] : Math.max(...vals);
  const span = hi - lo || 1;
  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - ((v - lo) / span) * (H - PAD * 2);
  const idx = Math.min(hover ?? points.length - 1, points.length - 1);
  const p = points[idx];
  const path = points.map((pt, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(pt.value).toFixed(1)}`).join(" ");

  const onPointer = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const t = (e.clientX - r.left) / r.width;
    setHover(Math.max(0, Math.min(points.length - 1, Math.round(t * (points.length - 1)))));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "ArrowLeft") setHover(Math.max(0, idx - 1));
    else if (e.key === "ArrowRight") setHover(Math.min(points.length - 1, idx + 1));
    else return;
    e.preventDefault();
  };

  return (
    <div className="rounded-card border border-border bg-bg-surface p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs tabular-nums text-text-muted" aria-live="polite">{format(p.value)}</p>
      </div>
      <p className="text-[11px] text-text-faint">
        {caption} · แมตช์ที่ {p.index} ({fmtDate(p.playedAt)})
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 h-24 w-full touch-pan-y"
        role="img"
        aria-label={`กราฟ${title} ${points.length} จุด ล่าสุด ${format(points[points.length - 1].value)} ใช้ปุ่มลูกศรซ้ายขวาเพื่อดูแต่ละจุด`}
        tabIndex={0}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
      >
        {fixed && <line x1={PAD} x2={W - PAD} y1={y(0.5)} y2={y(0.5)} className="stroke-border" strokeDasharray="3 3" />}
        <path d={path} fill="none" className="stroke-accent" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(idx)} cy={y(p.value)} r={4} className="fill-accent" />
      </svg>
      <p className="text-[11px] text-text-faint">ช่วงต่ำสุด–สูงสุด {format(Math.min(...vals))} – {format(Math.max(...vals))}</p>
    </div>
  );
}
