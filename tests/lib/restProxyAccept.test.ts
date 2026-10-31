import { test } from "node:test";
import assert from "node:assert/strict";
import { acceptsPlainJson, proxyUrlFor } from "../../src/lib/restProxy.ts";

// Run: node --experimental-strip-types --test tests/lib/restProxyAccept.test.ts
// Regression: supabase-js sends no Accept header on plain GET reads (fetch adds "*/*"), and the proxy used to require
// "application/json", so nearly every public read bypassed /api/sb and hit Supabase directly.

const BASE = "https://abc.supabase.co/rest/v1/";
const QS = "select=slot%2Cname&hero_id=eq.abc&order=sort_order.asc";

test("a plain read with no Accept header is proxied", () => {
  const h = new Headers({ authorization: "Bearer anon", apikey: "anon" });
  assert.equal(proxyUrlFor(`${BASE}hero_abilities?${QS}`, BASE, h), `/api/sb?t=hero_abilities&q=${encodeURIComponent(QS)}`);
});

test("a read with Accept */* (what the browser sends in production) is proxied", () => {
  const h = new Headers({ accept: "*/*", authorization: "Bearer anon" });
  assert.equal(proxyUrlFor(`${BASE}hero_counters?select=hero_id`, BASE, h), `/api/sb?t=hero_counters&q=${encodeURIComponent("select=hero_id")}`);
});

test("single-object, count and range requests still go straight to Supabase", () => {
  for (const [k, v] of [
    ["accept", "application/vnd.pgrst.object+json"],
    ["accept", "application/vnd.pgrst.plan+json"],
    ["accept", "text/csv"],
    ["prefer", "count=exact"],
    ["range", "0-9"],
  ] as const) {
    const h = new Headers({ accept: "*/*" });
    h.set(k, v);
    assert.equal(proxyUrlFor(`${BASE}heroes?select=id`, BASE, h), null, `${k}: ${v}`);
  }
});

test("acceptsPlainJson", () => {
  assert.equal(acceptsPlainJson(new Headers()), true);
  assert.equal(acceptsPlainJson(new Headers({ accept: "*/*" })), true);
  assert.equal(acceptsPlainJson(new Headers({ accept: "application/json" })), true);
  assert.equal(acceptsPlainJson(new Headers({ accept: "application/vnd.pgrst.object+json" })), false);
});
