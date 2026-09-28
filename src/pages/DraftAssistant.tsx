import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { getHeroes } from "@/services/heroes";
import { useAsync } from "@/hooks/useAsync";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { TeamSlots } from "@/features/draft/TeamSlots";
import { TeamMeters } from "@/features/draft/TeamMeters";
import { RecommendedPickCard } from "@/features/draft/RecommendedPickCard";
import { analyzeTeam, recommendPicks } from "@/features/draft/analyzeTeam";
import type { HeroSummary } from "@/types/hero";
import { cn } from "@/lib/utils";

type Slot = { team: "mine" | "enemy"; index: number };

export function DraftAssistant() {
  const heroesQ = useAsync(() => getHeroes(), []);
  const [myTeam, setMyTeam] = useState<(HeroSummary | null)[]>(Array(5).fill(null));
  const [enemyTeam, setEnemyTeam] = useState<(HeroSummary | null)[]>(Array(5).fill(null));
  const [active, setActive] = useState<Slot | null>({ team: "mine", index: 0 });
  const [query, setQuery] = useState("");

  const heroes = heroesQ.status === "success" ? heroesQ.data : [];
  const analysis = useMemo(() => analyzeTeam(myTeam), [myTeam]);
  const recs = useMemo(() => (heroes.length ? recommendPicks(myTeam, heroes) : []), [myTeam, heroes]);

  const pickedElsewhere = new Set(
    [...myTeam, ...enemyTeam].filter((h): h is HeroSummary => h !== null).map((h) => h.slug)
  );
  const filteredPool = heroes.filter(
    (h) => !pickedElsewhere.has(h.slug) && (query.trim() === "" || h.nameTh.includes(query) || h.name.toLowerCase().includes(query.toLowerCase()))
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
          {heroesQ.status === "loading" && <Skeleton className="h-24" />}
          {heroesQ.status === "error" && <ErrorState message={heroesQ.message} onRetry={heroesQ.refetch} />}
          {heroesQ.status === "success" && (
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
                    {h.name.slice(0, 2).toUpperCase()}
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
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2">
          <Users className="h-4 w-4 text-accent" />
          <h2 className="font-display text-base font-semibold">แนะนำตัวถัดไป</h2>
        </div>
        {analysis.filledSlots === 5 ? (
          <p className="text-sm text-text-faint">ทีมของคุณครบ 5 ฮีโร่แล้ว</p>
        ) : recs.length === 0 ? (
          <p className="text-sm text-text-faint">เลือกฮีโร่อย่างน้อย 1 ตัวเพื่อดูคำแนะนำ</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {recs.map((r) => (
              <RecommendedPickCard
                key={r.hero.id}
                rec={r}
                onPick={() => {
                  const idx = myTeam.findIndex((h) => h === null);
                  if (idx >= 0) {
                    setMyTeam((prev) => {
                      const next = [...prev];
                      next[idx] = r.hero;
                      return next;
                    });
                  }
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
