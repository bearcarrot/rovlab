import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration, } from "@/features/matches/scan";
import type { MatchRecord, StoredPlayer, TeamSide } from "@/types/match";

function when(iso: string): string {
  const d = new Date(iso); // wall-clock time from the scoreboard, parsed as local time
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}

function PlayersTable({ players, team }: { players: StoredPlayer[]; team: TeamSide }) {
  const rows = players.filter((p) => p.team === team);
  return (
    <div>
      <p className={cn("mb-1 text-[11px] font-medium", team === "blue" ? "text-rift" : "text-loss")}>
        {team === "blue" ? "ทีมฟ้า" : "ทีมแดง"}
      </p>
      <ul className="space-y-0.5 text-xs">
        {rows.map((p, i) => (
          <li key={i} className={cn("flex justify-between gap-2 tabular-nums", p.isMe ? "font-medium text-accent" : "text-text-muted")}>
            <span className="truncate">{p.hero}{p.mvp ? " · MVP" : ""}</span>
            <span className="shrink-0">{p.kills}/{p.deaths}/{p.assists} · {p.gold.toLocaleString()} · {p.rating.toFixed(1)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MatchCard({
  match,
  heroIcon,
  onDelete,
  deleting,
}: {
  match: MatchRecord;
  heroIcon?: string;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const win = match.result === "victory";
  return (
    <li className="rounded-card border border-border bg-bg-surface p-3">
      <div className="flex items-center gap-3">
        <div className={cn("h-12 w-1 shrink-0 rounded-full", win ? "bg-win" : "bg-loss")} aria-hidden="true" />
        {heroIcon ? (
          <img src={heroIcon} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-12 w-12 shrink-0 rounded-lg bg-bg-raised object-cover" />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-bg-raised font-display text-sm text-text-faint">
            {match.myHeroName.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-medium">
            <span className={win ? "text-win" : "text-loss"}>{win ? "ชนะ" : "แพ้"}</span> · {match.myHeroName}
            {match.mvp && <span className="ml-1.5 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">MVP</span>}
          </p>
          <p className="text-xs text-text-muted tabular-nums">
            {match.kills}/{match.deaths}/{match.assists} · {match.gold.toLocaleString()} ทอง · คะแนน {match.rating.toFixed(1)}
          </p>
          <p className="text-[11px] text-text-faint">
            {when(match.playedAt)} · {formatDuration(match.durationSec)} นาที · {match.scoreBlue}:{match.scoreRed}
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
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-text-muted">ดูผู้เล่นทั้ง 10 คน</summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <PlayersTable players={match.players} team="blue" />
          <PlayersTable players={match.players} team="red" />
        </div>
      </details>
    </li>
  );
}
