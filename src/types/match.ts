export type MatchOutcome = "victory" | "defeat";
export type TeamSide = "blue" | "red";

/** One scoreboard row as read by OCR / edited by the user. Nicknames live in memory only and are never saved. */
export interface ScanPlayer {
  team: TeamSide;
  hero: string;
  playerName: string;
  kills: number;
  deaths: number;
  assists: number;
  gold: number;
  rating: number;
  mvp: boolean;
  isMe: boolean;
}

export interface ScanResult {
  result: MatchOutcome | null;
  scoreBlue: number;
  scoreRed: number;
  duration: string; // "mm:ss" as printed, "" when unreadable
  playedAt: string; // "YYYY-MM-DD HH:mm" as printed, "" when unreadable
  players: ScanPlayer[];
}

/** How the Edge Function identified the user's own row. */
export type MeSource = "name" | "highlight" | null;

/** Single-image response (legacy shape, still returned when the old `{ image }` body is sent). */
export interface ScanResponse {
  scan: ScanResult;
  meSource: MeSource;
  remaining: number;
  resetsAt: string;
}

/** One entry per image sent; `index` is 1-based and matches the order the images were sent in. */
export type ScanBatchItem =
  | { index: number; ok: true; scan: ScanResult; meSource: MeSource }
  | { index: number; ok: false; code: "not_scoreboard" | "missing"; error: string };

export interface ScanBatchResponse {
  results: ScanBatchItem[];
  remaining: number;
  resetsAt: string;
}

/** Player row as stored in match_results.players (no nicknames). */
export interface StoredPlayer {
  team: TeamSide;
  hero: string;
  heroId: string | null;
  kills: number;
  deaths: number;
  assists: number;
  gold: number;
  rating: number;
  mvp: boolean;
  isMe: boolean;
}

export interface MatchRecord {
  id: string;
  result: MatchOutcome;
  scoreBlue: number;
  scoreRed: number;
  durationSec: number;
  playedAt: string; // "YYYY-MM-DDTHH:mm:ss" wall-clock time from the scoreboard
  myTeam: TeamSide;
  myHeroId: string | null;
  myHeroName: string;
  kills: number;
  deaths: number;
  assists: number;
  gold: number;
  rating: number;
  mvp: boolean;
  players: StoredPlayer[];
  /** The user's own six item slots as saved (item slugs, null = empty slot). Empty for matches saved before items were read. */
  myItems?: (string | null)[];
  ocrEdited: boolean;
  createdAt: string;
}
