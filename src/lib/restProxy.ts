// Which Supabase reads may go through the CDN-cached /api/sb handler (api/sb.ts) instead of straight to Supabase.
// Only public, read-only tables whose answer is the same for every visitor. Keep in step with PROXY_TTL in api/sb.ts
// (tests/lib/restProxy.test.ts checks they match).
export const PROXY_TABLES = [
  "heroes",
  "hero_stats",
  "hero_counters",
  "hero_synergies",
  "patches",
  "tier_lists",
  "tier_list_entries",
  "hero_balance_changes",
  "hero_abilities",
] as const;

// `input` is the full PostgREST URL supabase-js is about to fetch, `restBase` is `<supabase url>/rest/v1/`.
// Returns the same-origin /api/sb URL, or null when the request must go straight to Supabase: another table, a response shape
// other than a plain JSON array (.single()/.maybeSingle() send another Accept), or count/range requests.
export function proxyUrlFor(input: string, restBase: string, headers: Headers): string | null {
  if (!input.startsWith(restBase)) return null;
  const rest = input.slice(restBase.length);
  const q = rest.indexOf("?");
  if (q < 1) return null;
  const table = rest.slice(0, q);
  if (!(PROXY_TABLES as readonly string[]).includes(table)) return null;
  if (headers.get("accept") !== "application/json") return null;
  if (headers.has("prefer") || headers.has("range")) return null;
  return `/api/sb?t=${table}&q=${encodeURIComponent(rest.slice(q + 1))}`;
}
