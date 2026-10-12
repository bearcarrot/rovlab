import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/features/matches/scan";
import { STAT_GRID, StatHeader } from "@/features/matches/ScoreIcons";
import type { MatchRecord, StoredPlayer, TeamSide } from "@/types/match";

function when(iso: string): string {
  const d = new Date(iso); // wall-clock time from the scoreboard, parsed as local time
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}

function HeroThumb({ src, name, size }: { src?: string; name: string; size: string }) {
  return src ? (
    <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className={cn(size, "shrink-0 rounded bg-bg-raised object-cover")} />
  ) : (
    <span className={cn(size, "flex shrink-0 items-center justify-center rounded bg-bg-raised font-display text-[10px] text-text-faint")}>
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

// The MVP badge sits on the hero icon and "me" is the highlighted row, so the name keeps the whole name column
// (long names such as "Flowborn (Carry)" wrap to two lines instead of being cut with an ellipsis).
function PlayerRow({ p, icon }: { p: StoredPlayer; icon?: string }) {
  return (
    <li className={cn(STAT_GRID, "px-2 py-1 text-xs tabular-nums", p.isMe && "bg-accent/15 ring-1 ring-inset ring-accent/40")}>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="relative shrink-0">
          <HeroThumb src={icon} name={p.hero} size="h-7 w-7" />
          {p.mvp && (
            <span className="absolute -bottom-1 -right-1 rounded bg-accent px-0.5 text-[8px] font-bold leading-tight text-accent-fg">
              MVP
            </span>
          )}
        </span>
        <span
          title={p.hero}
          className={cn("min-w-0 break-words text-[13px] leading-tight", p.isMe ? "font-medium text-accent" : "text-text")}
        >
          {p.hero}
          {p.isMe && <span className="sr-only"> (ฉัน)</span>}
        </span>
      </span>
      <span className="text-center">{p.kills}</span>
      <span className="text-center">{p.deaths}</span>
      <span className="text-center">{p.assists}</span>
      <span className="text-center">{p.gold.toLocaleString()}</span>
      <span className="text-center">{p.rating.toFixed(1)}</span>
    </li>
  );
}

function TeamBlock({ team, match, iconById }: { team: TeamSide; match: MatchRecord; iconById: Map<string, string> }) {
  const rows = match.players.filter((p) => p.team === team);
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <StatHeader
        team={team}
        label={team === "blue" ? "ทีมฟ้า" : "ทีมแดง"}
        score={team === "blue" ? match.scoreBlue : match.scoreRed}
      />
      <ul className="divide-y divide-border">
        {rows.map((p, i) => (
          <PlayerRow key={i} p={p} icon={p.heroId ? iconById.get(p.heroId) : undefined} />
        ))}
      </ul>
    </div>
  );
}

export function MatchCard({
  match,
  iconById,
  onDelete,
  deleting,
  defaultOpen = false,
}: {
  match: MatchRecord;
  iconById: Map<string, string>;
  onDelete: (id: string) => void;
  deleting: boolean;
  defaultOpen?: boolean;
}) {
  const win = match.result === "victory";
  const myIcon = match.myHeroId ? iconById.get(match.myHeroId) : undefined;
  return (
    <li className="rounded-card border border-border bg-bg-surface p-3">
      <div className="flex items-center gap-3">
        <div className={cn("h-12 w-1 shrink-0 rounded-full", win ? "bg-win" : "bg-loss")} aria-hidden="true" />
        <HeroThumb src={myIcon} name={match.myHeroName} size="h-12 w-12" />
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5 font-display text-sm font-medium">
            <span className={win ? "text-win" : "text-loss"}>{win ? "ชนะ" : "แพ้"}</span>
            <span className="truncate">{match.myHeroName}</span>
            {match.mvp && <span className="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">MVP</span>}
          </p>
          <p className="flex flex-wrap gap-x-3 text-xs tabular-nums text-text-muted">
            <span>{match.kills}/{match.deaths}/{match.assists}</span>
            <span>{match.gold.toLocaleString()} ทอง</span>
            <span>คะแนน {match.rating.toFixed(1)}</span>
          </p>
          <p className="flex flex-wrap gap-x-3 text-[11px] text-text-faint tabular-nums">
            <span>{when(match.playedAt)}</span>
            <span>{formatDuration(match.durationSec)} นาที</span>
            <span>{match.scoreBlue}:{match.scoreRed}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => onDelete(match.id)}
          disabled={deleting}
          aria-label="ลบแมตช์นี้"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-faint hover:bg-bg-raised hover:text-loss disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <details className="mt-2" open={defaultOpen}>
        <summary className="cursor-pointer text-xs text-text-muted">ผู้เล่นทั้ง 10 คน</summary>
        <div className="mt-2 grid gap-3 lg:grid-cols-2">
          <TeamBlock team="blue" match={match} iconById={iconById} />
          <TeamBlock team="red" match={match} iconById={iconById} />
        </div>
      </details>
    </li>
  );
}
