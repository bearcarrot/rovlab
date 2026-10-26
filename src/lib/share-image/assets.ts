import type { ImageSource, ImageStore } from "./types";

// โหลดรูปให้ "วาดลง Canvas แล้ว export ได้" — รูปที่โหลดสำเร็จแต่ไม่ผ่าน CORS จะทำให้ canvas ถูก taint
// และ toBlob() พัง ดังนั้นโหลดด้วย crossOrigin="anonymous" เท่านั้น ถ้าไม่ผ่านให้เป็น null (วาด placeholder)

const DEFAULT_TIMEOUT = 8000;
const DEFAULT_CONCURRENCY = 8;
const FAIL_TTL_MS = 60_000;

const okCache = new Map<string, ImageSource>();
const inflight = new Map<string, Promise<ImageSource | null>>();
const failedAt = new Map<string, number>();
const failReason = new Map<string, string>();

/** สาเหตุที่รูปโหลดไม่ได้ สำหรับ debug — มีแค่ host+path (ไม่มี query/ข้อมูลผู้ใช้) เช่น "assets.rovlab.app/h/x.webp [img-error > fetch-blocked]" */
export function imageFailure(url: string): string {
  let where = url;
  try {
    const u = new URL(url);
    where = u.host + u.pathname;
  } catch {
    /* ใช้ค่าดิบ */
  }
  return `${where} [${failReason.get(url) ?? "unknown"}]`;
}

function note(url: string, reason: string) {
  failReason.set(url, [failReason.get(url), reason].filter(Boolean).join(" > "));
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
    const finish = (v: HTMLImageElement | null, reason?: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (!v && reason) note(url, reason);
      resolve(v);
    };
    const timer = setTimeout(() => finish(null, "img-timeout"), timeoutMs);
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer"; // ตรงกับ <img> ที่ใช้ในหน้าเว็บ
    img.decoding = "async";
    img.onload = () => finish(img.naturalWidth > 0 ? img : null, "img-empty");
    // onerror ของ <img> แยก CORS / 404 / decode ไม่ได้ — fetch สำรองด้านล่างช่วยแยกสาเหตุ
    img.onerror = () => finish(null, "img-error");
    img.src = url;
  });
}

// สำรอง: บางเบราว์เซอร์เก็บแคชของรูปที่เคยโหลดแบบไม่ใช้ CORS แล้วปฏิเสธคำขอแบบ CORS ครั้งถัดไป
// fetch + cache:"reload" บังคับขอใหม่ ถ้าเซิร์ฟเวอร์ไม่ส่ง Access-Control-Allow-Origin ก็ยังล้มเหลวตามเดิม
async function viaFetch(url: string, timeoutMs: number): Promise<ImageBitmap | null> {
  if (typeof fetch === "undefined" || typeof createImageBitmap === "undefined") {
    note(url, "fetch-unsupported");
    return null;
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let res: Response;
    try {
      res = await fetch(url, { mode: "cors", cache: "reload", referrerPolicy: "no-referrer", signal: ctrl.signal });
    } catch (e) {
      // TypeError จาก fetch = เครือข่ายล้ม หรือ CORS ไม่ผ่าน (เบราว์เซอร์ไม่บอกแยก)
      note(url, e instanceof DOMException && e.name === "AbortError" ? "fetch-timeout" : "fetch-blocked");
      return null;
    }
    if (!res.ok) {
      note(url, `fetch-${res.status}`);
      return null;
    }
    try {
      return await createImageBitmap(await res.blob());
    } catch {
      note(url, "decode");
      return null;
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
    failReason.delete(url);
    try {
      const img = (await viaImgElement(url, timeoutMs)) ?? (await viaFetch(url, timeoutMs));
      const result = await Promise.race([Promise.resolve(img), guard.promise]);
      if (result) {
        okCache.set(url, result);
        failedAt.delete(url);
      } else {
        if (!failReason.has(url)) note(url, "guard-timeout");
        // timeout อาจเป็นแค่เครือข่ายช้า — ไม่จำว่าล้มเหลว เพื่อให้กดแชร์ซ้ำแล้วลองใหม่ได้ทันที
        if (!failReason.get(url)?.includes("timeout")) failedAt.set(url, Date.now());
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
