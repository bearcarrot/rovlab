import { test } from "node:test";
import assert from "node:assert/strict";
import { formatImageFailures, getImageFailure, loadImage } from "../../src/lib/share-image/assets.ts";

// Browser globals are faked per test; every test uses its own URL because assets.ts caches by URL.
type Init = { mode?: string; signal?: AbortSignal };
let imgMode: "load" | "error" | "hang" = "error";
let imgCount = 0;
let fetchImpl: (url: string, init: Init) => Promise<unknown>;
let bitmapImpl: (blob: unknown) => Promise<unknown> = async () => ({ bitmap: true });

class FakeImage {
  crossOrigin = "";
  referrerPolicy = "";
  decoding = "";
  naturalWidth = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    imgCount++;
  }
  set src(_: string) {
    if (imgMode === "load")
      queueMicrotask(() => {
        this.naturalWidth = 64;
        this.onload?.();
      });
    if (imgMode === "error") queueMicrotask(() => this.onerror?.());
  }
}
Object.assign(globalThis, {
  Image: FakeImage,
  fetch: (u: string, i: Init) => fetchImpl(u, i),
  createImageBitmap: (b: unknown) => bitmapImpl(b),
});

const response = (o: Record<string, unknown> = {}) => ({
  ok: true,
  status: 200,
  statusText: "OK",
  type: "cors",
  url: "",
  blob: async () => ({ size: 10, type: "image/webp" }),
  ...o,
});
const hang = (_u: string, init: Init) =>
  new Promise<never>((_, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
const last = (url: string) => {
  const f = getImageFailure(url);
  assert.ok(f, "failure recorded");
  return { f, a: f.attempts[f.attempts.length - 1] };
};

test("successful image load records no failure", async () => {
  imgMode = "load";
  const url = "https://assets.test/ok.webp";
  assert.ok(await loadImage(url, 50));
  assert.equal(getImageFailure(url), undefined);
});

test("HTTP failure: status only reported because a response exists", async () => {
  imgMode = "error";
  fetchImpl = async () => response({ ok: false, status: 403, statusText: "Forbidden" });
  const url = "https://assets.test/http.webp?token=secret";
  assert.equal(await loadImage(url, 50), null);
  const { f, a } = last(url);
  assert.deepEqual(f.attempts.map((x) => x.code), ["image-load-error", "http-error"]);
  assert.equal(a.stage, "response");
  assert.equal(a.status, 403);
  assert.equal(a.ok, false);
  assert.equal(a.responseType, "cors");
  assert.equal(f.url, "https://assets.test/http.webp"); // no query string
});

test("fetch rejection stays network-or-cors, never http-error, and the no-cors probe is reported", async () => {
  imgMode = "error";
  fetchImpl = async (_u, init) => {
    if (init.mode === "no-cors") return { type: "opaque", status: 0 };
    throw new TypeError("Failed to fetch");
  };
  const url = "https://assets.test/cors.webp?token=secret";
  assert.equal(await loadImage(url, 50), null);
  const { f, a } = last(url);
  assert.equal(a.code, "fetch-network-or-cors-error");
  assert.equal(a.stage, "fetch");
  assert.equal(a.error, "TypeError: Failed to fetch");
  assert.equal(a.status, undefined);
  assert.equal(a.probe, "reachable");

  const text = formatImageFailures([f], 1);
  assert.match(text, /Export failed to load 1\/1 images\./);
  assert.match(text, /code: fetch-network-or-cors-error/);
  assert.match(text, /HTTP status: unavailable/);
  assert.match(text, /earlier attempts: image:image-load-error/);
  assert.match(text, /next check: /);
  assert.doesNotMatch(text, /secret|token/);
});

test("fetch rejection with unreachable host is reported as such", async () => {
  imgMode = "error";
  fetchImpl = async () => {
    throw new TypeError("Failed to fetch");
  };
  const url = "https://down.test/x.webp";
  await loadImage(url, 50);
  assert.equal(last(url).a.probe, "unreachable");
});

test("200 response that cannot be decoded reports image-decode-error with content-type", async () => {
  imgMode = "error";
  fetchImpl = async () => response({ blob: async () => ({ size: 5, type: "text/html" }) });
  bitmapImpl = async () => {
    throw new DOMException("The source image could not be decoded.", "InvalidStateError");
  };
  const url = "https://assets.test/decode.webp";
  await loadImage(url, 50);
  const { a } = last(url);
  assert.equal(a.code, "image-decode-error");
  assert.equal(a.stage, "decode");
  assert.equal(a.contentType, "text/html");
  assert.equal(a.status, 200);
  bitmapImpl = async () => ({ bitmap: true });
});

test("empty body reports empty-response", async () => {
  imgMode = "error";
  fetchImpl = async () => response({ blob: async () => ({ size: 0, type: "" }) });
  const url = "https://assets.test/empty.webp";
  await loadImage(url, 50);
  assert.equal(last(url).a.code, "empty-response");
});

test("timeouts are labelled timeout and are not cached as failures", async () => {
  imgMode = "hang";
  fetchImpl = hang;
  const url = "https://assets.test/slow.webp";
  assert.equal(await loadImage(url, 20), null);
  assert.deepEqual(getImageFailure(url)?.attempts.map((x) => x.code), ["timeout", "timeout"]);
  const before = imgCount;
  await loadImage(url, 20);
  assert.equal(imgCount, before + 1, "retried immediately");
});
