import { isCacheBypassed } from "@/lib/ttlCache";

// Short-lived localStorage copy of the PUBLIC site status (maintenance window, announcement list + schedule), so a full
// page reload does not ask Supabase again within SITE_PERSIST_TTL_MS. Same namespace as ttlCache, so setCacheBypass(true)
// (admins) wipes it; reads and writes are also skipped while bypassed. Never store per-user data here.
const KEY = "rovlab:cache:v2:site:";
export const SITE_PERSIST_TTL_MS = 5 * 60 * 1000;

export function readSiteCache<T>(name: string): T | null {
  if (isCacheBypassed()) return null;
  try {
    const raw = localStorage.getItem(KEY + name);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { at: number; v: T };
    const age = Date.now() - saved.at;
    if (typeof saved.at === "number" && age >= 0 && age < SITE_PERSIST_TTL_MS) return saved.v;
    localStorage.removeItem(KEY + name);
  } catch {
    // storage blocked or entry corrupt: behave as a miss
  }
  return null;
}

export function writeSiteCache(name: string, v: unknown): void {
  if (isCacheBypassed()) return;
  try {
    localStorage.setItem(KEY + name, JSON.stringify({ at: Date.now(), v }));
  } catch {
    // quota exceeded or storage blocked
  }
}
