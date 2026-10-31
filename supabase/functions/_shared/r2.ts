// Minimal AWS SigV4 GET/PUT/DELETE for Cloudflare R2 (S3 API) using only WebCrypto, so no npm dependency / lockfile change is needed.
// Shared by api/upload.ts + api/publish-data.ts (Vercel edge) and supabase/functions/avatar (Deno). No imports on purpose: both runtimes can load it.
export type R2Config = { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string };

const te = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const sha256 = async (d: Uint8Array | string) => hex(await crypto.subtle.digest("SHA-256", typeof d === "string" ? te.encode(d) : d));
async function hmac(key: ArrayBuffer | Uint8Array, msg: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, te.encode(msg));
}

export async function sigv4(o: {
  method: string; host: string; path: string; query?: string; headers?: Record<string, string>; payloadHash: string;
  accessKeyId: string; secretAccessKey: string; region: string; service: string; amzDate: string; // amzDate = YYYYMMDDTHHMMSSZ
}): Promise<Record<string, string>> {
  const day = o.amzDate.slice(0, 8);
  const h: Record<string, string> = { host: o.host, "x-amz-content-sha256": o.payloadHash, "x-amz-date": o.amzDate };
  for (const [k, v] of Object.entries(o.headers ?? {})) h[k.toLowerCase()] = v.trim();
  const names = Object.keys(h).sort();
  const canonical = `${o.method}\n${o.path}\n${o.query ?? ""}\n${names.map((n) => `${n}:${h[n]}\n`).join("")}\n${names.join(";")}\n${o.payloadHash}`;
  const scope = `${day}/${o.region}/${o.service}/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", o.amzDate, scope, await sha256(canonical)].join("\n");
  let k = await hmac(te.encode(`AWS4${o.secretAccessKey}`), day);
  for (const part of [o.region, o.service, "aws4_request"]) k = await hmac(k, part);
  const signature = hex(await hmac(k, toSign));
  const { host: _host, ...send } = h; // fetch sets Host itself
  return { ...send, authorization: `AWS4-HMAC-SHA256 Credential=${o.accessKeyId}/${scope}, SignedHeaders=${names.join(";")}, Signature=${signature}` };
}

const encodeKey = (key: string) =>
  key.split("/").map((s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)).join("/");

// GET, PUT or DELETE one object (GET was added for api/publish-data.ts to read its manifest; a GET has no body, so the signed payload
// is the empty-body hash, same as DELETE). Returns the raw Response so callers can log status.
export async function r2Fetch(cfg: R2Config, method: "GET" | "PUT" | "DELETE", key: string, init: { body?: Uint8Array; headers?: Record<string, string> } = {}): Promise<Response> {
  const host = `${cfg.accountId}.r2.cloudflarestorage.com`;
  const path = `/${cfg.bucket}/${encodeKey(key)}`;
  const body = init.body ?? new Uint8Array(0);
  const headers = await sigv4({
    method, host, path, headers: init.headers, payloadHash: await sha256(body),
    accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, region: "auto", service: "s3",
    amzDate: new Date().toISOString().replace(/[:-]|\.\d{3}/g, ""),
  });
  return fetch(`https://${host}${path}`, { method, headers, body: method === "PUT" ? body : undefined });
}
