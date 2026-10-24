import { useEffect, useRef, useState } from "react";
import { Switch } from "@/features/community/Switch";
import { cn } from "@/lib/utils";
import { makeDeadline, secondsLeft, type CurrentTurn, type TurnKind } from "./competitive";
import type { TeamKey } from "./series";

const PHASE_LABEL: Record<1 | 2 | 3 | 4, string> = {
  1: "แบนรอบที่ 1",
  2: "เลือกฮีโร่รอบที่ 1",
  3: "แบนรอบที่ 2",
  4: "เลือกฮีโร่รอบที่ 2",
};

/**
 * Countdown for the active turn. Remaining time comes from a wall-clock deadline (not a decrementing counter),
 * so it stays correct after the tab was in the background. One countdown covers a whole turn: a 2-pick turn
 * does NOT reset between its picks. It only reports time and calls `onExpire` once when a turn runs out.
 */
export function useTurnCountdown(enabled: boolean, turnKey: string | null, kind: TurnKind | null, onExpire?: () => void) {
  const [left, setLeft] = useState<number | null>(null);
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;
  useEffect(() => {
    if (!enabled || turnKey === null || kind === null) {
      setLeft(null);
      return;
    }
    const deadline = makeDeadline(kind, Date.now());
    let fired = false;
    const tick = () => {
      const s = secondsLeft(deadline, Date.now());
      setLeft(s);
      if (s === 0 && !fired) {
        fired = true; // once per turn
        expireRef.current?.();
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [enabled, turnKey, kind]);
  return left;
}

/** Big countdown shown between the two teams. Display only. */
export function TurnCountdown({ left }: { left: number }) {
  const expired = left === 0;
  return (
    <p
      role={expired ? "alert" : undefined}
      className={cn(
        "rounded-card border border-border bg-bg-surface px-4 py-2 text-center font-display text-3xl font-bold tabular-nums",
        expired ? "text-loss" : left <= 10 ? "text-amber-400" : "text-text"
      )}
    >
      {expired ? "หมดเวลา" : left}
    </p>
  );
}

/**
 * Progress bar above a team's slots: full for the team whose turn it is, empty for the other team.
 * It drains from the OUTER edge toward the centre timer (left team: anchored right on md+, right team: anchored left).
 * On mobile the teams are stacked, so both bars are anchored left. Display only (decorative, hidden from screen readers).
 */
export function TeamTurnBar({ active, left, total, side }: { active: boolean; left: number; total: number; side: "left" | "right" }) {
  const pct = active && total > 0 ? Math.min(100, (left / total) * 100) : 0;
  return (
    <div
      aria-hidden
      className={cn("mb-1.5 flex h-1.5 overflow-hidden rounded-full bg-border/40", side === "left" && "md:justify-end")}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-1000 ease-linear",
          left === 0 ? "bg-loss" : left <= 10 ? "bg-amber-400" : "bg-accent"
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function CompetitivePanel({
  on,
  onToggle,
  firstPick,
  onFirstPick,
  turn,
  teamLabel,
  onNew,
}: {
  on: boolean;
  onToggle: (on: boolean) => void;
  firstPick: TeamKey;
  onFirstPick: (team: TeamKey) => void;
  turn: CurrentTurn | null;
  teamLabel: Record<TeamKey, string>;
  onNew: () => void;
}) {
  return (
    <div className="space-y-2 rounded-card border border-border bg-bg-surface p-3">
      <div className="flex flex-wrap items-center gap-3">
        <Switch checked={on} onChange={onToggle} label="จับเวลาการแข่งขัน" />
        {on && (
          <div className="flex items-center gap-1.5 text-xs text-text-faint" role="group" aria-label="First Pick">
            <span>First Pick:</span>
            {(["mine", "enemy"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={firstPick === t}
                onClick={() => onFirstPick(t)}
                className={cn(
                  "rounded-md border px-2 py-1",
                  firstPick === t ? "border-accent bg-accent/10 text-text" : "border-border text-text-muted hover:text-text"
                )}
              >
                {teamLabel[t]}
              </button>
            ))}
          </div>
        )}
      </div>

      {on && !turn && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <p className="font-medium text-accent">ดราฟต์เสร็จสมบูรณ์</p>
          <button
            type="button"
            onClick={onNew}
            className="rounded-lg border border-border px-3 py-1.5 text-text-muted hover:text-text"
          >
            เริ่มดราฟต์ใหม่
          </button>
        </div>
      )}

      {on && turn && (
        <div className="flex flex-wrap items-center justify-between gap-2" aria-live="polite">
          <div className="text-sm">
            <p className="text-xs text-text-faint">{PHASE_LABEL[turn.phase]}</p>
            <p className="font-medium">
              {teamLabel[turn.team]} ({turn.side === "first" ? "First Pick" : "Second Pick"}){" "}
              {turn.kind === "ban" ? "กำลังแบนฮีโร่" : "กำลังเลือกฮีโร่"}
              <span className="text-text-muted"> · เหลืออีก {turn.left} ตัว</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
