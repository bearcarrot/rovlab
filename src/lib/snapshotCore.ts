// Pure client logic for reading public data snapshots from R2 (docs/r2-data-snapshots.md). No imports on purpose, so it can be
// unit-tested in plain node. src/lib/snapshots.ts wires fetch + ttlCache around it.
//
// Anything unexpected (missing dataset, wrong schema, bad key, row count that does not match the manifest, malformed rows)
// returns null and the caller falls back to the normal Supabase query. A snapshot is never trusted partially.

export const SNAPSHOT_SCHEMA = 1;

export type SnapshotEntry = { key: string; count: number; bytes: number | null; schema: number };

const KEY_RE = /^data\/v\/[a-z0-9-]+\/[0-9a-f]{12}\.json$/;

export function entryFor(manifest: unknown, name: string): SnapshotEntry | null {
  if (!manifest || typeof manifest !== "object") return null;
  const m = manifest as { schema?: unknown; datasets?: unknown };
  if (m.schema !== SNAPSHOT_SCHEMA || !m.datasets || typeof m.datasets !== "object") return null;
  const e = (m.datasets as Record<string, unknown>)[name];
  if (!e || typeof e !== "object") return null;
  const { key, count, schema, bytes } = e as Record<string, unknown>;
  if (typeof key !== "string" || !KEY_RE.test(key) || !key.startsWith(`data/v/${name}/`)) return null;
  if (schema !== SNAPSHOT_SCHEMA || typeof count !== "number" || !Number.isInteger(count) || count < 1) return null;
  return { key, count, schema, bytes: typeof bytes === "number" ? bytes : null };
}

export function rowsFrom<T>(body: unknown, entry: SnapshotEntry): T[] | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { schema?: unknown; rows?: unknown };
  if (b.schema !== SNAPSHOT_SCHEMA || !Array.isArray(b.rows) || b.rows.length !== entry.count) return null;
  for (const r of b.rows) {
    if (!r || typeof r !== "object") return null;
    const row = r as { id?: unknown; slug?: unknown };
    if (typeof row.id !== "string" || typeof row.slug !== "string") return null;
  }
  return b.rows as T[];
}

export type SnapshotDeps = {
  manifest(): Promise<unknown>;
  body(key: string): Promise<unknown>;
};

export async function loadRows<T>(name: string, deps: SnapshotDeps): Promise<T[] | null> {
  try {
    const entry = entryFor(await deps.manifest(), name);
    if (!entry) return null;
    return rowsFrom<T>(await deps.body(entry.key), entry);
  } catch {
    return null;
  }
}
