// Pure codecs for share links (no React / Supabase).
// A link carries a snapshot of the content inside the URL itself, so it works for anyone, needs no login and no DB row.
// Heroes are referenced by slug (stable), never by DB id, so a link survives re-seeding the database.
//
// Draft: s=<head>~<game>~<game>...   head = "1" + format(s|3|5|7) + globalBanPick(0|1) + game7Rule(n|g|u)
//        game = minePicks_enemyPicks_mineBans_enemyBans   (heroes joined by ".", an empty pick slot is an empty string)
// Tier:  s=1<S+>_<S>_<A>_<B>_<C>                          (heroes joined by ".")
// If any slug has characters outside [a-z0-9-] the code falls back to "j" + base64url(JSON), so nothing is ever lost.
// New kinds (e.g. Community Item Build) add their own encode/decode pair here and reuse the same `s` param.

import { GAME_COUNT, parseSeries, type DraftSeries, type Game7Rule, type SeriesFormat } from "@/features/draft/series";
import { TIER_KEYS, emptyTierData, parseTierData, tierHeroCount, type TierData } from "@/features/tierlist/tierData";

export const SHARE_PARAM = "s"; // the encoded content
export const NAME_PARAM = "n"; // display name (draft title / tier list name)
export const PATCH_PARAM = "p"; // patch label (tier list)

const SLUG = /^[a-z0-9-]{1,64}$/;
const MAX_CODE = 6000; // refuse absurd input before parsing

const FORMAT_TO_CODE: Record<SeriesFormat, string> = { single: "s", bo3: "3", bo5: "5", bo7: "7" };
const CODE_TO_FORMAT: Record<string, SeriesFormat> = { s: "single", "3": "bo3", "5": "bo5", "7": "bo7" };
const RULE_TO_CODE: Record<Game7Rule, string> = { normal: "n", global: "g", ultimate: "u" };
const CODE_TO_RULE: Record<string, Game7Rule> = { n: "normal", g: "global", u: "ultimate" };

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] as number);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(code: string): string {
  const b64 = code.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

const joinPicks = (picks: (string | null)[]): string => {
  const a = picks.map((h) => h ?? "");
  while (a.length > 0 && a[a.length - 1] === "") a.pop(); // trailing empty slots are implied
  return a.join(".");
};

// ---------- Draft ----------

export function encodeSeries(series: DraftSeries): string {
  const heroes = series.games.flatMap((g) => [...g.mine.picks, ...g.enemy.picks, ...g.mine.bans, ...g.enemy.bans]);
  if (!heroes.every((h) => h === null || SLUG.test(h))) return "j" + toBase64Url(JSON.stringify(series));
  const head = `1${FORMAT_TO_CODE[series.format]}${series.globalBanPick ? 1 : 0}${RULE_TO_CODE[series.game7Rule]}`;
  const games = series.games.map((g) =>
    [joinPicks(g.mine.picks), joinPicks(g.enemy.picks), g.mine.bans.join("."), g.enemy.bans.join(".")].join("_")
  );
  return [head, ...games].join("~");
}

/** Returns a validated series (via parseSeries, never trusts the URL) or null when the code is unusable. */
export function decodeSeries(code: string): DraftSeries | null {
  if (!code || code.length > MAX_CODE) return null;
  try {
    if (code.startsWith("j")) return parseSeries(JSON.parse(fromBase64Url(code.slice(1))));
    const [head = "", ...games] = code.split("~");
    const m = /^1([s357])([01])([ngu])$/.exec(head);
    if (!m) return null;
    const format = CODE_TO_FORMAT[m[1] ?? ""];
    const game7Rule = CODE_TO_RULE[m[3] ?? ""];
    if (!format || !game7Rule) return null;
    const picks = (s: string) => s.split(".").map((x) => x || null);
    const bans = (s: string) => (s === "" ? [] : s.split(".").filter((x) => x !== ""));
    return parseSeries({
      format,
      globalBanPick: m[2] === "1",
      game7Rule,
      games: games.slice(0, GAME_COUNT[format]).map((g) => {
        const [mp = "", ep = "", mb = "", eb = ""] = g.split("_");
        return { mine: { picks: picks(mp), bans: bans(mb) }, enemy: { picks: picks(ep), bans: bans(eb) } };
      }),
    });
  } catch {
    return null;
  }
}

// ---------- Tier List ----------

/** `tiers` holds hero ids (what the editor stores); ids with no slug in the map are skipped. */
export function encodeTiers(tiers: TierData, slugById: ReadonlyMap<string, string>): string {
  const rows = TIER_KEYS.map((t) => tiers[t].map((id) => slugById.get(id)).filter((s): s is string => !!s));
  if (!rows.every((r) => r.every((s) => SLUG.test(s)))) return "j" + toBase64Url(JSON.stringify(rows));
  return "1" + rows.map((r) => r.join(".")).join("_");
}

/** Maps slugs back to hero ids. `missing` = heroes in the link that this database does not know (skipped). */
export function decodeTiers(
  code: string,
  idBySlug: ReadonlyMap<string, string>
): { data: TierData; missing: number } | null {
  if (!code || code.length > MAX_CODE) return null;
  try {
    let rows: unknown[];
    if (code.startsWith("j")) {
      const raw: unknown = JSON.parse(fromBase64Url(code.slice(1)));
      if (!Array.isArray(raw)) return null;
      rows = raw;
    } else if (code.startsWith("1")) {
      rows = code
        .slice(1)
        .split("_")
        .map((r) => (r === "" ? [] : r.split(".")));
    } else {
      return null;
    }
    const out = emptyTierData();
    const seen = new Set<string>();
    TIER_KEYS.forEach((t, i) => {
      const row = rows[i];
      if (!Array.isArray(row)) return;
      for (const slug of row) {
        if (typeof slug !== "string" || slug.length === 0 || slug.length > 64 || seen.has(slug)) continue;
        seen.add(slug);
        const id = idBySlug.get(slug);
        if (id) out[t].push(id);
      }
    });
    const data = parseTierData(out);
    return { data, missing: seen.size - tierHeroCount(data) };
  } catch {
    return null;
  }
}
