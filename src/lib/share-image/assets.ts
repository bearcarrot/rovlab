import type { ImageAttempt, ImageFailure, ImageSource, ImageStore } from "./types";

// โหลดรูปให้ "วาดลง Canvas แล้ว export ได้" — รูปที่โหลดสำเร็จแต่ไม่ผ่าน CORS จะทำให้ canvas ถูก taint
// และ toBlob() พัง ดังนั้นโหลดด้วย crossOrigin="anonymous" เท่านั้น ถ้าไม่ผ่านให้เป็น null (วาด placeholder)

const DEFAULT_TIMEOUT = 8000;
const DEFAULT_CONCURRENCY = 8;
const FAIL_TTL_MS = 60_000;

const okCache = new Map<string, ImageSource>();
const inflight = new Map<string, Promise<ImageSource | null>>();
const failedAt = new Map<string, number>();
const attempts = new Map<string, ImageAttempt[]>();
const probes = new Map<string, Promise<"reachable" | "unreachable">>();

/** URL สำหรับ log: ไม่มี query/hash/credentials */
export function cleanUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.protocol.startsWith("http") ? u.origin + u.pathname : u.protocol;
  } catch {
    return url.split(/[?#]/)[0];
  }
}

function record(url: string, a: ImageAttempt) {
  attempts.set(url, [...(attempts.get(url) ?? []), a]);
}

function errText(url: string, e: unknown): string {
  const s = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  return s.split(url).join(cleanUrl(url)).slice(0, 200);
}

/** สาเหตุที่รูปโหลดไม่ได้ (undefined = ไม่มีบันทึก) */
export function getImageFailure(url: string): ImageFailure | undefined {
  const list = attempts.get(url);
  if (!list?.length) return undefined;
  const t = failedAt.get(url);
  const age = t ? Date.now() - t : 0;
  return { url: cleanUrl(url), attempts: list, cachedAgeMs: age > 1000 ? age : undefined };
}

function timeoutAfter<T>(ms: number, value: T): { promise: Promise<T>; cancel: () => void } {
  let id: ReturnType<typeof setTimeout>;
  const promise = new Promise<T>((resolve) => {
    id = setTimeout(() => resolve(value), ms);
  });
  return { promise, cancel: () => clearTimeout(id) };
}

function viaImgElement(url: string, timeoutMs: number): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const finish = (v: HTMLImageElement | null, a?: Omit<ImageAttempt, "method">) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (!v && a) record(url, { method: "image", ...a });
      resolve(v);
    };
    const timer = setTimeout(() => finish(null, { stage: "image", code: "timeout" }), timeoutMs);
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer"; // ตรงกับ <img> ที่ใช้ในหน้าเว็บ
    img.decoding = "async";
    img.onload = () =>
      finish(img.naturalWidth > 0 ? img : null, { stage: "decode", code: "image-decode-error", error: "loaded with naturalWidth 0" });
    // onerror ของ <img> ไม่มีรายละเอียด (CORS / 404 / decode แยกไม่ได้) — ขั้น fetch ด้านล่างให้ข้อมูลเพิ่ม
    img.onerror = () => finish(null, { stage: "image", code: "image-load-error" });
    img.src = url;
  });
}

// fetch แบบ no-cors: resolve (opaque) = โฮสต์ตอบกลับได้ → ที่ล้มคือ response แบบ cors ถูกปฏิเสธ (ไม่มี/ไม่ตรง CORS header หรือ non-2xx ที่ไม่มี header)
// reject = ถึงโฮสต์ไม่ได้เลย (เครือข่าย/DNS/CSP connect-src/extension) — ไม่บอก HTTP status เพราะ opaque; ยิงครั้งเดียวต่อ origin ต่อ export
function probe(url: string, timeoutMs: number) {
  let key = url;
  try {
    key = new URL(url).origin;
  } catch {
    /* ใช้ url เป็น key */
  }
  let p = probes.get(key);
  if (!p) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    p = fetch(url, { mode: "no-cors", cache: "reload", referrerPolicy: "no-referrer", signal: ctrl.signal })
      .then(() => "reachable" as const, () => "unreachable" as const)
      .finally(() => clearTimeout(t));
    probes.set(key, p);
  }
  return p;
}

// สำรอง: บางเบราว์เซอร์เก็บแคชของรูปที่เคยโหลดแบบไม่ใช้ CORS แล้วปฏิเสธคำขอแบบ CORS ครั้งถัดไป
// fetch + cache:"reload" บังคับขอใหม่ ถ้าเซิร์ฟเวอร์ไม่ส่ง Access-Control-Allow-Origin ก็ยังล้มเหลวตามเดิม
async function viaFetch(url: string, timeoutMs: number): Promise<ImageBitmap | null> {
  const fail = (a: Omit<ImageAttempt, "method">) => {
    record(url, { method: "fetch", ...a });
    return null;
  };
  if (typeof fetch === "undefined" || typeof createImageBitmap === "undefined") return fail({ stage: "fetch", code: "fetch-unavailable" });
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let res: Response;
    try {
      res = await fetch(url, { mode: "cors", cache: "reload", referrerPolicy: "no-referrer", signal: ctrl.signal });
    } catch (e) {
      if (ctrl.signal.aborted) return fail({ stage: "fetch", code: "timeout" });
      // ไม่มี response = เครือข่ายล้ม หรือ CORS ไม่ผ่าน เบราว์เซอร์ไม่บอกแยก → ห้ามสรุปว่าเป็น CORS แน่ๆ
      return fail({ stage: "fetch", code: "fetch-network-or-cors-error", error: errText(url, e), probe: await probe(url, timeoutMs) });
    }
    const info = {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      responseType: res.type,
      responseUrl: res.url && res.url !== url ? cleanUrl(res.url) : undefined,
    };
    if (!res.ok) return fail({ stage: "response", code: "http-error", ...info });
    let blob: Blob;
    try {
      blob = await res.blob();
    } catch (e) {
      return fail({ stage: "blob", code: ctrl.signal.aborted ? "timeout" : "blob-error", error: errText(url, e), ...info });
    }
    if (blob.size === 0) return fail({ stage: "blob", code: "empty-response", ...info });
    try {
      return await createImageBitmap(blob);
    } catch (e) {
      return fail({ stage: "decode", code: "image-decode-error", error: errText(url, e), contentType: blob.type || "unknown", ...info });
    }
  } finally {
    clearTimeout(t);
  }
}

export async function loadImage(url: string, timeoutMs = DEFAULT_TIMEOUT): Promise<ImageSource | null> {
  if (!url) return null;
  const hit = okCache.get(url);
  if (hit) return hit;
  const failed = failedAt.get(url);
  if (failed && Date.now() - failed < FAIL_TTL_MS) return null;
  const running = inflight.get(url);
  if (running) return running;

  const job = (async () => {
    const guard = timeoutAfter(timeoutMs * 2, null);
    attempts.delete(url);
    try {
      const img = (await viaImgElement(url, timeoutMs)) ?? (await viaFetch(url, timeoutMs));
      const result = await Promise.race([Promise.resolve(img), guard.promise]);
      if (result) {
        okCache.set(url, result);
        failedAt.delete(url);
      } else if (attempts.get(url)?.slice(-1)[0]?.code !== "timeout") {
        // timeout อาจเป็นแค่เครือข่ายช้า — ไม่จำว่าล้มเหลว เพื่อให้กดแชร์ซ้ำแล้วลองใหม่ได้ทันที
        failedAt.set(url, Date.now());
      }
      return result;
    } finally {
      guard.cancel();
      inflight.delete(url);
    }
  })();
  inflight.set(url, job);
  return job;
}

export async function loadImages(
  urls: string[],
  opts: { timeoutMs?: number; concurrency?: number } = {}
): Promise<Map<string, ImageSource | null>> {
  probes.clear();
  const unique = [...new Set(urls.filter(Boolean))];
  const out = new Map<string, ImageSource | null>();
  const queue = [...unique];
  const workers = Array.from({ length: Math.min(opts.concurrency ?? DEFAULT_CONCURRENCY, queue.length) }, async () => {
    for (let url = queue.shift(); url !== undefined; url = queue.shift()) {
      out.set(url, await loadImage(url, opts.timeoutMs));
    }
  });
  await Promise.all(workers);
  return out;
}

/** โหลดล่วงหน้าให้การกดแชร์ครั้งแรกเร็วขึ้น (สำคัญกับ iOS ที่ share() ต้องเรียกใกล้เวลากดปุ่ม) — ไม่ throw */
export function preloadImages(urls: string[]): void {
  const run = () => void loadImages(urls).catch(() => undefined);
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
  if (ric) ric(run);
  else setTimeout(run, 300);
}

export const EMPTY_STORE: ImageStore = new Map();

function nextCheck(a: ImageAttempt): string {
  switch (a.code) {
    case "fetch-network-or-cors-error":
      return a.probe === "unreachable"
        ? "host unreachable even without CORS (network/DNS/CSP connect-src/extension): look for other console errors, then DevTools Network"
        : "browser hides the reason; open this request in DevTools Network and check its status and the access-control-allow-origin / cf-cache-status response headers";
    case "http-error":
      return "open the URL directly and compare the status with the DevTools Network entry";
    case "empty-response":
    case "blob-error":
    case "image-decode-error":
      return "check the response Content-Type and body in DevTools Network (an error/challenge page can be 200 text/html)";
    case "timeout":
      return "request stalled or slow: retry, then check DevTools Network timing";
    default:
      return "inspect the request in DevTools Network";
  }
}

function sample(f: ImageFailure): string {
  const last = f.attempts[f.attempts.length - 1];
  const earlier = f.attempts.slice(0, -1).map((a) => `${a.method}:${a.code}`).join(", ");
  const http = last.status === undefined ? "unavailable" : `${`${last.status} ${last.statusText ?? ""}`.trim()} (ok=${last.ok})`;
  return [
    `- ${f.url}`,
    `  stage: ${last.stage}`,
    `  code: ${last.code}`,
    last.error && `  error: ${last.error}`,
    `  HTTP status: ${http}`,
    last.responseType && `  response type: ${last.responseType}`,
    last.responseUrl && `  redirected to: ${last.responseUrl}`,
    last.contentType && `  content-type: ${last.contentType}`,
    last.probe && `  no-cors probe: ${last.probe === "reachable" ? "host answered (opaque response, status hidden)" : "host unreachable"}`,
    earlier && `  earlier attempts: ${earlier}`,
    f.cachedAgeMs && `  note: cached failure from ${Math.round(f.cachedAgeMs / 1000)}s ago; failed loads are not retried for ${FAIL_TTL_MS / 1000}s`,
    `  next check: ${nextCheck(last)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** สรุปหนึ่งก้อนต่อ export: จำนวน + ตัวอย่างไม่เกิน 3 แบบที่ต่างกัน (ไม่ log ทีละรูป) */
export function formatImageFailures(failed: ImageFailure[], attempted: number): string {
  const codes = new Map<string, number>();
  const picked = new Map<string, ImageFailure>();
  for (const f of failed) {
    const last = f.attempts[f.attempts.length - 1];
    codes.set(last.code, (codes.get(last.code) ?? 0) + 1);
    const sig = `${last.code}|${last.status}|${last.error}|${last.probe}`;
    if (picked.size < 3 && !picked.has(sig)) picked.set(sig, f);
  }
  return [
    `[share-image] Export failed to load ${failed.length}/${attempted} images.`,
    `[share-image] Failure codes: ${[...codes].map(([c, n]) => `${c} x${n}`).join(", ")}`,
    `[share-image] Sample failures:`,
    ...[...picked.values()].map(sample),
  ].join("\n");
}
