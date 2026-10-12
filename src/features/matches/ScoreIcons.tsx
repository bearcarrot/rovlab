import { Coins, Skull, Swords, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TeamSide } from "@/types/match";

// Column icons shared by the match list and the review table, in the same order as the in-game scoreboard:
// Kills (crossed swords), Deaths (skull), Assists (fist), Gold (coins) and the per-player rating (trophy).

export function FistIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M7 11V8a2 2 0 0 1 4 0v1m0 0V7a2 2 0 0 1 4 0v2m0 0V8a2 2 0 0 1 4 0v6a6 6 0 0 1-6 6h-2a6 6 0 0 1-5-2.7L4.6 14a1.8 1.8 0 0 1 3-2z" />
      <path d="M11 14h4" />
    </svg>
  );
}

export type StatKind = "kills" | "deaths" | "assists" | "gold" | "rating";

const COLS: Record<StatKind, { label: string; Icon: (p: { className?: string }) => JSX.Element }> = {
  kills: { label: "Kills", Icon: ({ className }) => <Swords className={className} /> },
  deaths: { label: "Deaths", Icon: ({ className }) => <Skull className={className} /> },
  assists: { label: "Assists", Icon: FistIcon },
  gold: { label: "Gold", Icon: ({ className }) => <Coins className={className} /> },
  rating: { label: "คะแนน", Icon: ({ className }) => <Trophy className={className} /> },
};

export function ColIcon({ kind, className }: { kind: StatKind; className?: string }) {
  const { label, Icon } = COLS[kind];
  return (
    <span title={label} className={cn("flex items-center justify-center", className)}>
      <Icon className="h-4 w-4" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * One row = name column + 5 fixed stat columns, so header icons and player values always line up.
 * Phone: narrow stat columns (K/D/A fit 2 digits, gold fits "10,792") so the hero name gets the room.
 * sm and up: the wider columns.
 */
export const STAT_GRID =
  "grid grid-cols-[minmax(0,1fr)_1.75rem_1.75rem_1.75rem_3.25rem_2.25rem] items-center gap-x-0.5 sm:grid-cols-[minmax(0,1fr)_2.5rem_2.5rem_2.5rem_3.75rem_2.75rem] sm:gap-x-1";

export function StatHeader({ team, label, score }: { team: TeamSide; label: string; score: number }) {
  return (
    <div className={cn(STAT_GRID, "px-2 py-1.5 text-xs font-medium", team === "blue" ? "bg-rift/25" : "bg-loss/25")}>
      <span className={cn("truncate", team === "blue" ? "text-rift" : "text-loss")}>
        {label} {score}
      </span>
      <ColIcon kind="kills" />
      <ColIcon kind="deaths" />
      <ColIcon kind="assists" />
      <ColIcon kind="gold" />
      <ColIcon kind="rating" />
    </div>
  );
}
