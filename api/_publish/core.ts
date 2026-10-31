// Pure logic for publishing public game-data snapshots to R2 (docs/r2-data-snapshots.md). No imports on purpose: api/publish-data.ts
// wires env, Supabase and R2, and tests/publish/core.test.ts drives this file with fakes.
//
// Safety model:
//  - Data files are content-addressed (data/v/<name>/<hash12>.json) and immutable, so a half-finished publish can only leave
//    unreferenced files behind; nothing a visitor reads changes until the manifest is replaced.
//  - data/manifest.json is the single commit point, replaced with a conditional PUT (If-Match / If-None-Match).
//  - The manifest being replaced is first copied to data/manifest-history/<generation>.json, so rollback is one call.

export type Row = Record<string, unknown>;
export type DatasetDef = { name: string; table: string; columns: readonly string[]; order: string; minRows: number };

export const SCHEMA = 1;
export const MANIFEST_KEY = "data/manifest.json";
export const historyKey = (generation: number): string => `data/manifest-history/${generation}.json`;

// Approved public fields only. Keep `heroes` equal to HERO_LIST_COLS in src/services/heroes.ts (a test checks the order).
export const DATASETS: Record<string, DatasetDef> = {
  heroes: {
    name: "heroes",
    table: "heroes",
    columns: ["id", "slug", "name", "name_th", "role", "lane", "roles", "lanes", "difficulty", "icon_url", "phase"],
    order: "name.asc",
    minRows: 50,
  },
  "hero-text": {
    name: "hero-text",
    table: "heroes",
    columns: ["id", "slug", "description", "strengths", "weaknesses"],
    order: "name.asc",
    minRows: 50,
  },
};

export const isDatasetName = (n: unknown): n is string => typeof n === "string" && Object.prototype.hasOwnProperty.call(DATASETS, n);

export type Entry = { key: string; count: number; bytes: number; schema: number };
export type Manifest = { schema: number; generation: number; generatedAt: string; datasets: Record<string, Entry> };

const KEY_RE = /^data\/v\/[a-z0-9-]+\/[0-9a-f]{12}\.json$/;

export function parseManifest(x: unknown): Manifest | null {
  if (!x || typeof x !== "object") return null;
  const m = x as Partial<Manifest>;
  if (m.schema !== SCHEMA || typeof m.generation !== "number" || !Number.isInteger(m.generation) || m.generation < 0) return null;
  if (typeof m.generatedAt !== "string" || !m.datasets || typeof m.datasets !== "object") return null;
  const datasets: Record<string, Entry> = {};
  for (const [name, e] of Object.entries(m.datasets)) {
    const v = e as Partial<Entry> | null;
    if (!v || typeof v.key !== "string" || !KEY_RE.test(v.key) || !v.key.startsWith(`data/v/${name}/`)) return null;
    if (typeof v.count !== "number" || typeof v.bytes !== "number" || v.schema !== SCHEMA) return null;
    datasets[name] = { key: v.key, count: v.count, bytes: v.bytes, schema: v.schema };
  }
  return { schema: SCHEMA, generation: m.generation, generatedAt: m.generatedAt, datasets };
}

// Fixed column order, missing -> null: the file is byte-identical for identical data, and extra columns never leak in.
export function pickColumns(def: DatasetDef, rows: unknown[]): Row[] {
  return rows.map((r) => {
    if (!r || typeof r !== "object") throw new Error("row is not an object");
    const src = r as Row;
    const out: Row = {};
    for (const c of def.columns) out[c] = src[c] === undefined ? null : src[c];
    return out;
  });
}

async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function buildBody(def: DatasetDef, rows: unknown[]): Promise<{ key: string; json: string; count: number; bytes: number }> {
  const picked = pickColumns(def, rows);
  const json = JSON.stringify({ schema: SCHEMA, rows: picked });
  const hash = (await sha256Hex(json)).slice(0, 12);
  return { key: `data/v/${def.name}/${hash}.json`, json, count: picked.length, bytes: new TextEncoder().encode(json).length };
}

// Refuse to publish an empty/truncated read (RLS slip, outage, wrong filter) as if it were the truth.
export function checkCount(def: DatasetDef, count: number, prev: Entry | undefined, force: boolean): string | null {
  if (force) return count > 0 ? null : `${def.name}: refusing to publish 0 rows`;
  if (count < def.minRows) return `${def.name}: only ${count} rows (minimum ${def.minRows})`;
  if (prev && count < prev.count * 0.5) return `${def.name}: ${count} rows is under half of the published ${prev.count}`;
  return null;
}

export function mergeManifest(prev: Manifest | null, updates: Record<string, Entry>, nowIso: string): Manifest {
  return { schema: SCHEMA, generation: (prev?.generation ?? 0) + 1, generatedAt: nowIso, datasets: { ...(prev?.datasets ?? {}), ...updates } };
}

export type ManifestRead = { manifest: Manifest | null; etag: string | null } | "error";

export type PublishDeps = {
  now(): string;
  fetchRows(def: DatasetDef): Promise<unknown[]>; // throws on any read problem
  putData(key: string, json: string): Promise<"created" | "exists" | "failed">;
  readManifest(): Promise<ManifestRead>;
  readHistory(generation: number): Promise<Manifest | null | "error">;
  putHistory(generation: number, manifest: Manifest): Promise<"created" | "exists" | "failed">;
  putManifest(manifest: Manifest, etag: string | null): Promise<"ok" | "conflict" | "failed">;
};

export type Failure = { ok: false; code: string; message: string };
export type Success = { ok: true; changed: boolean; manifest: Manifest | null; results: Record<string, "created" | "unchanged"> };
export type Outcome = Failure | Success;

const fail = (code: string, message: string): Failure => ({ ok: false, code, message });

// Re-reads the manifest, computes the next one from it, archives the old one and replaces it. One retry on a lost race.
async function commit(deps: PublishDeps, compute: (prev: Manifest | null) => Manifest | Failure | null): Promise<{ manifest: Manifest | null; changed: boolean } | Failure> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const cur = await deps.readManifest();
    if (cur === "error") return fail("MANIFEST_UNREADABLE", "ไม่สามารถอ่าน manifest ปัจจุบันได้ จึงไม่เขียนทับ");
    const next = compute(cur.manifest);
    if (next === null) return { manifest: cur.manifest, changed: false }; // nothing to change
    if ("ok" in next) return next;
    if (cur.manifest) {
      const h = await deps.putHistory(cur.manifest.generation, cur.manifest);
      if (h === "failed") return fail("HISTORY_FAILED", "บันทึกประวัติ manifest ไม่สำเร็จ (ยกเลิกการเผยแพร่เพื่อความปลอดภัย)");
    }
    const res = await deps.putManifest(next, cur.etag);
    if (res === "ok") return { manifest: next, changed: true };
    if (res === "failed") return fail("MANIFEST_FAILED", "เขียน manifest ไม่สำเร็จ");
    // conflict: someone else published first; loop re-reads and recomputes
  }
  return fail("CONFLICT", "มีการเผยแพร่พร้อมกัน กรุณาลองใหม่");
}

export async function publish(deps: PublishDeps, names: string[], opts: { force?: boolean } = {}): Promise<Outcome> {
  const unique = Array.from(new Set(names));
  if (unique.length === 0 || !unique.every(isDatasetName)) return fail("BAD_DATASET", "ชื่อ dataset ไม่ถูกต้อง");

  const before = await deps.readManifest();
  if (before === "error") return fail("MANIFEST_UNREADABLE", "ไม่สามารถอ่าน manifest ปัจจุบันได้ จึงไม่เขียนทับ");

  const built: Record<string, { def: DatasetDef; key: string; json: string; count: number; bytes: number }> = {};
  for (const name of unique) {
    const def = DATASETS[name];
    let rows: unknown[];
    try {
      rows = await deps.fetchRows(def);
    } catch {
      return fail("READ_FAILED", `${name}: อ่านข้อมูลจาก Supabase ไม่สำเร็จ`);
    }
    let b;
    try {
      b = await buildBody(def, rows);
    } catch {
      return fail("BAD_ROWS", `${name}: รูปแบบข้อมูลไม่ถูกต้อง`);
    }
    const why = checkCount(def, b.count, before.manifest?.datasets[name], opts.force === true);
    if (why) return fail("SUSPICIOUS_COUNT", why);
    built[name] = { def, ...b };
  }

  const results: Record<string, "created" | "unchanged"> = {};
  const updates: Record<string, Entry> = {};
  for (const name of unique) {
    const b = built[name];
    if (before.manifest?.datasets[name]?.key === b.key) {
      results[name] = "unchanged";
      continue;
    }
    const put = await deps.putData(b.key, b.json);
    if (put === "failed") return fail("UPLOAD_FAILED", `${name}: อัปโหลดไฟล์ไม่สำเร็จ (manifest ไม่ถูกเปลี่ยน)`);
    results[name] = "created";
    updates[name] = { key: b.key, count: b.count, bytes: b.bytes, schema: SCHEMA };
  }
  if (Object.keys(updates).length === 0) return { ok: true, changed: false, manifest: before.manifest, results };

  const done = await commit(deps, (prev) => mergeManifest(prev, updates, deps.now()));
  if ("ok" in done) return done;
  return { ok: true, changed: done.changed, manifest: done.manifest, results };
}

// Point the manifest back at an archived generation. The new manifest gets a fresh generation number.
export async function rollback(deps: PublishDeps, generation: number): Promise<Outcome> {
  if (!Number.isInteger(generation) || generation < 1) return fail("BAD_GENERATION", "generation ไม่ถูกต้อง");
  const old = await deps.readHistory(generation);
  if (old === "error") return fail("HISTORY_UNREADABLE", "อ่านประวัติ manifest ไม่สำเร็จ");
  if (!old) return fail("NOT_FOUND", `ไม่พบ manifest generation ${generation}`);
  const done = await commit(deps, (prev) => ({ ...old, generation: (prev?.generation ?? 0) + 1, generatedAt: deps.now() }));
  if ("ok" in done) return done;
  return { ok: true, changed: done.changed, manifest: done.manifest, results: {} };
}

// Kill switch: the site falls back to Supabase for this dataset as soon as visitors re-read the manifest.
export async function disable(deps: PublishDeps, name: string): Promise<Outcome> {
  if (!isDatasetName(name)) return fail("BAD_DATASET", "ชื่อ dataset ไม่ถูกต้อง");
  const done = await commit(deps, (prev) => {
    if (!prev || !prev.datasets[name]) return null;
    const datasets = { ...prev.datasets };
    delete datasets[name];
    return { ...prev, generation: prev.generation + 1, generatedAt: deps.now(), datasets };
  });
  if ("ok" in done) return done;
  return { ok: true, changed: done.changed, manifest: done.manifest, results: {} };
}
