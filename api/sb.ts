// Read-through CDN cache for public, read-only Supabase tables (GET /api/sb?t=<table>&q=<PostgREST query string>).
//
// Why: the hero list, stats, tier lists, draft relations and balance changes are identical for every anonymous visitor but were
// fetched from Supabase by each one (about 80% of the project's egress). Behind this handler Vercel's CDN keeps the response for
// `s-maxage` seconds, so Supabase only answers a cache miss instead of every visitor.
//
// Safety: only the tables in PROXY_TTL, GET only, and the public anon key only (RLS decides what is visible, same as a direct
// request from the browser). The client (src/lib/restProxy.ts + supabase.ts) uses it for logged-out visitors only and falls back
// to a direct Supabase request if this handler is missing or fails. Admins/logged-in users never come through here.

export const config = { runtime: "edge" };

// table -> [s-maxage, stale-while-revalidate] in seconds. Keep the table names in step with PROXY_TABLES in src/lib/restProxy.ts
// (tests/lib/restProxy.test.ts checks they match).
export const PROXY_TTL: Record<string, [number, number]> = {
  heroes: [600, 3600],
  hero_stats: [600, 3600],
  patches: [600, 3600],
  tier_lists: [600, 3600],
  tier_list_entries: [600, 3600],
  hero_balance_changes: [600, 3600],
  hero_counters: [1800, 86400],
  hero_synergies: [1800, 86400],
  hero_abilities: [1800, 86400],
};

const MAX_QUERY = 2000;
const BAD_QUERY = /[\u0000-\u001f\u007f#]/; // control characters / fragments never belong in a PostgREST query

type Env = Record<string, string | undefined>;
const readEnv = (): Env => (globalThis as { process?: { env?: Env } }).process?.env ?? {};

const plain = (status: number, body: string, extra: Record<string, string> = {}) =>
  new Response(body, { status, headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8", ...extra } });

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") return plain(405, "Method not allowed", { allow: "GET" });
  const url = new URL(request.url);
  const table = url.searchParams.get("t") ?? "";
  const query = url.searchParams.get("q") ?? "";
  if (!Object.prototype.hasOwnProperty.call(PROXY_TTL, table)) return plain(403, "Table not allowed");
  if (!query || query.length > MAX_QUERY || BAD_QUERY.test(query)) return plain(400, "Bad query");

  const env = readEnv();
  const base = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
  if (!base || !key) return plain(503, "Not configured");

  const headers: Record<string, string> = { apikey: key, Accept: "application/json" };
  // New-style publishable keys are not JWTs and must not be sent as a bearer token.
  if (!key.startsWith("sb_")) headers.Authorization = `Bearer ${key}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const upstream = await fetch(`${base.replace(/\/+$/, "")}/rest/v1/${table}?${query}`, { headers, signal: ctrl.signal });
    const body = await upstream.text();
    const type = upstream.headers.get("content-type") ?? "application/json";
    if (!upstream.ok) {
      // never cache an error; the client retries the request directly against Supabase
      return new Response(body, { status: upstream.status, headers: { "cache-control": "no-store", "content-type": type } });
    }
    const [maxAge, swr] = PROXY_TTL[table];
    return new Response(body, {
      status: 200,
      headers: { "content-type": type, "cache-control": `public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=${swr}` },
    });
  } catch {
    return plain(502, "Upstream unavailable");
  } finally {
    clearTimeout(timer);
  }
}
