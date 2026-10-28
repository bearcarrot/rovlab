// Public aggregate stats for the Home page: GET /api/public-stats -> { "accounts": <number> }.
//
// The number comes from the get_public_account_count() RPC (rounded down to the nearest 100, nothing else is returned), called
// with the public anon key only. Vercel's CDN keeps a good answer for 24h (s-maxage), so Supabase is asked about once a day
// instead of once per visitor.
//
// Failure behaviour: an error is never cached by the CDN. Per edge instance, after a failure we stop calling Supabase for
// FAIL_COOLDOWN_MS and answer from the last good value if this instance has one (short cache), otherwise 503. The client then
// simply hides the line.

export const config = { runtime: "edge" };

const TTL = 86400; // 24h on the CDN
const SWR = 604800; // may serve a stale value for up to 7 days while it refreshes
const FAIL_COOLDOWN_MS = 5 * 60 * 1000;

type Env = Record<string, string | undefined>;
const readEnv = (): Env => (globalThis as { process?: { env?: Env } }).process?.env ?? {};

let lastGood: number | null = null;
let failedUntil = 0;

export function __resetPublicStatsForTests(): void {
  lastGood = null;
  failedUntil = 0;
}

export function parseAccounts(v: unknown): number | null {
  return typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : null;
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
    return reply(200, { accounts: lastGood }, "public, max-age=0, s-maxage=300, stale-while-revalidate=3600");
  }
  return reply(503, { accounts: null }, "no-store");
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") return reply(405, "Method not allowed", "no-store", { allow: "GET" });
  // No parameters: every distinct query string would otherwise be its own CDN cache entry and its own Supabase call.
  if (new URL(request.url).search) return reply(400, "No parameters accepted", "no-store");

  if (Date.now() < failedUntil) return failure();

  const env = readEnv();
  const base = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
  if (!base || !key) return reply(503, { accounts: null }, "no-store");

  const headers: Record<string, string> = { apikey: key, Accept: "application/json", "Content-Type": "application/json" };
  // New-style publishable keys are not JWTs and must not be sent as a bearer token.
  if (!key.startsWith("sb_")) headers.Authorization = `Bearer ${key}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const upstream = await fetch(`${base.replace(/\/+$/, "")}/rest/v1/rpc/get_public_account_count`, {
      method: "POST",
      headers,
      body: "{}",
      signal: ctrl.signal,
    });
    if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
    const accounts = parseAccounts(await upstream.json());
    if (accounts === null) throw new Error("unexpected payload");
    lastGood = accounts;
    failedUntil = 0;
    return reply(200, { accounts }, `public, max-age=0, s-maxage=${TTL}, stale-while-revalidate=${SWR}`);
  } catch {
    failedUntil = Date.now() + FAIL_COOLDOWN_MS;
    return failure();
  } finally {
    clearTimeout(timer);
  }
}
