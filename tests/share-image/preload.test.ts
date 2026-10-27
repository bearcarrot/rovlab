import { test } from "node:test";
import assert from "node:assert/strict";
import { loadImage, loadImages, preloadImages } from "../../src/lib/share-image/assets.ts";

// assets.ts keeps module-level caches keyed by URL, so every test uses its own URLs.
// Browser globals are faked; requestIdleCallback is captured so a test decides when queued preload batches run.

type ImgMode = "load" | "error" | "hang" | "manual";
// "reload-ok": models a poisoned HTTP cache — normal CORS fetches fail, a cache:"reload" fetch succeeds
type FetchMode = "reject" | "hang" | "reload-ok";
type FetchInit = { mode?: string; cache?: string; signal?: AbortSignal };

const imgMode = new Map<string, ImgMode>();
const fetchMode = new Map<string, FetchMode>();
const imgReq = new Map<string, number>();
const fetchReq = new Map<string, number>();
const fetchInits: FetchInit[] = [];
const manual = new Map<string, FakeImage>();
const crossOriginSeen = new Map<string, string>();
const referrerSeen = new Map<string, string>();
const idle: Array<() => void> = [];

const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
const count = (m: Map<string, number>, k: string) => m.get(k) ?? 0;

class FakeImage {
  crossOrigin = "";
  referrerPolicy = "";
  decoding = "";
  naturalWidth = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(url: string) {
    bump(imgReq, url);
    crossOriginSeen.set(url, this.crossOrigin);
    referrerSeen.set(url, this.referrerPolicy);
    const mode = imgMode.get(url) ?? "load";
    if (mode === "load") {
      queueMicrotask(() => {
        this.naturalWidth = 64;
        this.onload?.();
      });
    } else if (mode === "error") {
      queueMicrotask(() => this.onerror?.());
    } else if (mode === "manual") {
      manual.set(url, this);
    }
  }
}

Object.assign(globalThis, {
  Image: FakeImage,
  fetch: (url: string, init: FetchInit) => {
    bump(fetchReq, url);
    fetchInits.push(init);
    if (fetchMode.get(url) === "reload-ok" && init.cache === "reload") {
      return Promise.resolve({ ok: true, status: 200, blob: async () => ({}) });
    }
    if ((fetchMode.get(url) ?? "reject") === "hang") {
      return new Promise<never>((_, reject) =>
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
      );
    }
    return Promise.reject(new TypeError("Failed to fetch"));
  },
  createImageBitmap: async () => ({ bitmap: true }),
  requestIdleCallback: (cb: () => void) => idle.push(cb),
});

// Failure TTLs are wall-clock based; tests move the clock forward instead of waiting.
const realNow = Date.now.bind(Date);
let skew = 0;
Date.now = () => realNow() + skew;
const advance = (ms: number) => {
  skew += ms;
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 25));
async function flushIdle() {
  for (const cb of idle.splice(0)) cb();
  await settle();
}
const urls = (tag: string, n: number) => Array.from({ length: n }, (_, i) => `https://assets.test/${tag}-${i}.webp`);

test("repeated pointerenter/pointerdown/focus calls start one preload batch and one request per URL", async () => {
  const list = urls("repeat", 3);
  preloadImages(list);
  preloadImages(list);
  preloadImages([...list].reverse());
  assert.equal(idle.length, 1, "only the first call schedules a batch");
  await flushIdle();
  for (const u of list) assert.equal(count(imgReq, u), 1);
});

test("a call while a batch is queued only queues the URLs that are new", async () => {
  const [a, b, c] = urls("queued", 3);
  preloadImages([a, b]);
  preloadImages([a, b, c]);
  assert.equal(idle.length, 2);
  preloadImages([a, b, c]);
  preloadImages([b]);
  assert.equal(idle.length, 2, "nothing new → no third batch");
  await flushIdle();
  for (const u of [a, b, c]) assert.equal(count(imgReq, u), 1);
});

test("once loaded, preloading the same URLs again schedules nothing and requests nothing", async () => {
  const list = urls("loaded", 2);
  preloadImages(list);
  await flushIdle();
  preloadImages(list);
  assert.equal(idle.length, 0);
  for (const u of list) assert.equal(count(imgReq, u), 1);
});

test("a share click while a preload is still in flight reuses that request", async () => {
  const [u] = urls("inflight", 1);
  imgMode.set(u, "manual");
  preloadImages([u]);
  for (const cb of idle.splice(0)) cb(); // batch starts, image still pending
  assert.equal(count(imgReq, u), 1);

  const click = loadImage(u, 1000);
  preloadImages([u]); // another hover while loading
  assert.equal(idle.length, 0);
  assert.equal(count(imgReq, u), 1, "no second request");

  const img = manual.get(u)!;
  img.naturalWidth = 64;
  img.onload?.();
  assert.ok(await click);
  assert.equal(count(imgReq, u), 1);
});

test("sharing works with no preload at all: loadImages loads on demand and caches", async () => {
  const list = urls("ondemand", 3);
  const out = await loadImages(list);
  for (const u of list) assert.ok(out.get(u), `${u} loaded`);
  await loadImages(list);
  for (const u of list) assert.equal(count(imgReq, u), 1, "second export is served from memory");
});

test("share images are requested with CORS + no-referrer so the canvas stays exportable", async () => {
  const [u] = urls("cors-attrs", 1);
  await loadImage(u);
  assert.equal(crossOriginSeen.get(u), "anonymous");
  assert.equal(referrerSeen.get(u), "no-referrer");
});

test("a failed asset costs one <img> + one CORS fetch + one capped cache-bypass retry, is not retried within the TTL, and recovers after it", async () => {
  const [u] = urls("fail", 1);
  imgMode.set(u, "error");
  const before = fetchInits.length;

  assert.equal(await loadImage(u, 50), null);
  assert.equal(count(imgReq, u), 1);
  assert.equal(count(fetchReq, u), 2);
  const init = fetchInits[before];
  assert.equal(init.mode, "cors");
  assert.equal("cache" in init, false, "first fetch uses normal browser HTTP caching");
  assert.equal(fetchInits[before + 1].cache, "reload", "second fetch is the one-time cache-bypass retry");

  // hammering the share control / exporting again must not hit the network
  await loadImages([u, u, u]);
  await loadImage(u);
  preloadImages([u]);
  assert.equal(idle.length, 0);
  assert.equal(count(imgReq, u), 1);
  assert.equal(count(fetchReq, u), 2);

  advance(60_000);
  await loadImage(u, 50);
  assert.equal(count(imgReq, u), 1, "still inside the 5 minute failure TTL after 60s");

  advance(5 * 60_000);
  imgMode.set(u, "load");
  assert.ok(await loadImage(u, 50), "recovers once the TTL has passed");
  assert.equal(count(imgReq, u), 2);
});

test("a poisoned HTTP cache (CORS requests fail, bypass succeeds) recovers in the same export with one extra request", async () => {
  const [u] = urls("poisoned", 1);
  imgMode.set(u, "error");
  fetchMode.set(u, "reload-ok");
  const before = fetchInits.length;

  assert.ok(await loadImage(u, 50), "image recovered without the user clearing the cache");
  assert.equal(count(imgReq, u), 1);
  assert.equal(count(fetchReq, u), 2);
  assert.equal(fetchInits[before + 1].cache, "reload");

  assert.ok(await loadImage(u, 50), "later exports are served from memory");
  assert.equal(count(fetchReq, u), 2);
});

test("the cache-bypass retry runs once per URL per session even after the failure TTL expires", async () => {
  const [u] = urls("bypass-once", 1);
  imgMode.set(u, "error");

  assert.equal(await loadImage(u, 50), null);
  assert.equal(count(fetchReq, u), 2);

  advance(10 * 60_000);
  assert.equal(await loadImage(u, 50), null);
  assert.equal(count(fetchReq, u), 3, "normal fetch again, but no second bypass");
});

test("no bypass retry after a timeout or when the server already answered with an HTTP error", async () => {
  const [slow, gone] = urls("no-bypass", 2);
  imgMode.set(slow, "hang");
  fetchMode.set(slow, "hang");
  assert.equal(await loadImage(slow, 20), null);
  assert.equal(count(fetchReq, slow), 1, "timeout is not a cache problem");

  imgMode.set(gone, "error");
  const realFetch = globalThis.fetch;
  Object.assign(globalThis, {
    fetch: (url: string, init: FetchInit) => {
      if (url !== gone) return realFetch(url, init);
      bump(fetchReq, url);
      return Promise.resolve({ ok: false, status: 404 });
    },
  });
  try {
    assert.equal(await loadImage(gone, 50), null);
  } finally {
    Object.assign(globalThis, { fetch: realFetch });
  }
  assert.equal(count(fetchReq, gone), 1, "a 404 would be identical on retry");
});

test("a timeout is remembered only briefly so a slow network can recover without waiting 5 minutes", async () => {
  const [u] = urls("slow", 1);
  imgMode.set(u, "hang");
  fetchMode.set(u, "hang");

  assert.equal(await loadImage(u, 20), null);
  assert.equal(count(imgReq, u), 1);
  assert.equal(count(fetchReq, u), 1);

  assert.equal(await loadImage(u, 20), null); // immediate repeat is throttled
  preloadImages([u]);
  assert.equal(idle.length, 0);
  assert.equal(count(imgReq, u), 1);

  advance(60_000);
  imgMode.set(u, "load");
  assert.ok(await loadImage(u, 20), "retried after the short timeout TTL and succeeded");
  assert.equal(count(imgReq, u), 2);
});

test("a failing preload batch resolves quietly and frees its URLs from the queue", async () => {
  const [bad, good] = urls("mixed", 2);
  imgMode.set(bad, "error");
  preloadImages([bad]);
  await flushIdle();
  assert.equal(count(imgReq, bad), 1);
  assert.equal(count(fetchReq, bad), 2, "normal fetch + one bypass retry");

  preloadImages([bad, good]); // bad is in failure cooldown, good is new
  assert.equal(idle.length, 1);
  await flushIdle();
  assert.equal(count(imgReq, bad), 1);
  assert.equal(count(imgReq, good), 1);
});
