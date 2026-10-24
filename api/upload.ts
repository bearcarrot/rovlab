// Admin image uploads to Cloudflare R2 (S3 API). Same-origin on purpose: the CSP connect-src stays untouched and R2 keys never reach the browser.
// Flow + env vars: docs/r2-uploads.md. Logic lives in ./_upload/core (tested); this file only wires env, Supabase and R2.

import { handleUpload, type AdminCheck } from "./_upload/core";
import { r2Fetch } from "../supabase/functions/_shared/r2";

export const config = { runtime: "edge" };

type Env = Record<string, string | undefined>;
const readEnv = (): Env => (globalThis as { process?: { env?: Env } }).process?.env ?? {};

export default async function handler(request: Request): Promise<Response> {
  const e = readEnv();
  const sbUrl = (e.VITE_SUPABASE_URL || e.SUPABASE_URL || "").replace(/\/+$/, "");
  const anon = e.VITE_SUPABASE_ANON_KEY || e.SUPABASE_ANON_KEY || "";
  const { R2_ACCOUNT_ID: account, R2_ACCESS_KEY_ID: keyId, R2_SECRET_ACCESS_KEY: secret, R2_BUCKET_NAME: bucket, R2_PUBLIC_BASE_URL: publicBase } = e;
  if (!sbUrl || !anon || !account || !keyId || !secret || !bucket || !publicBase) {
    console.error("upload: missing env (need R2_* and Supabase URL/anon key)"); // names only, never values
    return new Response(JSON.stringify({ error: "NOT_CONFIGURED", message: "ระบบอัปโหลดยังไม่พร้อมใช้งาน" }), {
      status: 503,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  const cfg = { accountId: account, accessKeyId: keyId, secretAccessKey: secret, bucket };

  return handleUpload(request, {
    publicBase,
    now: () => Date.now(),
    uuid: () => crypto.randomUUID(),
    // is_admin() runs as the caller (their JWT), so Supabase itself decides; 401 = bad/expired token.
    async checkAdmin(token): Promise<AdminCheck> {
      try {
        const headers: Record<string, string> = { apikey: anon, Authorization: `Bearer ${token}`, "content-type": "application/json" };
        const res = await fetch(`${sbUrl}/rest/v1/rpc/is_admin`, { method: "POST", headers, body: "{}" });
        if (res.status === 401) return "anon";
        if (!res.ok) return "error";
        return (await res.json()) === true ? "admin" : "member";
      } catch {
        return "error";
      }
    },
    async put(key, body, contentType) {
      const res = await r2Fetch(cfg, "PUT", key, {
        body,
        headers: {
          "content-type": contentType,
          "cache-control": "public, max-age=31536000, immutable", // keys are unique and never overwritten
          "if-none-match": "*", // R2 conditional PUT: refuse to overwrite an existing object
        },
      });
      if (!res.ok) console.error("r2 put failed", res.status);
      return res.ok;
    },
    async remove(key) {
      const res = await r2Fetch(cfg, "DELETE", key);
      if (!res.ok) console.error("r2 delete failed", res.status);
      return res.ok;
    },
  });
}
