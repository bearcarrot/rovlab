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
import { movePick as movePickFn } from "./movePick";

// Editor state for the Draft Assistant: the series, which game is open, and which saved draft (if any) it came from.
// Persisted in sessionStorage so it survives a login redirect / refresh: a draft is never silently discarded.
export interface DraftSession {
  series: DraftSeries;
  gameNumber: number;
  draftId: string | null;
  title: string;
  description: string;
  visibility: Visibility; // of the saved row (so re-saving never changes it by accident)
  // JSON of the series as last saved/loaded: the baseline for "unsaved changes".
  // Persisted with the session so a refresh / login redirect does not make a saved draft look unsaved.
  // Missing (older sessions) = blank baseline, same as before.
  savedJson?: string | null;
}

const KEY = "rovlab:draft:session";
const INITIAL: DraftSession = {
  series: createSeries("single"),
  gameNumber: 1,
  draftId: null,
  title: "",
  description: "",
  visibility: "private",
  savedJson: null,
};
const BLANK_JSON = JSON.stringify(INITIAL.series);
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
    savedJson: typeof raw?.savedJson === "string" ? raw.savedJson : null,
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
  const savedJson = session.savedJson ?? BLANK_JSON;

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
    /** Swap two slots of the same team (or move a hero into an empty slot) as one undoable step. */
    movePick: (team: TeamKey, from: number, to: number) =>
      commit((s) => movePickFn(s, latest.current.gameNumber, team, from, to)),
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

    /** Replace the editor with a draft (My Draft / Community preset). Clears history. */
    load: (next: { series: DraftSeries; draftId: string | null; title: string; description?: string; visibility?: Visibility }) => {
      setPast([]);
      setFuture([]);
      write({
        series: next.series,
        gameNumber: 1,
        draftId: next.draftId,
        title: next.title,
        description: next.description ?? "",
        visibility: next.visibility ?? "private",
        savedJson: JSON.stringify(next.series),
      });
    },
    /** Call after a successful save so "unsaved changes" resets and the editor remembers the saved row. */
    markSaved: (saved: { draftId: string; title: string; description: string; visibility: Visibility }) => {
      write({ ...latest.current, ...saved, savedJson: JSON.stringify(latest.current.series) });
    },
    /** The saved row was deleted: keep the content in the editor but mark it unsaved. */
    detach: () => {
      write({ ...latest.current, draftId: null, title: "", description: "", visibility: "private", savedJson: "" });
    },
    startNew: () => {
      setPast([]);
      setFuture([]);
      const fresh = createSeries("single");
      write({
        series: fresh,
        gameNumber: 1,
        draftId: null,
        title: "",
        description: "",
        visibility: "private",
        savedJson: JSON.stringify(fresh),
      });
    },
  };
}

export type DraftSessionApi = ReturnType<typeof useDraftSession>;
