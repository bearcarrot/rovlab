import { Link, useParams } from "react-router-dom";
import { ThumbsUp, ThumbsDown, Users, MessageCircle } from "lucide-react";
import { getHeroBySlug } from "@/services/heroes";
import { useAsync } from "@/hooks/useAsync";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { Badge } from "@/components/ui/badge";
import { AskCoach } from "@/components/AskCoach";
import { HeroIcon } from "@/components/HeroIcon";
import { EffectTagList } from "@/components/EffectTagList";
import { FavoriteButton } from "@/features/favorites/FavoriteButton";
import { HeroComments } from "@/features/comments/HeroComments";
import { HeroBalance } from "@/features/balance/HeroBalance";
import { HeroBalanceBadge } from "@/features/balance/HeroBalanceBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CounterList } from "@/features/heroes/CounterList";
import { useFilterLabels } from "@/features/heroes/HeroFilters";
import { heroLanes, heroRoles } from "@/lib/heroPositions";
import { summarizeTags } from "@/lib/effectTags";
import { MOCK_HEROES } from "@/data/heroes.mock";

const DIFFICULTY_LABEL: Record<string, string> = { easy: "ง่าย", medium: "ปานกลาง", hard: "ยาก" };

function StatBlock({ label, value, valueClassName = "" }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-raised px-3 py-2 text-center sm:py-3">
      <p className={`font-display text-lg font-semibold sm:text-xl ${valueClassName}`}>{value}</p>
      <p className="text-[11px] text-text-faint sm:text-xs">{label}</p>
    </div>
  );
}

export function HeroDetail() {
  const { slug = "" } = useParams();
  const hero = useAsync(() => getHeroBySlug(slug), [slug]);
  const { roleLabel: roleName, laneLabel: laneName } = useFilterLabels();

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
  // ฮีโร่ที่ไปได้หลายตำแหน่ง/เลน แสดงทั้งหมด (คั่นด้วย /) ชื่อมาจาก DB (hero_roles / hero_lanes)
  const roleLabel = heroRoles(h).map((r) => roleName(r)).join(" / ");
  const laneLabel = heroLanes(h).map((l) => laneName(l)).join(" / ");

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-start gap-4 rounded-card border border-border bg-bg-surface p-4 sm:items-center sm:gap-5 sm:p-5">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-bg-raised font-display text-xl text-text-faint sm:h-20 sm:w-20 lg:h-24 lg:w-24">
          {h.icon ? (
            <img
              src={h.icon}
              alt={h.nameTh}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-full w-full rounded-lg object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                e.currentTarget.nextElementSibling?.classList.remove("hidden");
              }}
            />
          ) : null}

          <span className={`text-2xl font-display text-text-faint ${h.icon ? "hidden" : ""}`}>
            {h.name.slice(0, 2).toUpperCase()}
          </span>
          {/* ขวาล่างของรูปฮีโร่ เหมือนทุกหน้า */}
          <HeroBalanceBadge heroId={h.id} size="md" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="max-w-full truncate font-display text-xl font-semibold sm:text-2xl">{h.nameTh}</h1>
            {h.stat.hasStats ? <Badge tier={h.stat.tier}>{h.stat.tier}</Badge> : <Badge>N/A</Badge>}
            <FavoriteButton heroSlug={h.slug} className="ml-auto bg-bg-raised" />
          </div>
          <p className="mt-0.5 text-sm text-text-muted">{roleLabel} · {laneLabel} · ความยาก {DIFFICULTY_LABEL[h.difficulty]}</p>
          {/* สรุปแท็กชนิดสกิลทั้งหมดของฮีโร่ (กายภาพแดง / เวทน้ำเงิน / CC เหลือง ฯลฯ) */}
          <EffectTagList tags={summarizeTags(h.abilities.map((a) => a.effectTags))} className="mt-2" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatBlock
          label="Win Rate"
          value={h.stat.hasStats ? `${h.stat.winRate.toFixed(1)}%` : "N/A"}
          valueClassName={h.stat.hasStats ? "text-win" : ""}
        />
        <StatBlock
          label="Pick Rate"
          value={h.stat.hasStats ? `${h.stat.pickRate.toFixed(1)}%` : "N/A"}
          valueClassName={h.stat.hasStats ? "text-yellow-400" : ""}
        />
        <StatBlock
          label="Ban Rate"
          value={h.stat.hasStats ? `${h.stat.banRate.toFixed(1)}%` : "N/A"}
          valueClassName={h.stat.hasStats ? "text-loss" : ""}
        />
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

      <HeroBalance heroId={h.id} />

      {h.abilities.length > 0 && (
        <Card>
          <CardHeader><CardTitle>สกิล</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {h.abilities.map((a) => (
              <div key={a.slot + a.name} className="rounded-lg border border-border bg-bg-raised p-3">
                <div className="flex items-center gap-2">
                  {a.icon ? (
                    <img
                      src={a.icon}
                      alt={a.name}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-9 w-9 shrink-0 rounded-[50%] object-cover sm:h-10 sm:w-10"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : null}
                  <Badge className="uppercase">{a.slot}</Badge>
                  <p className="font-display text-sm font-medium">{a.name}</p>
                </div>
                <EffectTagList tags={a.effectTags ?? []} className="mt-2" />
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

      {/* lg+ วางการ์ดแพ้ทาง/ชนะทางคู่กัน ลดความยาวหน้าบนจอกว้าง */}
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader><CardTitle>{h.nameTh} แพ้ทางใครบ้าง</CardTitle></CardHeader>
          <CardContent><CounterList entries={h.counteredBy} emptyText="ยังไม่มีข้อมูลว่าฮีโร่นี้แพ้ทางใคร" /></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{h.nameTh} ชนะทางใครได้</CardTitle></CardHeader>
          <CardContent><CounterList entries={h.countersAgainst} emptyText="ยังไม่มีข้อมูลว่าฮีโร่นี้ชนะทางใคร" /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>ฮีโร่ที่คอมโบกับ {h.nameTh} ได้ดี</CardTitle></CardHeader>
        <CardContent>
          {h.synergies.length === 0 ? (
            <p className="text-sm text-text-faint">ยังไม่มีข้อมูล</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {h.synergies.map((s) => {
                const mock = MOCK_HEROES.find((m) => m.slug === s.heroSlug);
                const nameTh = s.heroNameTh ?? mock?.nameTh;
                if (!nameTh) return null;
                const icon = s.heroIcon || mock?.icon || "";
                return (
                  <div key={s.heroSlug} className="flex gap-3 rounded-lg border border-border bg-bg-raised p-3">
                    <Link to={`/heroes/${s.heroSlug}`} aria-label={nameTh} className="shrink-0">
                      <HeroIcon icon={icon} name={nameTh} fallback={mock?.name.slice(0, 2).toUpperCase()} className="h-11 w-11" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link to={`/heroes/${s.heroSlug}`} className="font-display text-sm font-medium hover:text-accent">
                        {nameTh}
                      </Link>
                      <p className="mt-1 text-sm text-text-muted">{s.reason}</p>
                    </div>
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
