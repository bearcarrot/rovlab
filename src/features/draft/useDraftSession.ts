import { useCallback, useMemo, useRef, useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import type { Visibility } from "@/services/draftSeries";
import {
  addBan,
  changeFormat,
  createSeries,
  getGame,
  isGameEmpty,
  parseSeries,
  removeBan,
  resetGame as resetGameFn,
  resetSeries as resetSeriesFn,
  setGame7Rule,
  setGlobalBanPick,
  setPickAt,
  type DraftGame,
  type DraftSeries,
  type Game7Rule,
  type HeroKey,
  type SeriesFormat,
  type TeamKey,
} from "./series";

// Editor state for the Draft Assistant: the series, which game is open, and which saved draft (if any) it came from.
// Persisted in sessionStorage so it survives a login redirect / refresh: a draft is never silently discarded.
export interface DraftSession {
  series: DraftSeries;
  gameNumber: number;
  draftId: string | null;
  title: string;
  description: string;
  visibility: Visibility; // of the saved row (so re-saving never changes it by accident)
}

const KEY = "rovlab:draft:session";
const INITIAL: DraftSession = {
  series: createSeries("single"),
  gameNumber: 1,
  draftId: null,
  title: "",
  description: "",
  visibility: "private",
};
const HISTORY_LIMIT = 50;

const clampGame = (n: number, series: DraftSeries) => Math.min(Math.max(Math.trunc(n) || 1, 1), series.games.length);

function sanitize(raw: DraftSession): DraftSession {
  const series = parseSeries(raw?.series) ?? INITIAL.series;
  return {
    series,
    gameNumber: clampGame(Number(raw?.gameNumber), series),
    draftId: typeof raw?.draftId === "string" ? raw.draftId : null,
    title: typeof raw?.title === "string" ? raw.title.slice(0, 80) : "",
    description: typeof raw?.description === "string" ? raw.description.slice(0, 500) : "",
    visibility: raw?.visibility === "public" ? "public" : "private",
  };
}

export function useDraftSession() {
  const [raw, setRaw] = usePersistedState<DraftSession>(KEY, INITIAL);
  const session = useMemo(() => sanitize(raw), [raw]);
  const latest = useRef(session);
  latest.current = session;

  // Undo / redo cover the series only (not which game tab is open) and live in memory.
  const [past, setPast] = useState<DraftSeries[]>([]);
  const [future, setFuture] = useState<DraftSeries[]>([]);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(INITIAL.series));

  const write = useCallback(
    (next: DraftSession) => {
      latest.current = next;
      setRaw(next);
    },
    [setRaw]
  );

  const commit = useCallback(
    (fn: (s: DraftSeries) => DraftSeries) => {
      const cur = latest.current;
      const next = fn(cur.series);
      if (next === cur.series) return;
      setPast((p) => [...p.slice(-(HISTORY_LIMIT - 1)), cur.series]);
      setFuture([]);
      write({ ...cur, series: next, gameNumber: clampGame(cur.gameNumber, next) });
    },
    [write]
  );

  const game = getGame(session.series, session.gameNumber) as DraftGame;

  return {
    session,
    series: session.series,
    gameNumber: session.gameNumber,
    game,
    draftId: session.draftId,
    title: session.title,
    description: session.description,
    visibility: session.visibility,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    dirty: useMemo(() => JSON.stringify(session.series) !== savedJson, [session.series, savedJson]),
    isBlank: useMemo(() => session.series.games.every(isGameEmpty), [session.series]),

    setGame: (n: number) => write({ ...latest.current, gameNumber: clampGame(n, latest.current.series) }),
    setPick: (team: TeamKey, index: number, hero: HeroKey | null) =>
      commit((s) => setPickAt(s, latest.current.gameNumber, team, index, hero)),
    addBan: (team: TeamKey, hero: HeroKey) => commit((s) => addBan(s, latest.current.gameNumber, team, hero)),
    removeBan: (team: TeamKey, hero: HeroKey) => commit((s) => removeBan(s, latest.current.gameNumber, team, hero)),
    setFormat: (format: SeriesFormat) => commit((s) => changeFormat(s, format)),
    setGlobal: (on: boolean) => commit((s) => setGlobalBanPick(s, on)),
    setGame7: (rule: Game7Rule) => commit((s) => setGame7Rule(s, rule)),
    resetGame: () => commit((s) => resetGameFn(s, latest.current.gameNumber)),
    resetSeries: () => commit((s) => resetSeriesFn(s)),

    undo: () => {
      const prev = past[past.length - 1];
      if (!prev) return;
      setPast(past.slice(0, -1));
      setFuture((f) => [latest.current.series, ...f]);
      write({ ...latest.current, series: prev, gameNumber: clampGame(latest.current.gameNumber, prev) });
    },
    redo: () => {
      const next = future[0];
      if (!next) return;
      setFuture(future.slice(1));
      setPast((p) => [...p.slice(-(HISTORY_LIMIT - 1)), latest.current.series]);
      write({ ...latest.current, series: next, gameNumber: clampGame(latest.current.gameNumber, next) });
    },

    /**
     * Replace the editor with a draft (My Draft / Community preset / share link). Clears history.
     * `unsaved: true` keeps it flagged as unsaved (a share link exists nowhere in the account yet).
     */
    load: (next: {
      series: DraftSeries;
      draftId: string | null;
      title: string;
      description?: string;
      visibility?: Visibility;
      unsaved?: boolean;
    }) => {
      setPast([]);
      setFuture([]);
      setSavedJson(next.unsaved ? "" : JSON.stringify(next.series));
      write({
        series: next.series,
        gameNumber: 1,
        draftId: next.draftId,
        title: next.title,
        description: next.description ?? "",
        visibility: next.visibility ?? "private",
      });
    },
    /** Call after a successful save so "unsaved changes" resets and the editor remembers the saved row. */
    markSaved: (saved: { draftId: string; title: string; description: string; visibility: Visibility }) => {
      setSavedJson(JSON.stringify(latest.current.series));
      write({ ...latest.current, ...saved });
    },
    /** The saved row was deleted: keep the content in the editor but mark it unsaved. */
    detach: () => {
      setSavedJson("");
      write({ ...latest.current, draftId: null, title: "", description: "", visibility: "private" });
    },
    startNew: () => {
      setPast([]);
      setFuture([]);
      const fresh = createSeries("single");
      setSavedJson(JSON.stringify(fresh));
      write({ series: fresh, gameNumber: 1, draftId: null, title: "", description: "", visibility: "private" });
    },
  };
}

export type DraftSessionApi = ReturnType<typeof useDraftSession>;
