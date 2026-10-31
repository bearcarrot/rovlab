import { cached, isCacheBypassed } from "@/lib/ttlCache";
import { loadRows } from "@/lib/snapshotCore";

// Reads public game-data snapshots published to R2 (docs/r2-data-snapshots.md). Supabase stays the source of truth: every caller
// keeps its normal Supabase query and uses it whenever this returns null (disabled, manifest or dataset missing, bad schema,
// network/CORS error, row count that does not match the manifest). Admins bypass snapshots so they always see their own edits.
//
// Off by default: set VITE_R2_SNAPSHOTS=1 on Vercel to enable. Even when enabled nothing changes until an admin publishes a dataset
// (data/manifest.json lists it), and removing a dataset from the manifest turns it off again without a deploy.

const ENABLED = import.meta.env.VITE_R2_SNAPSHOTS === "1";
const BASE = ((import.meta.env.VITE_ASSETS_BASE as string | undefined) ?? "https://assets.rovlab.app").replace(/\/+$/, "");
const MANIFEST_URL = `${BASE}/data/manifest.json`;

// The manifest is the only mutable object (short Cache-Control at the CDN). Keep it in memory only (key is not a persisted
// prefix) so a new publish is picked up within a few minutes. Data files are content-addressed, so "snap:data:<key>" can live
// in localStorage (ttlCache persists that prefix for 6 h); a new publish simply means a new key.
const MANIFEST_TTL_MS = 5 * 60 * 1000;
const DATA_TTL_MS = 6 * 60 * 60 * 1000;
const FAIL_BACKOFF_MS = 60 * 1000;
let failedUntil = 0; // after a failure, skip snapshots for a minute instead of retrying on every call

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) throw new Error(`snapshot ${res.status}`);
  return res.json();
}

export async function loadSnapshotRows<T>(name: string): Promise<T[] | null> {
  if (!ENABLED || isCacheBypassed() || Date.now() < failedUntil) return null;
  const rows = await loadRows<T>(name, {
    manifest: () => cached("snapmanifest", MANIFEST_TTL_MS, () => getJson(MANIFEST_URL), (v) => v != null),
    body: (key) => cached(`snap:data:${key}`, DATA_TTL_MS, () => getJson(`${BASE}/${key}`), (v) => v != null),
  });
  if (!rows) failedUntil = Date.now() + FAIL_BACKOFF_MS;
  return rows;
}
