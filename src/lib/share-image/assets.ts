import type { ImageSource, ImageStore } from "./types";

// โหลดรูปให้ "วาดลง Canvas แล้ว export ได้" — รูปที่โหลดสำเร็จแต่ไม่ผ่าน CORS จะทำให้ canvas ถูก taint
// และ toBlob() พัง ดังนั้นโหลดด้วย crossOrigin="anonymous" เท่านั้น ถ้าไม่ผ่านให้เป็น null (วาด placeholder)

const DEFAULT_TIMEOUT = 8000;
const DEFAULT_CONCURRENCY = 8;
// รูปที่โหลดไม่ได้จะไม่ถูกลองซ้ำภายในเวลานี้ (กัน preload ยิงซ้ำไปที่ CDN ทุกครั้งที่ผู้ใช้โฮเวอร์/กดปุ่มแชร์)
const FAIL_TTL_MS = 5 * 60_000;

const okCache = new Map<string, ImageSource>();
const inflight = new Map<string, Promise<ImageSource | null>>();
const failedAt = new Map<string, number>();

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
    const finish = (v: HTMLImageElement | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(v);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer"; // ตรงกับ <img> ที่ใช้ในหน้าเว็บ
    img.decoding = "async";
    img.onload = () => finish(img.naturalWidth > 0 ? img : null);
    img.onerror = () => finish(null);
    img.src = url;
  });
}

// สำรอง: ใช้ fetch แบบ CORS เมื่อโหลดผ่าน <img> ไม่สำเร็จ (ใช้ cache ปกติของเบราว์เซอร์ ไม่บังคับขอใหม่ —
// ไม่งั้นทุกรูปที่ล้มเหลวจะยิงคำขอที่ข้ามแคชไปที่ CDN เพิ่มอีก 1 ครั้ง) ถ้าเซิร์ฟเวอร์ไม่ส่ง Access-Control-Allow-Origin ก็ยังล้มเหลวตามเดิม
async function viaFetch(url: string, timeoutMs: number): Promise<ImageBitmap | null> {
  if (typeof fetch === "undefined" || typeof createImageBitmap === "undefined") return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { mode: "cors", referrerPolicy: "no-referrer", signal: ctrl.signal });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await createImageBitmap(blob);
  } catch {
    return null;
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
    try {
      const img = (await viaImgElement(url, timeoutMs)) ?? (await viaFetch(url, timeoutMs));
      const result = await Promise.race([Promise.resolve(img), guard.promise]);
      if (result) okCache.set(url, result);
      else failedAt.set(url, Date.now());
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

/**
 * โหลดล่วงหน้าให้การกดแชร์ครั้งแรกเร็วขึ้น (สำคัญกับ iOS ที่ share() ต้องเรียกใกล้เวลากดปุ่ม) — ไม่ throw
 * เรียกตอนผู้ใช้เริ่มสนใจปุ่มแชร์ (โฮเวอร์/แตะ/โฟกัส) ไม่ใช่ตอนเปิดหน้า เพื่อไม่ให้ทุกผู้เข้าชมโหลดรูปทั้งหมดโดยไม่ได้แชร์
 * เรียกซ้ำได้ถูก: รูปที่โหลดแล้ว/กำลังโหลด/เพิ่งล้มเหลวจะไม่ยิงคำขอใหม่
 */
export function preloadImages(urls: string[]): void {
  const run = () => void loadImages(urls).catch(() => undefined);
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
  if (ric) ric(run);
  else setTimeout(run, 300);
}

export const EMPTY_STORE: ImageStore = new Map();
