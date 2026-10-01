import { useMemo, useState } from "react";
import { Search, Swords, Users, Link2 } from "lucide-react";
import { getHeroes } from "@/services/heroes";
import { getDraftRelations } from "@/services/draft";
import { useAsync } from "@/hooks/useAsync";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { AskCoach } from "@/components/AskCoach";
import { TeamSlots } from "@/features/draft/TeamSlots";
import { TeamMeters } from "@/features/draft/TeamMeters";
import { RecommendedPickCard } from "@/features/draft/RecommendedPickCard";
import { analyzeTeam, getDraftMode, recommendPicks, type DraftMode, type Recommendation } from "@/features/draft/analyzeTeam";
import { HeroFilterBar, useHeroFilters } from "@/features/heroes/HeroFilterBar";
import type { HeroSummary } from "@/types/hero";
import { cn } from "@/lib/utils";

type Slot = { team: "mine" | "enemy"; index: number };

const MODE_TEXT: Record<DraftMode, string> = {
  firstPick: "โหมด First Pick: ยังไม่เห็นทีมศัตรู จึงเน้นสถิติแพตช์ และเลี่ยงตัวที่โดนเคาน์เตอร์ง่าย",
  counter: "เน้นตัวที่ชนะทางศัตรู + คอมโบกับทีมเรา + เติมจุดที่ทีมขาด",
  composition: "เน้นเติมจุดที่ทีมขาด + คอมโบกับทีมเรา (เลือกทีมศัตรูเพิ่มเพื่อดูตัวชนะทาง)",
};

// จำนวนสูงสุดของรายการคอมโบ/ชนะทางที่แสดงแยก (รายการภาพรวมยังแสดง 5 อันดับแรก)
const RELATION_LIMIT = 6;

function PickSection({
  icon,
  title,
  hint,
  recs,
  draft,
  onPick,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  recs: Recommendation[];
  draft: unknown;
  onPick: (hero: HeroSummary) => void;
}) {
  return (
    <section>
      <div className="mb-1 flex items-center gap-2">
        {icon}
        <h2 className="font-display text-base font-semibold">{title}</h2>
      </div>
      <p className="mb-2 text-xs text-text-muted">{hint}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {recs.map((r) => (
          <RecommendedPickCard key={r.hero.id} rec={r} draft={draft} onPick={() => onPick(r.hero)} />
        ))}
      </div>
    </section>
  );
}

export function DraftAssistant() {
  const heroesQ = useAsync(() => getHeroes(), []);
  // ข้อมูล counter/synergy: โหลดไม่ได้ก็ไม่เป็นไร ระบบแนะนำยังทำงานด้วยสถิติ + คอมโพสิชัน
  const relQ = useAsync(() => getDraftRelations(), []);
  const [myTeam, setMyTeam] = useState<(HeroSummary | null)[]>(Array(5).fill(null));
  const [enemyTeam, setEnemyTeam] = useState<(HeroSummary | null)[]>(Array(5).fill(null));
  const [active, setActive] = useState<Slot | null>({ team: "mine", index: 0 });
  const [query, setQuery] = useState("");
  const filters = useHeroFilters();

  const heroes = heroesQ.status === "success" ? heroesQ.data : [];
  const relations = relQ.status === "success" ? relQ.data : undefined;
  const analysis = useMemo(() => analyzeTeam(myTeam), [myTeam]);
  const mode = getDraftMode(myTeam, enemyTeam);

  // คำนวณทุกตัวครั้งเดียว แล้วแยกเป็น: ภาพรวม 5 อันดับ / คอมโบ / ชนะทาง
  // (คอมโบ/ชนะทางต้องไม่ถูกตัดด้วยอันดับ 5 เพราะคะแนนเติมจุดที่ขาดของตัวอื่นอาจสูงกว่า)
  const allRecs = useMemo(
    () => (heroes.length ? recommendPicks(myTeam, heroes, { enemyTeam, relations, limit: heroes.length }) : []),
    [myTeam, enemyTeam, heroes, relations]
  );
  const recs = allRecs.slice(0, 5);
  const synergyRecs = useMemo(
    () => allRecs.filter((r) => r.tags.includes("synergy")).slice(0, RELATION_LIMIT),
    [allRecs]
  );
  const counterRecs = useMemo(
    () => allRecs.filter((r) => r.tags.includes("counter")).slice(0, RELATION_LIMIT),
    [allRecs]
  );

  const draftCtx = useMemo(
    () => ({
      mine: myTeam.map((h) => h?.nameTh ?? null),
      enemy: enemyTeam.map((h) => h?.nameTh ?? null),
    }),
    [myTeam, enemyTeam]
  );

  const pickedElsewhere = new Set(
    [...myTeam, ...enemyTeam].filter((h): h is HeroSummary => h !== null).map((h) => h.slug)
  );
  const filteredPool = heroes.filter(
    (h) =>
      !pickedElsewhere.has(h.slug) &&
      filters.match(h) &&
      (query.trim() === "" || h.nameTh.includes(query) || h.name.toLowerCase().includes(query.toLowerCase()))
  );

  function assign(hero: HeroSummary) {
    if (!active) return;
    const setTeam = active.team === "mine" ? setMyTeam : setEnemyTeam;
    setTeam((prev) => {
      const next = [...prev];
      next[active.index] = hero;
      return next;
    });
    // auto-advance to next empty slot in the same team
    const team = active.team === "mine" ? myTeam : enemyTeam;
    const nextEmpty = team.findIndex((h, i) => h === null && i !== active.index);
    setActive(nextEmpty >= 0 ? { team: active.team, index: nextEmpty } : null);
  }

  function clearSlot(team: "mine" | "enemy", index: number) {
    const setTeam = team === "mine" ? setMyTeam : setEnemyTeam;
    setTeam((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  }

  // กด "เลือกฮีโร่นี้" ในการ์ดแนะนำ → ใส่ช่องว่างช่องแรกของทีมเรา
  function pickForMyTeam(hero: HeroSummary) {
    const idx = myTeam.findIndex((h) => h === null);
    if (idx < 0) return;
    setMyTeam((prev) => {
      const next = [...prev];
      next[idx] = hero;
      return next;
    });
  }

  const teamFull = analysis.filledSlots === 5;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-semibold">Draft Assistant</h1>
        <p className="mt-1 text-sm text-text-muted">เลือกฮีโร่ทีละช่อง ระบบจะประเมินคอมโพสิชันและแนะนำตัวถัดไป</p>
      </div>

      <TeamSlots
        label="ทีมของคุณ"
        team={myTeam}
        activeIndex={active?.team === "mine" ? active.index : null}
        onSelectSlot={(i) => setActive({ team: "mine", index: i })}
        onClearSlot={(i) => clearSlot("mine", i)}
      />
      <TeamSlots
        label="ทีมศัตรู"
        team={enemyTeam}
        activeIndex={active?.team === "enemy" ? active.index : null}
        onSelectSlot={(i) => setActive({ team: "enemy", index: i })}
        onClearSlot={(i) => clearSlot("enemy", i)}
      />

      {active && (
        <div className="space-y-2 rounded-card border border-border bg-bg-surface p-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`เลือกฮีโร่สำหรับ ${active.team === "mine" ? "ทีมของคุณ" : "ทีมศัตรู"} ช่อง ${active.index + 1}`}
              className="w-full bg-transparent text-sm outline-none placeholder:text-text-faint"
            />
          </div>
          <HeroFilterBar role={filters.role} lane={filters.lane} onRole={filters.setRole} onLane={filters.setLane} />
          {heroesQ.status === "loading" && <Skeleton className="h-24" />}
          {heroesQ.status === "error" && <ErrorState message={heroesQ.message} onRetry={heroesQ.refetch} />}
          {heroesQ.status === "success" && filteredPool.length === 0 && (
            <p className="text-sm text-text-faint">ไม่พบฮีโร่ที่ตรงกับตัวกรอง</p>
          )}
          {heroesQ.status === "success" && filteredPool.length > 0 && (
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
              {filteredPool.map((h) => (
                <button
                  key={h.id}
                  onClick={() => assign(h)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border border-border bg-bg p-1.5 text-center hover:border-accent/40"
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
          )}
        </div>
      )}

      <section>
        <h2 className="mb-2 font-display text-base font-semibold">ภาพรวมทีมของคุณ</h2>
        <div className="rounded-card border border-border bg-bg-surface p-4">
          <TeamMeters analysis={analysis} />
        </div>
        {analysis.filledSlots > 0 && (
          <div className="mt-2">
            <AskCoach
              resetKey={JSON.stringify(draftCtx)}
              label="ถามโค้ช AI: ประเมินดราฟต์"
              prompt="ประเมินคอมโพสิชันทีมของผู้เล่นเทียบกับทีมศัตรู บอกจุดแข็ง จุดที่ขาด และแผนเล่นสั้นๆ ไม่เกิน 5 ประโยค"
              context={{ ...draftCtx, analysis }}
            />
          </div>
        )}
      </section>

      {/* ตัวที่ชนะทางศัตรู / คอมโบกับทีม: แสดงแยก ไม่ถูกตัดด้วย 5 อันดับภาพรวม */}
      {!teamFull && counterRecs.length > 0 && (
        <PickSection
          icon={<Swords className="h-4 w-4 text-accent" />}
          title="ชนะทางศัตรู"
          hint="ฮีโร่ที่ข้อมูลในระบบบอกว่าเคาน์เตอร์ตัวที่ศัตรูเลือกไปแล้ว"
          recs={counterRecs}
          draft={draftCtx}
          onPick={pickForMyTeam}
        />
      )}
      {!teamFull && synergyRecs.length > 0 && (
        <PickSection
          icon={<Link2 className="h-4 w-4 text-accent" />}
          title="คอมโบกับทีมของคุณ"
          hint="ฮีโร่ที่เข้ากันกับตัวที่คุณเลือกไปแล้ว ตามข้อมูลซินเนอร์จี้ในระบบ"
          recs={synergyRecs}
          draft={draftCtx}
          onPick={pickForMyTeam}
        />
      )}

      <section>
        <div className="mb-1 flex items-center gap-2">
          <Users className="h-4 w-4 text-accent" />
          <h2 className="font-display text-base font-semibold">แนะนำตัวถัดไป (ภาพรวม)</h2>
        </div>
        <p className="mb-2 text-xs text-text-muted">{MODE_TEXT[mode]} · เป็นการประเมินเบื้องต้นจากสถิติและข้อมูลในระบบ</p>
        {teamFull ? (
          <p className="text-sm text-text-faint">ทีมของคุณครบ 5 ฮีโร่แล้ว</p>
        ) : recs.length === 0 ? (
          <p className="text-sm text-text-faint">ยังไม่มีฮีโร่ให้แนะนำ</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {recs.map((r) => (
              <RecommendedPickCard key={r.hero.id} rec={r} draft={draftCtx} onPick={() => pickForMyTeam(r.hero)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
