import { supabase } from "@/lib/supabase";
import { functionErrorMessage } from "@/lib/functionError";
import type { draftToRow } from "@/features/matches/scan";
import type { MatchRecord, ScanResponse, StoredPlayer } from "@/types/match";

// Scoreboard OCR (Edge Function `scoreboard-ocr`) and the user's own saved matches (public.match_results, RLS: own rows).

export type MatchInsert = ReturnType<typeof draftToRow>;

/** Sends a client-resized JPEG (base64) to be read. Counts against the daily quota; nothing is saved. */
export async function scanScoreboard(base64: string): Promise<ScanResponse> {
  const { data, error } = await supabase.functions.invoke("scoreboard-ocr", { body: { image: base64 } });
  if (error) throw new Error(await functionErrorMessage(error, "อ่านรูปไม่สำเร็จ ลองใหม่อีกครั้ง"));
  return data as ScanResponse;
}

const COLS =
  "id, result, score_blue, score_red, duration_sec, played_at, my_team, my_hero_id, my_hero_name, my_kills, my_deaths, my_assists, my_gold, my_rating, my_mvp, players, ocr_edited, created_at";

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
  if (error) throw new Error(error.message || "โหลดแมตช์ไม่สำเร็จ");
  return (data ?? []).map(toRecord);
}

export async function saveMatch(row: MatchInsert): Promise<void> {
  const { error } = await supabase.from("match_results").insert(row);
  if (error) {
    if (error.code === "23505") throw new Error("แมตช์นี้ถูกบันทึกไว้แล้ว");
    throw new Error(error.message || "บันทึกแมตช์ไม่สำเร็จ");
  }
}

export async function deleteMatch(id: string): Promise<void> {
  const { error } = await supabase.from("match_results").delete().eq("id", id);
  if (error) throw new Error(error.message || "ลบแมตช์ไม่สำเร็จ");
}
