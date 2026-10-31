// Admin-only: publish public game-data snapshots (JSON) to R2 so visitors read them from assets.rovlab.app instead of Supabase.
// Flow, schemas, cache policy and rollback: docs/r2-data-snapshots.md. Logic lives in ./_publish/core (tested); this file only wires
// env, Supabase and R2. Not a read proxy: visitors never call it.
//
// Authorization is the same as /api/upload: the caller's Supabase JWT goes to rpc/is_admin (no service-role key anywhere).
// Rows are read with the ANON key and explicit column lists, so a snapshot can only ever contain what any visitor can already read.

import { DATASETS, MANIFEST_KEY, historyKey, parseManifest, publish, rollback, disable, isDatasetName, type DatasetDef, type Manifest, type ManifestRead, type Outcome, type PublishDeps } from "./_publish/core";
import { r2Fetch } from "../supabase/functions/_shared/r2";

export const config = { runtime: "edge" };

type Env = Record<string, string | undefined>;
const readEnv = (): Env => (globalThis as { process?: { env?: Env } }).process?.env ?? {};

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const HTTP_FOR: Record<string, number> = {
  BAD_DATASET: 400, BAD_GENERATION: 400, BAD_ACTION: 400, SUSPICIOUS_COUNT: 422, NOT_FOUND: 404, CONFLICT: 409,
};

const IMMUTABLE = "public, max-age=31536000, immutable";
const MANIFEST_CACHE = "public, max-age=60, stale-while-revalidate=300";

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED", message: "POST only" });

  const e = readEnv();
  const sbUrl = (e.VITE_SUPABASE_URL || e.SUPABASE_URL || "").replace(/\/+$/, "");
  const anon = e.VITE_SUPABASE_ANON_KEY || e.SUPABASE_ANON_KEY || "";
  const { R2_ACCOUNT_ID: account, R2_ACCESS_KEY_ID: keyId, R2_SECRET_ACCESS_KEY: secret, R2_BUCKET_NAME: bucket } = e;
  if (!sbUrl || !anon || !account || !keyId || !secret || !bucket) {
    console.error("publish-data: missing env (need R2_* and Supabase URL/anon key)"); // names only, never values
    return json(503, { error: "NOT_CONFIGURED", message: "ระบบเผยแพร่ข้อมูลยังไม่พร้อมใช้งาน" });
  }
  const cfg = { accountId: account, accessKeyId: keyId, secretAccessKey: secret, bucket };

  // Auth before the body is read. is_admin() runs as the caller, so Supabase itself decides; 401 = bad/expired token.
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "UNAUTHENTICATED", message: "กรุณาเข้าสู่ระบบใหม่" });
  try {
    const res = await fetch(`${sbUrl}/rest/v1/rpc/is_admin`, {
      method: "POST",
      headers: { apikey: anon, Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: "{}",
    });
    if (res.status === 401) return json(401, { error: "UNAUTHENTICATED", message: "กรุณาเข้าสู่ระบบใหม่" });
    if (!res.ok) return json(503, { error: "AUTH_UNAVAILABLE", message: "ตรวจสอบสิทธิ์ไม่ได้ในขณะนี้" });
    if ((await res.json()) !== true) return json(403, { error: "FORBIDDEN", message: "ต้องเป็นแอดมิน" });
  } catch {
    return json(503, { error: "AUTH_UNAVAILABLE", message: "ตรวจสอบสิทธิ์ไม่ได้ในขณะนี้" });
  }

  let body: { action?: unknown; datasets?: unknown; dataset?: unknown; generation?: unknown; force?: unknown };
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "BAD_REQUEST", message: "รูปแบบคำขอไม่ถูกต้อง" });
  }

  const put = async (key: string, text: string, headers: Record<string, string>) =>
    r2Fetch(cfg, "PUT", key, { body: new TextEncoder().encode(text), headers: { "content-type": "application/json; charset=utf-8", ...headers } });

  // GET one JSON object straight from R2 (not the CDN, so the answer is never stale). 404 -> null, anything unexpected -> "error".
  async function getObject(key: string): Promise<{ value: unknown; etag: string | null } | null | "error"> {
    try {
      const res = await r2Fetch(cfg, "GET", key);
      if (res.status === 404) return null;
      if (!res.ok) {
        console.error("r2 get failed", res.status);
        return "error";
      }
      return { value: JSON.parse(await res.text()), etag: res.headers.get("etag") };
    } catch {
      return "error";
    }
  }

  const deps: PublishDeps = {
    now: () => new Date().toISOString(),
    async fetchRows(def: DatasetDef) {
      const qs = `select=${def.columns.join(",")}&order=${def.order}`;
      const res = await fetch(`${sbUrl}/rest/v1/${def.table}?${qs}`, { headers: { apikey: anon, Authorization: `Bearer ${anon}`, accept: "application/json" } });
      if (!res.ok) throw new Error(`supabase ${res.status}`);
      const rows = await res.json();
      if (!Array.isArray(rows)) throw new Error("not an array");
      return rows;
    },
    async putData(key, text) {
      const res = await put(key, text, { "cache-control": IMMUTABLE, "if-none-match": "*" });
      if (res.ok) return "created";
      if (res.status === 412) return "exists"; // same content hash already stored
      console.error("r2 put failed", res.status);
      return "failed";
    },
    async readManifest(): Promise<ManifestRead> {
      const got = await getObject(MANIFEST_KEY);
      if (got === "error") return "error";
      if (got === null) return { manifest: null, etag: null };
      const manifest = parseManifest(got.value);
      return manifest ? { manifest, etag: got.etag } : "error"; // present but unreadable: never overwrite blindly
    },
    async readHistory(generation) {
      const got = await getObject(historyKey(generation));
      if (got === "error") return "error";
      return got === null ? null : parseManifest(got.value);
    },
    async putHistory(generation: number, manifest: Manifest) {
      const res = await put(historyKey(generation), JSON.stringify(manifest), { "cache-control": "public, max-age=300", "if-none-match": "*" });
      if (res.ok) return "created";
      if (res.status === 412) return "exists";
      console.error("r2 history put failed", res.status);
      return "failed";
    },
    async putManifest(manifest, etag) {
      const res = await put(MANIFEST_KEY, JSON.stringify(manifest), { "cache-control": MANIFEST_CACHE, ...(etag ? { "if-match": etag } : { "if-none-match": "*" }) });
      if (res.ok) return "ok";
      if (res.status === 412) return "conflict";
      console.error("r2 manifest put failed", res.status);
      return "failed";
    },
  };

  const action = body.action ?? "publish";
  let out: Outcome;
  if (action === "status") {
    const cur = await deps.readManifest();
    if (cur === "error") return json(502, { error: "MANIFEST_UNREADABLE", message: "อ่าน manifest ไม่สำเร็จ" });
    return json(200, { ok: true, manifest: cur.manifest, available: Object.keys(DATASETS) });
  } else if (action === "publish") {
    const names = Array.isArray(body.datasets) ? body.datasets : [];
    out = await publish(deps, names.filter((n): n is string => typeof n === "string" && isDatasetName(n)).length === names.length ? (names as string[]) : [], { force: body.force === true });
  } else if (action === "rollback") {
    out = await rollback(deps, Number(body.generation));
  } else if (action === "disable") {
    out = await disable(deps, String(body.dataset ?? ""));
  } else {
    return json(400, { error: "BAD_ACTION", message: "action ไม่ถูกต้อง" });
  }

  if (!out.ok) return json(HTTP_FOR[out.code] ?? 502, { error: out.code, message: out.message });
  return json(200, { ok: true, changed: out.changed, generation: out.manifest?.generation ?? null, results: out.results });
}
