// Public sponsor list for the Home page: GET /api/public-sponsors -> { "sponsors": [{ id, name, tagline, logo_url, link_url }] }.
//
// Reads public.sponsors with the public anon key; RLS already limits it to published rows inside their schedule window.
// Every row is re-validated here (https link, logo only from assets.rovlab.app) and only five fields are re-emitted, so even a bad row
// cannot inject anything into the page. The CDN keeps an answer for 1h (s-maxage), so the browser never queries Supabase for this and
// Supabase is asked about once an hour per region. Changes made in /admin therefore show up on the Home page within about an hour.
//
// Failure behaviour is the same as api/public-stats.ts: errors are never CDN-cached, an edge instance stops calling Supabase for
// FAIL_COOLDOWN_MS after a failure, answers from its last good list (short cache) if it has one, otherwise 503 (the client shows no sponsors).

export const config = { runtime: "edge" };

const TTL = 3600;
const SWR = 86400;
const FAIL_COOLDOWN_MS = 5 * 60 * 1000;
const MAX_SPONSORS = 6;

export interface PublicSponsor {
  id: string;
  name: string;
  tagline: string;
  logo_url: string | null;
  link_url: string;
}

type Env = Record<string, string | undefined>;
const readEnv = (): Env => (globalThis as { process?: { env?: Env } }).process?.env ?? {};

let lastGood: PublicSponsor[] | null = null;
let failedUntil = 0;

export function __resetPublicSponsorsForTests(): void {
  lastGood = null;
  failedUntil = 0;
}

const HTTPS = /^https:\/\/[^\s"'<>\\]{1,2040}$/;
const LOGO = /^https:\/\/assets\.rovlab\.app\/[^\s"'<>\\?#]{1,500}\.(?:jpe?g|png|webp)$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// null = the payload is not a list at all (treated as a failure); rows that do not pass are dropped one by one.
export function parseSponsors(v: unknown): PublicSponsor[] | null {
  if (!Array.isArray(v)) return null;
  const out: PublicSponsor[] = [];
  for (const r of v) {
    if (typeof r !== "object" || r === null) continue;
    const o = r as Record<string, unknown>;
    if (typeof o.id !== "string" || !UUID.test(o.id)) continue;
    if (typeof o.name !== "string" || o.name.trim() === "" || o.name.length > 160) continue;
    if (typeof o.link_url !== "string" || !HTTPS.test(o.link_url)) continue;
    out.push({
      id: o.id,
      name: o.name,
      tagline: typeof o.tagline === "string" && o.tagline.length <= 280 ? o.tagline : "",
      logo_url: typeof o.logo_url === "string" && LOGO.test(o.logo_url) ? o.logo_url : null,
      link_url: o.link_url,
    });
    if (out.length >= MAX_SPONSORS) break;
  }
  return out;
}

const reply = (status: number, body: unknown, cacheControl: string, extra: Record<string, string> = {}) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: {
      "content-type": typeof body === "string" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8",
      "cache-control": cacheControl,
      ...extra,
    },
  });

function failure(): Response {
  if (lastGood !== null) {
    return reply(200, { sponsors: lastGood }, "public, max-age=0, s-maxage=300, stale-while-revalidate=3600");
  }
  return reply(503, { sponsors: null }, "no-store");
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") return reply(405, "Method not allowed", "no-store", { allow: "GET" });
  if (new URL(request.url).search) return reply(400, "No parameters accepted", "no-store");

  if (Date.now() < failedUntil) return failure();

  const env = readEnv();
  const base = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
  if (!base || !key) return reply(503, { sponsors: null }, "no-store");

  const headers: Record<string, string> = { apikey: key, Accept: "application/json" };
  if (!key.startsWith("sb_")) headers.Authorization = `Bearer ${key}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const upstream = await fetch(
      `${base.replace(/\/+$/, "")}/rest/v1/sponsors?select=id,name,tagline,logo_url,link_url&order=created_at.asc&limit=${MAX_SPONSORS}`,
      { headers, signal: ctrl.signal },
    );
    if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
    const sponsors = parseSponsors(await upstream.json());
    if (sponsors === null) throw new Error("unexpected payload");
    lastGood = sponsors;
    failedUntil = 0;
    return reply(200, { sponsors }, `public, max-age=0, s-maxage=${TTL}, stale-while-revalidate=${SWR}`);
  } catch {
    failedUntil = Date.now() + FAIL_COOLDOWN_MS;
    return failure();
  } finally {
    clearTimeout(timer);
  }
}
