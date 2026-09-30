import { useParams } from "react-router-dom";
import { ThumbsUp, ThumbsDown, Users, MessageCircle } from "lucide-react";
import { getHeroBySlug } from "@/services/heroes";
import { useAsync } from "@/hooks/useAsync";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { Badge } from "@/components/ui/badge";
import { AskCoach } from "@/components/AskCoach";
import { FavoriteButton } from "@/features/favorites/FavoriteButton";
import { HeroComments } from "@/features/comments/HeroComments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CounterList } from "@/features/heroes/CounterList";
import { ROLE_OPTIONS, LANE_OPTIONS } from "@/features/heroes/HeroFilters";
import { MOCK_HEROES } from "@/data/heroes.mock";

const DIFFICULTY_LABEL: Record<string, string> = { easy: "ง่าย", medium: "ปานกลาง", hard: "ยาก" };

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-raised px-3 py-2 text-center">
      <p className="font-display text-lg font-semibold">{value}</p>
      <p className="text-[11px] text-text-faint">{label}</p>
    </div>
  );
}

export function HeroDetail() {
  const { slug = "" } = useParams();
  const hero = useAsync(() => getHeroBySlug(slug), [slug]);

  if (hero.status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (hero.status === "error") return <ErrorState message={hero.message} onRetry={hero.refetch} />;
  if (hero.status === "success" && !hero.data) {
    return <EmptyState icon={Users} title="ไม่พบฮีโร่นี้" description="ตรวจสอบลิงก์อีกครั้ง หรือกลับไปหน้ารายชื่อฮีโร่" />;
  }
  if (hero.status !== "success" || !hero.data) return null;

  const h = hero.data;
  const roleLabel = ROLE_OPTIONS.find((r) => r.value === h.role)?.label ?? h.role;
  const laneLabel = LANE_OPTIONS.find((l) => l.value === h.lane)?.label ?? h.lane;

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-start gap-4 rounded-card border border-border bg-bg-surface p-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-bg-raised font-display text-xl text-text-faint">
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
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate font-display text-xl font-semibold">{h.nameTh}</h1>
            {h.stat.hasStats ? <Badge tier={h.stat.tier}>{h.stat.tier}</Badge> : <Badge>N/A</Badge>}
            <FavoriteButton heroSlug={h.slug} className="ml-auto bg-bg-raised" />
          </div>
          <p className="text-sm text-text-muted">{roleLabel} · {laneLabel} · ความยาก {DIFFICULTY_LABEL[h.difficulty]}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatBlock label="Win Rate" value={h.stat.hasStats ? `${h.stat.winRate.toFixed(1)}%` : "N/A"} />
        <StatBlock label="Pick Rate" value={h.stat.hasStats ? `${h.stat.pickRate.toFixed(1)}%` : "N/A"} />
        <StatBlock label="Ban Rate" value={h.stat.hasStats ? `${h.stat.banRate.toFixed(1)}%` : "N/A"} />
      </div>
      {h.stat.hasStats ? (
        <p className="text-center text-[11px] text-text-faint">
          อ้างอิง {h.stat.matches.toLocaleString()} แมตช์ · {h.stat.rankTier} · Patch {h.stat.patch}
        </p>
      ) : (
        <p className="text-center text-[11px] text-text-faint">* ยังไม่มีข้อมูลสถิติสำหรับฮีโร่นี้</p>
      )}

      <Card>
        <CardHeader><CardTitle>เกี่ยวกับฮีโร่</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-text-muted">{h.description}</p></CardContent>
      </Card>

      {h.abilities.length > 0 && (
        <Card>
          <CardHeader><CardTitle>สกิล</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {h.abilities.map((a) => (
              <div key={a.slot + a.name} className="rounded-lg border border-border bg-bg-raised p-3">
                <div className="flex items-center gap-2">
                  <Badge className="uppercase">{a.slot}</Badge>
                  <p className="font-display text-sm font-medium">{a.name}</p>
                </div>
                <p className="mt-1.5 text-sm text-text-muted">{a.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {(h.strengths.length > 0 || h.weaknesses.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <CardHeader className="items-center">
              <div className="flex items-center gap-2"><ThumbsUp className="h-4 w-4 text-win" /><CardTitle>จุดแข็ง</CardTitle></div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm text-text-muted">
                {h.strengths.map((s) => <li key={s}>• {s}</li>)}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="items-center">
              <div className="flex items-center gap-2"><ThumbsDown className="h-4 w-4 text-loss" /><CardTitle>จุดอ่อน</CardTitle></div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm text-text-muted">
                {h.weaknesses.map((s) => <li key={s}>• {s}</li>)}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      <AskCoach
        resetKey={h.slug}
        label="ถามโค้ช AI: เล่นตัวนี้ยังไง"
        prompt={`สรุปวิธีเล่น ${h.nameTh} ให้ผู้เล่นมือใหม่ถึงกลาง ไม่เกิน 4 ประโยค`}
        context={{
          hero: h.nameTh,
          role: roleLabel,
          lane: laneLabel,
          difficulty: DIFFICULTY_LABEL[h.difficulty],
          stats: h.stat.hasStats
            ? { winRate: h.stat.winRate, pickRate: h.stat.pickRate, banRate: h.stat.banRate, tier: h.stat.tier }
            : null,
          strengths: h.strengths,
          weaknesses: h.weaknesses,
          abilities: h.abilities.map((a) => ({ slot: a.slot, name: a.name, description: a.description })),
        }}
      />

      <Card>
        <CardHeader><CardTitle>ใครสวน {h.nameTh} ได้</CardTitle></CardHeader>
        <CardContent><CounterList entries={h.counteredBy} emptyText="ยังไม่มีข้อมูลตัวสวนสำหรับฮีโร่นี้" /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{h.nameTh} สวนใครได้</CardTitle></CardHeader>
        <CardContent><CounterList entries={h.countersAgainst} emptyText="ยังไม่มีข้อมูลฮีโร่ที่ถูกสวน" /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>ฮีโร่ที่เข้าคู่ดี</CardTitle></CardHeader>
        <CardContent>
          {h.synergies.length === 0 ? (
            <p className="text-sm text-text-faint">ยังไม่มีข้อมูล</p>
          ) : (
            <div className="space-y-2">
              {h.synergies.map((s) => {
                const nameTh = s.heroNameTh ?? MOCK_HEROES.find((m) => m.slug === s.heroSlug)?.nameTh;
                if (!nameTh) return null;
                return (
                  <div key={s.heroSlug} className="rounded-lg border border-border bg-bg-raised p-3">
                    <p className="font-display text-sm font-medium">{nameTh}</p>
                    <p className="mt-1 text-sm text-text-muted">{s.reason}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-text-faint" /><CardTitle>ความคิดเห็นชุมชน</CardTitle></div>
        </CardHeader>
        <CardContent>
          <HeroComments heroSlug={h.slug} />
        </CardContent>
      </Card>
    </div>
  );
}
