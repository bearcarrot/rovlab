// Public Home-page statistics. The count is served by /api/public-stats (CDN-cached for 24h, see api/public-stats.ts);
// the browser never queries Supabase for it. One request per page load, shared by every caller, and a failure is remembered
// for the session so nothing retries on route changes.

const ENDPOINT = "/api/public-stats";

// The server rounds down to hundreds. Below this we show nothing rather than a small number that looks unimpressive or exact.
export const MIN_VISIBLE_ACCOUNTS = 100;

export function parseAccountsResponse(v: unknown): number | null {
  const n = (v as { accounts?: unknown } | null)?.accounts;
  return typeof n === "number" && Number.isSafeInteger(n) && n >= MIN_VISIBLE_ACCOUNTS ? n : null;
}

let pending: Promise<number | null> | null = null;

export function getAccountCount(): Promise<number | null> {
  if (!pending) {
    pending = fetch(ENDPOINT, { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then(parseAccountsResponse)
      .catch(() => null);
  }
  return pending;
}

export function __resetAccountCountForTests(): void {
  pending = null;
}
