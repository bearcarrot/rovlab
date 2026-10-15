import { supabase } from "@/lib/supabase";
import { functionErrorMessage } from "@/lib/functionError";
import type { draftToRow } from "@/features/matches/scan";
import type { MatchRecord, ScanBatchResponse, StoredPlayer } from "@/types/match";

// Scoreboard OCR (Edge Function `scoreboard-ocr`) and the user's own saved matches (public.match_results, RLS: own rows).
// Errors thrown here carry a Thai message that is safe to show in a toast; the raw database error goes to the console.

export type MatchInsert = ReturnType<typeof draftToRow>;

/** Same limit as the Edge Function. One request = one Gemini call, whatever the number of images. */
export const MAX_SCAN_IMAGES = 3;

/**
 * Sends 1-3 client-resized JPEGs (base64) in ONE request. The daily per-user quota counts images, the system quota counts
 * requests. Nothing is saved. Entries come back in the same order as `images` (`index` is 1-based).
 */
export async function scanScoreboards(images: string[]): Promise<ScanBatchResponse> {
  const { data, error } = await supabase.functions.invoke("scoreboard-ocr", { body: { images } });
  if (error) throw new Error(await functionErrorMessage(error, "วิเคราะห์รูปไม่สำเร็จ ลองใหม่อีกครั้ง"));
  return data as ScanBatchResponse;
}

// my_items needs migration 20261013_match_my_items.sql (applied in production).
const COLS =
  "id, result, score_blue, score_red, duration_sec, played_at, my_team, my_hero_id, my_hero_name, my_kills, my_deaths, my_assists, my_gold, my_rating, my_mvp, my_items, players, ocr_edited, created_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toRecord = (r: any): MatchRecord => ({
  id: r.id,
  result: r.result,
  scoreBlue: r.score_blue,
  scoreRed: r.score_red,
  durationSec: r.duration_sec,
  playedAt: r.played_at,
  myTeam: r.my_team,
  myHeroId: r.my_hero_id ?? null,
  myHeroName: r.my_hero_name,
  kills: r.my_kills,
  deaths: r.my_deaths,
  assists: r.my_assists,
  gold: r.my_gold,
  rating: Number(r.my_rating),
  mvp: r.my_mvp === true,
  myItems: Array.isArray(r.my_items) ? (r.my_items as (string | null)[]).map((s) => s ?? null) : [],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  players: ((r.players ?? []) as any[]).map(
    (p): StoredPlayer => ({
      team: p.team,
      hero: p.hero,
      heroId: p.hero_id ?? null,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      gold: p.gold,
      rating: Number(p.rating),
      mvp: p.mvp === true,
      isMe: p.is_me === true,
    }),
  ),
  ocrEdited: r.ocr_edited === true,
  createdAt: r.created_at,
});

/** Newest first by the time printed on the scoreboard. */
export async function listMyMatches(limit = 100): Promise<MatchRecord[]> {
  const { data, error } = await supabase
    .from("match_results")
    .select(COLS)
    .order("played_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("listMyMatches", error);
    throw new Error("โหลดแมตช์ไม่สำเร็จ");
  }
  return (data ?? []).map(toRecord);
}

/**
 * Saved matches (own rows, RLS) with exactly this printed time and length. An exact duplicate must share both, so this is
 * all the duplicate check has to read. Throws when the lookup fails: the caller must then NOT save.
 */
export async function findSameSlot(playedAt: string, durationSec: number): Promise<MatchRecord[]> {
  const { data, error } = await supabase
    .from("match_results")
    .select(COLS)
    .eq("played_at", playedAt)
    .eq("duration_sec", durationSec);
  if (error) {
    console.error("findSameSlot", error);
    throw new Error("ตรวจแมตช์ซ้ำไม่สำเร็จ ยังไม่ได้บันทึก ลองใหม่อีกครั้ง");
  }
  return (data ?? []).map(toRecord);
}

/** Thrown when the database itself rejects the insert: unique (user_id, played_at, duration_sec). Covers races and retries. */
export class DuplicateMatchError extends Error {
  constructor() {
    super("บันทึกแมตช์ไม่สำเร็จ: มีแมตช์ที่เวลาและความยาวเกมเท่ากันถูกบันทึกไว้แล้ว");
  }
}

export async function saveMatch(row: MatchInsert): Promise<void> {
  const { error } = await supabase.from("match_results").insert(row);
  if (error) {
    if (error.code === "23505") throw new DuplicateMatchError();
    console.error("saveMatch", error);
    throw new Error("บันทึกแมตช์ไม่สำเร็จ");
  }
}

export async function deleteMatch(id: string): Promise<void> {
  const { error } = await supabase.from("match_results").delete().eq("id", id);
  if (error) {
    console.error("deleteMatch", error);
    throw new Error("ลบแมตช์ไม่สำเร็จ");
  }
}
