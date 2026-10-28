import { test } from "node:test";
import assert from "node:assert/strict";
import { PROXY_TABLES, proxyUrlFor } from "../../src/lib/restProxy.ts";
import handler, { PROXY_TTL } from "../../api/sb.ts";

// Run: node --experimental-strip-types --test tests/lib/restProxy.test.ts

const BASE = "https://abc.supabase.co/rest/v1/";
const json = () => new Headers({ accept: "application/json", authorization: "Bearer anon", apikey: "anon" });

test("public list queries map to /api/sb with the exact query string", () => {
  const qs = "select=id%2Cslug&order=name.asc";
  assert.equal(proxyUrlFor(`${BASE}heroes?${qs}`, BASE, json()), `/api/sb?t=heroes&q=${encodeURIComponent(qs)}`);
});

test("hero_abilities per-hero reads are proxied; item_builds and announcements are not", () => {
  const qs = "select=slot%2Cname&hero_id=eq.abc&order=sort_order.asc";
  assert.equal(proxyUrlFor(`${BASE}hero_abilities?${qs}`, BASE, json()), `/api/sb?t=hero_abilities&q=${encodeURIComponent(qs)}`);
  assert.equal(proxyUrlFor(`${BASE}item_builds?select=id`, BASE, json()), null);
  assert.equal(proxyUrlFor(`${BASE}announcements?select=id`, BASE, json()), null);
});

test("other tables, other shapes and other hosts are never proxied", () => {
  assert.equal(proxyUrlFor(`${BASE}profiles?select=*`, BASE, json()), null);
  assert.equal(proxyUrlFor(`${BASE}rpc/list_comments`, BASE, json()), null);
  assert.equal(proxyUrlFor(`${BASE}heroes`, BASE, json()), null); // no query string
  assert.equal(proxyUrlFor(`https://evil.example/rest/v1/heroes?select=id`, BASE, json()), null);
  const single = json();
  single.set("accept", "application/vnd.pgrst.object+json"); // .maybeSingle()
  assert.equal(proxyUrlFor(`${BASE}heroes?select=id&slug=eq.x`, BASE, single), null);
  const counted = json();
  counted.set("prefer", "count=exact");
  assert.equal(proxyUrlFor(`${BASE}heroes?select=id`, BASE, counted), null);
  const ranged = json();
  ranged.set("range", "0-9");
  assert.equal(proxyUrlFor(`${BASE}heroes?select=id`, BASE, ranged), null);
});

test("client allow-list and edge handler allow-list are the same tables", () => {
  assert.deepEqual([...PROXY_TABLES].sort(), Object.keys(PROXY_TTL).sort());
});

function withEnv<T>(fn: () => Promise<T>): Promise<T> {
  const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
  const saved = { u: env.VITE_SUPABASE_URL, k: env.VITE_SUPABASE_ANON_KEY };
  const realFetch = globalThis.fetch;
  env.VITE_SUPABASE_URL = "https://abc.supabase.co";
  env.VITE_SUPABASE_ANON_KEY = "anon-key";
  return fn().finally(() => {
    globalThis.fetch = realFetch;
    env.VITE_SUPABASE_URL = saved.u;
    env.VITE_SUPABASE_ANON_KEY = saved.k;
  });
}

test("handler: caches a good answer on the CDN, forwards the query, uses only the anon key", () =>
  withEnv(async () => {
    let seen: { url: string; headers: Record<string, string> } | undefined;
    globalThis.fetch = (async (u: string, init?: RequestInit) => {
      seen = { url: String(u), headers: init?.headers as Record<string, string> };
      return new Response('[{"id":1}]', { status: 200, headers: { "content-type": "application/json; charset=utf-8" } });
    }) as typeof fetch;
    const qs = "select=id%2Cslug&order=name.asc";
    const res = await handler(new Request(`https://rovlab.app/api/sb?t=heroes&q=${encodeURIComponent(qs)}`));
    assert.equal(res.status, 200);
    assert.equal(await res.text(), '[{"id":1}]');
    assert.match(res.headers.get("cache-control") ?? "", /s-maxage=1800/);
    assert.equal(seen?.url, `https://abc.supabase.co/rest/v1/heroes?${qs}`);
    assert.equal(seen?.headers.apikey, "anon-key");
  }));

test("handler: draft relations are kept longer than the hero list", () =>
  withEnv(async () => {
    globalThis.fetch = (async () => new Response("[]", { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
    const res = await handler(new Request("https://rovlab.app/api/sb?t=hero_counters&q=select%3Dhero_id"));
    assert.match(res.headers.get("cache-control") ?? "", /s-maxage=21600/);
  }));

test("handler: rejects other tables, other methods and bad queries; never caches an error", () =>
  withEnv(async () => {
    assert.equal((await handler(new Request("https://rovlab.app/api/sb?t=profiles&q=select%3D*"))).status, 403);
    assert.equal((await handler(new Request("https://rovlab.app/api/sb?t=heroes&q=select%3Did", { method: "POST" }))).status, 405);
    assert.equal((await handler(new Request("https://rovlab.app/api/sb?t=heroes"))).status, 400);
    assert.equal((await handler(new Request("https://rovlab.app/api/sb?t=heroes&q=select%3Did%23x"))).status, 400);
    globalThis.fetch = (async () => new Response('{"message":"bad"}', { status: 400, headers: { "content-type": "application/json" } })) as typeof fetch;
    const bad = await handler(new Request("https://rovlab.app/api/sb?t=heroes&q=select%3Dnope"));
    assert.equal(bad.status, 400);
    assert.equal(bad.headers.get("cache-control"), "no-store");
    globalThis.fetch = (async () => {
      throw new Error("network");
    }) as typeof fetch;
    const down = await handler(new Request("https://rovlab.app/api/sb?t=heroes&q=select%3Did"));
    assert.equal(down.status, 502);
    assert.equal(down.headers.get("cache-control"), "no-store");
  }));
