import type { HeroSummary } from "@/types/hero";
import type { MatchOutcome, ScanPlayer, ScanResult } from "@/types/match";

// Pure helpers for the scoreboard review flow (no React, no network).

/** What the user edits on the review screen. playedAt uses the <input type="datetime-local"> format. */
export interface ScanDraft {
  result: MatchOutcome | "";
  scoreBlue: number;
  scoreRed: number;
  duration: string; // "mm:ss"
  playedAt: string; // "YYYY-MM-DDTHH:mm"
  players: ScanPlayer[];
}

export type IssueCode =
  | "player_count"
  | "me"
  | "hero_empty"
  | "hero_ambiguous"
  | "result"
  | "duration"
  | "date"
  | "numbers"
  | "kills_blue"
  | "kills_red";

export interface Issue {
  code: IssueCode;
  message: string;
  /** blocking issues disable the Save button; the rest are warnings */
  blocking: boolean;
}

/** Lower-case letters/digits only, so "Y'bneth" === "ybneth" and Ø-style symbols do not break matching. */
export const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** "Flowborn (Mage)" -> "Flowborn". The scoreboard prints only the base name. */
const baseName = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, "");

export function parseDuration(s: string): number | null {
  const m = /^(\d{1,3}):([0-5]\d)$/.exec(s.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export const formatDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

function editDistance(a: string, b: string): number {
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

export type HeroMatch =
  | { kind: "found"; hero: HeroSummary }
  | { kind: "ambiguous"; heroes: HeroSummary[] }
  | { kind: "none" };

const pick = (list: HeroSummary[]): HeroMatch | null =>
  list.length === 1 ? { kind: "found", hero: list[0] } : list.length > 1 ? { kind: "ambiguous", heroes: list } : null;

/**
 * 1) full name (English/Thai), 2) base name without the "(Role)" suffix — several heroes can share it
 * (Flowborn Mage/Carry), then the user must pick one — 3) a unique near match (1 typo, names of 5+ letters).
 */
export function matchHero(name: string, heroes: HeroSummary[]): HeroMatch {
  const n = norm(name);
  if (!n) return { kind: "none" };

  const exact = pick(heroes.filter((h) => norm(h.name) === n || norm(h.nameTh) === n));
  if (exact) return exact;

  const base = pick(heroes.filter((h) => norm(baseName(h.name)) === n || norm(baseName(h.nameTh)) === n));
  if (base) return base;

  if (n.length >= 5) {
    const near = heroes.filter((h) => editDistance(norm(baseName(h.name)), n) <= 1);
    if (near.length === 1) return { kind: "found", hero: near[0] };
  }
  return { kind: "none" };
}

/** The hero when exactly one matches, otherwise null (not found, or ambiguous and not chosen yet). */
export function resolveHero(name: string, heroes: HeroSummary[]): HeroSummary | null {
  const m = matchHero(name, heroes);
  return m.kind === "found" ? m.hero : null;
}

export function scanToDraft(scan: ScanResult): ScanDraft {
  return {
    result: scan.result ?? "",
    scoreBlue: scan.scoreBlue,
    scoreRed: scan.scoreRed,
    duration: scan.duration,
    playedAt: scan.playedAt.replace(" ", "T"),
    players: scan.players.map((p) => ({ ...p })),
  };
}

/** Used to tell whether the user changed anything the OCR returned. Nicknames are ignored. */
export function fingerprint(d: ScanDraft): string {
  return JSON.stringify({
    r: d.result,
    s: [d.scoreBlue, d.scoreRed],
    d: d.duration,
    t: d.playedAt,
    p: d.players.map((p) => [p.team, norm(p.hero), p.kills, p.deaths, p.assists, p.gold, p.rating, p.mvp, p.isMe]),
  });
}

const badNumber = (n: number, max: number) => !Number.isFinite(n) || n < 0 || n > max;

export function checkDraft(d: ScanDraft, heroes: HeroSummary[] = []): Issue[] {
  const issues: Issue[] = [];
  const blue = d.players.filter((p) => p.team === "blue");
  const red = d.players.filter((p) => p.team === "red");

  if (blue.length !== 5 || red.length !== 5) {
    issues.push({ code: "player_count", message: `อ่านผู้เล่นได้ ${blue.length} + ${red.length} คน (ต้องเป็น 5 + 5) ลองถ่ายรูปใหม่ให้เห็นครบทั้งสองทีม`, blocking: true });
  }
  const mine = d.players.filter((p) => p.isMe);
  if (mine.length !== 1) {
    issues.push({ code: "me", message: "เลือกแถวของคุณ (วงกลมหน้าชื่อฮีโร่)", blocking: true });
  } else if (heroes.length > 0) {
    // Only the user's own hero must be exact: it drives the hero stats. Other rows may stay as typed.
    const m = matchHero(mine[0].hero, heroes);
    if (m.kind === "ambiguous") {
      issues.push({
        code: "hero_ambiguous",
        message: `ฮีโร่ของคุณมีหลายตำแหน่ง กรุณาเลือกให้ตรงกับที่ใช้ (${m.heroes.map((h) => h.name).join(" / ")})`,
        blocking: true,
      });
    }
  }
  if (d.players.some((p) => !p.hero.trim())) {
    issues.push({ code: "hero_empty", message: "มีแถวที่ยังไม่ได้ใส่ชื่อฮีโร่", blocking: true });
  }
  if (!d.result) issues.push({ code: "result", message: "เลือกผล ชนะ/แพ้", blocking: true });

  const sec = parseDuration(d.duration);
  if (sec === null || sec < 30 || sec > 7200) {
    issues.push({ code: "duration", message: "เวลาเกมต้องอยู่ในรูปแบบ นาที:วินาที เช่น 13:49", blocking: true });
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(d.playedAt) || Number.isNaN(Date.parse(d.playedAt))) {
    issues.push({ code: "date", message: "วันที่/เวลาของแมตช์ไม่ถูกต้อง", blocking: true });
  }
  if (
    badNumber(d.scoreBlue, 200) ||
    badNumber(d.scoreRed, 200) ||
    d.players.some(
      (p) =>
        badNumber(p.kills, 200) || badNumber(p.deaths, 200) || badNumber(p.assists, 300) ||
        badNumber(p.gold, 100000) || badNumber(p.rating, 30),
    )
  ) {
    issues.push({ code: "numbers", message: "มีตัวเลขที่ผิดปกติ (ติดลบหรือสูงเกินจริง)", blocking: true });
  }

  const sum = (ps: ScanPlayer[]) => ps.reduce((a, p) => a + p.kills, 0);
  if (blue.length === 5 && sum(blue) !== d.scoreBlue) {
    issues.push({ code: "kills_blue", message: `Kill รวมทีมฟ้า (${sum(blue)}) ไม่ตรงกับสกอร์ (${d.scoreBlue}) อาจอ่านตัวเลขผิด ตรวจกับรูปอีกครั้ง`, blocking: false });
  }
  if (red.length === 5 && sum(red) !== d.scoreRed) {
    issues.push({ code: "kills_red", message: `Kill รวมทีมแดง (${sum(red)}) ไม่ตรงกับสกอร์ (${d.scoreRed}) อาจอ่านตัวเลขผิด ตรวจกับรูปอีกครั้ง`, blocking: false });
  }
  return issues;
}

/** Row for public.match_results. Other players' nicknames are deliberately not included. */
export function draftToRow(d: ScanDraft, heroes: HeroSummary[], userId: string, edited: boolean) {
  const me = d.players.find((p) => p.isMe);
  const sec = parseDuration(d.duration);
  if (!me || sec === null || !d.result) throw new Error("ข้อมูลยังไม่ครบ");

  const players = d.players.map((p) => {
    const h = resolveHero(p.hero, heroes);
    return {
      team: p.team,
      hero: h?.name ?? p.hero.trim(),
      hero_id: h?.id ?? null,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      gold: p.gold,
      rating: Math.round(p.rating * 10) / 10,
      mvp: p.mvp,
      is_me: p.isMe,
    };
  });
  const mine = players.find((p) => p.is_me)!;

  return {
    user_id: userId,
    result: d.result,
    score_blue: d.scoreBlue,
    score_red: d.scoreRed,
    duration_sec: sec,
    played_at: `${d.playedAt.replace("T", " ")}:00`,
    my_team: me.team,
    my_hero_id: mine.hero_id,
    my_hero_name: mine.hero,
    my_kills: me.kills,
    my_deaths: me.deaths,
    my_assists: me.assists,
    my_gold: me.gold,
    my_rating: mine.rating,
    my_mvp: me.mvp,
    players,
    ocr_edited: edited,
  };
}
