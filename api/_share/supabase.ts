// Minimal PostgREST reader for the edge share handlers.
// Uses ONLY the public anon key, so Row Level Security decides what is visible (hidden / unpublished rows come back empty).
// Env names match scripts/prerender-meta.mjs, so no new Vercel configuration is needed.
// Returns null on ANY failure (missing env, network, timeout, non-2xx) so callers can fall back to default metadata.

type Env = Record<string, string | undefined>;
const readEnv = (): Env => (globalThis as { process?: { env?: Env } }).process?.env ?? {};

export async function restSelect<T>(table: string, query: string, timeoutMs = 3000): Promise<T[] | null> {
  const env = readEnv();
  const base = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
  if (!base || !key) return null;
  const headers: Record<string, string> = { apikey: key, Accept: "application/json" };
  // New-style publishable keys are not JWTs and must not be sent as a bearer token.
  if (!key.startsWith("sb_")) headers.Authorization = `Bearer ${key}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base.replace(/\/+$/, "")}/rest/v1/${table}?${query}`, { headers, signal: ctrl.signal });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return Array.isArray(data) ? (data as T[]) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
