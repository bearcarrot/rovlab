import type { ImageSource, ImageStore } from "./types";

// โหลดรูปให้ "วาดลง Canvas แล้ว export ได้" — รูปที่โหลดสำเร็จแต่ไม่ผ่าน CORS จะทำให้ canvas ถูก taint
// และ toBlob() พัง ดังนั้นโหลดด้วย crossOrigin="anonymous" เท่านั้น ถ้าไม่ผ่านให้เป็น null (วาด placeholder)

const DEFAULT_TIMEOUT = 8000;
const DEFAULT_CONCURRENCY = 8;
// รูปที่โหลดไม่ได้จะไม่ถูกลองซ้ำภายในเวลานี้ (กัน preload ยิงซ้ำไปที่ CDN ทุกครั้งที่ผู้ใช้โฮเวอร์/กดปุ่มแชร์)
const FAIL_TTL_MS = 5 * 60_000;
// หมดเวลา = ไม่รู้สาเหตุ (อาจเป็นแค่เครือข่ายช้าชั่วคราว) จึงจำไว้สั้นๆ พอกันยิงซ้ำรัวๆ แต่ลองใหม่ได้เร็ว ไม่ต้องรอ 5 นาที
const TIMEOUT_FAIL_TTL_MS = 10_000;

const okCache = new Map<string, ImageSource>();
const inflight = new Map<string, Promise<ImageSource | null>>();
// url → เวลาที่ผลล้มเหลวหมดอายุ (ms epoch)
const failedUntil = new Map<string, number>();
// url ที่ preloadImages รับเข้าคิวแล้วแต่ยังไม่จบ: กันโฮเวอร์/แตะ/โฟกัสต่อเนื่องเปิด batch ซ้อนกัน
const queuedForPreload = new Set<string>();
// url → สาเหตุที่โหลดไม่ได้ (ใช้ debug เท่านั้น)
const failReason = new Map<string, string>();

function note(url: string, reason: string) {
  failReason.set(url, [failReason.get(url), reason].filter(Boolean).join(" > "));
}

/** "host/path [สาเหตุ]" สำหรับ debug — ไม่มี query string หรือข้อมูลผู้ใช้ */
export function imageFailure(url: string): string {
  let where = url;
  try {
    const u = new URL(url);
    where = u.host + u.pathname;
  } catch {
    /* ใช้ค่าดิบ */
  }
  return `${where} [${failReason.get(url) ?? "cached-failure"}]`;
}

function recentlyFailed(url: string): boolean {
  const until = failedUntil.get(url);
  if (until === undefined) return false;
  if (Date.now() < until) return true;
  failedUntil.delete(url);
  return false;
}

function timeoutAfter<T>(ms: number, value: T): { promise: Promise<T>; cancel: () => void } {
  let id: ReturnType<typeof setTimeout>;
  const promise = new Promise<T>((resolve) => {
    id = setTimeout(() => resolve(value), ms);
  });
  return { promise, cancel: () => clearTimeout(id) };
}

function viaImgElement(url: string, timeoutMs: number, onTimeout: () => void): Promise<HTMLImageElement | null> {
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
    const timer = setTimeout(() => {
      onTimeout();
      finish(null, "img-timeout");
    }, timeoutMs);
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer"; // ตรงกับ <img> ที่ใช้ในหน้าเว็บ
    img.decoding = "async";
    img.onload = () => finish(img.naturalWidth > 0 ? img : null, "img-empty");
    img.onerror = () => finish(null, "img-error");
    img.src = url;
  });
}

// สำรอง: ใช้ fetch แบบ CORS เมื่อโหลดผ่าน <img> ไม่สำเร็จ (ใช้ cache ปกติของเบราว์เซอร์ ไม่บังคับขอใหม่ —
// ไม่งั้นทุกรูปที่ล้มเหลวจะยิงคำขอที่ข้ามแคชไปที่ CDN เพิ่มอีก 1 ครั้ง) ถ้าเซิร์ฟเวอร์ไม่ส่ง Access-Control-Allow-Origin ก็ยังล้มเหลวตามเดิม
// หมายเหตุ: fetch ถูกควบคุมด้วย CSP connect-src (vercel.json) ต้องมี https://assets.rovlab.app ไม่งั้นถูกบล็อกก่อนส่งคำขอ
async function viaFetch(url: string, timeoutMs: number, onTimeout: () => void): Promise<ImageBitmap | null> {
  if (typeof fetch === "undefined" || typeof createImageBitmap === "undefined") {
    note(url, "fetch-unsupported");
    return null;
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => {
    onTimeout();
    ctrl.abort();
  }, timeoutMs);
  try {
    let res: Response;
    try {
      res = await fetch(url, { mode: "cors", referrerPolicy: "no-referrer", signal: ctrl.signal });
    } catch (e) {
      // TypeError = CSP connect-src บล็อก / CORS ไม่ผ่าน / เครือข่ายล้ม (เบราว์เซอร์ไม่บอกแยก)
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
  if (recentlyFailed(url)) return null;
  const running = inflight.get(url);
  if (running) return running;

  const job = (async () => {
    const guard = timeoutAfter(timeoutMs * 2, null);
    const state = { timedOut: false };
    const markTimeout = () => {
      state.timedOut = true;
    };
    failReason.delete(url);
    try {
      const img = (await viaImgElement(url, timeoutMs, markTimeout)) ?? (await viaFetch(url, timeoutMs, markTimeout));
      const result = await Promise.race([Promise.resolve(img), guard.promise]);
      if (result) {
        okCache.set(url, result);
        failedUntil.delete(url);
      } else {
        if (!failReason.has(url)) note(url, "guard-timeout");
        failedUntil.set(url, Date.now() + (state.timedOut ? TIMEOUT_FAIL_TTL_MS : FAIL_TTL_MS));
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

/**
 * โหลดล่วงหน้าให้การกดแชร์ครั้งแรกเร็วขึ้น (สำคัญกับ iOS ที่ share() ต้องเรียกใกล้เวลากดปุ่ม) — ไม่ throw
 * เรียกตอนผู้ใช้เริ่มสนใจปุ่มแชร์ (โฮเวอร์/แตะ/โฟกัส) ไม่ใช่ตอนเปิดหน้า เพื่อไม่ให้ทุกผู้เข้าชมโหลดรูปทั้งหมดโดยไม่ได้แชร์
 * เรียกซ้ำได้ถูก: รูปที่โหลดแล้ว/กำลังโหลด/เพิ่งล้มเหลว/อยู่ในคิว preload แล้วจะถูกข้าม และถ้าไม่มีรูปใหม่เลยจะไม่เปิด batch ใหม่
 * (pointerenter + pointerdown + focus ที่มาต่อกันจึงได้ batch เดียว)
 */
export function preloadImages(urls: string[]): void {
  const fresh = [...new Set(urls)].filter(
    (u) => u && !queuedForPreload.has(u) && !okCache.has(u) && !inflight.has(u) && !recentlyFailed(u)
  );
  if (fresh.length === 0) return;
  for (const u of fresh) queuedForPreload.add(u);
  const run = () =>
    void loadImages(fresh)
      .catch(() => undefined)
      .finally(() => {
        for (const u of fresh) queuedForPreload.delete(u);
      });
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
  if (ric) ric(run);
  else setTimeout(run, 300);
}

export const EMPTY_STORE: ImageStore = new Map();
