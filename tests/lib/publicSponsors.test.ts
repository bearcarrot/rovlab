import { test } from "node:test";
import assert from "node:assert/strict";
import handler, { parseSponsors, __resetPublicSponsorsForTests } from "../../api/public-sponsors.ts";
import {
  getPublicSponsors,
  parseSponsorsResponse,
  __resetPublicSponsorsForTests as resetClient,
} from "../../src/services/publicSponsors.ts";

// Run: node --experimental-strip-types --test tests/lib/publicSponsors.test.ts

const URL_OK = "https://rovlab.app/api/public-sponsors";
const ID = "0b6f5d4e-3c1a-4e8b-9f21-7a5c2d9e1b30";
const good = {
  id: ID,
  name: "Acme Gaming",
  tagline: "Gear for gamers",
  logo_url: "https://assets.rovlab.app/announcements/0b6f5d4e-3c1a-4e8b-9f21-7a5c2d9e1b30.png",
  link_url: "https://acme.example/rov",
};

function withEnv<T>(fn: () => Promise<T>): Promise<T> {
  const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
  const saved = { u: env.VITE_SUPABASE_URL, k: env.VITE_SUPABASE_ANON_KEY };
  const realFetch = globalThis.fetch;
  env.VITE_SUPABASE_URL = "https://abc.supabase.co";
  env.VITE_SUPABASE_ANON_KEY = "anon-key";
  __resetPublicSponsorsForTests();
  resetClient();
  return fn().finally(() => {
    globalThis.fetch = realFetch;
    env.VITE_SUPABASE_URL = saved.u;
    env.VITE_SUPABASE_ANON_KEY = saved.k;
  });
}

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

test("handler: returns the validated list, cached 1h on the CDN, anon key only", () =>
  withEnv(async () => {
    let seen: { url: string; headers: Record<string, string> } | undefined;
    globalThis.fetch = (async (u: string, init?: RequestInit) => {
      seen = { url: String(u), headers: init?.headers as Record<string, string> };
      return ok([{ ...good, created_by: "secret", status: "published" }]);
    }) as typeof fetch;
    const res = await handler(new Request(URL_OK));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { sponsors: [good] }); // extra columns are not forwarded
    assert.match(res.headers.get("cache-control") ?? "", /s-maxage=3600/);
    assert.match(seen?.url ?? "", /\/rest\/v1\/sponsors\?select=id,name,tagline,logo_url,link_url&order=created_at\.asc&limit=6$/);
    assert.equal(seen?.headers.apikey, "anon-key");
  }));

test("handler: an empty list is a valid, cached answer", () =>
  withEnv(async () => {
    globalThis.fetch = (async () => ok([])) as typeof fetch;
    const res = await handler(new Request(URL_OK));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { sponsors: [] });
    assert.match(res.headers.get("cache-control") ?? "", /s-maxage=3600/);
  }));

test("handler: only GET without parameters is accepted", () =>
  withEnv(async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return ok([]);
    }) as typeof fetch;
    assert.equal((await handler(new Request(URL_OK, { method: "POST" }))).status, 405);
    assert.equal((await handler(new Request(`${URL_OK}?x=1`))).status, 400);
    assert.equal(calls, 0);
  }));

test("handler: failure is not cached and is not retried straight away; last good list is reused", () =>
  withEnv(async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response("boom", { status: 500 });
    }) as typeof fetch;
    const first = await handler(new Request(URL_OK));
    assert.equal(first.status, 503);
    assert.equal(first.headers.get("cache-control"), "no-store");
    await handler(new Request(URL_OK));
    assert.equal(calls, 1);

    __resetPublicSponsorsForTests();
    globalThis.fetch = (async () => ok([good])) as typeof fetch;
    assert.equal((await handler(new Request(URL_OK))).status, 200);
    calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      throw new Error("network");
    }) as typeof fetch;
    const stale = await handler(new Request(URL_OK));
    assert.equal(stale.status, 200);
    assert.deepEqual(await stale.json(), { sponsors: [good] });
    assert.match(stale.headers.get("cache-control") ?? "", /s-maxage=300/);
    await handler(new Request(URL_OK));
    assert.equal(calls, 1);
  }));

test("parseSponsors: drops unsafe rows, strips foreign logos, caps at 6", () => {
  assert.equal(parseSponsors({ not: "a list" }), null);
  const rows = [
    good,
    { ...good, id: "not-a-uuid" },
    { ...good, link_url: "http://acme.example" },
    { ...good, link_url: "javascript:alert(1)" },
    { ...good, name: "   " },
    { ...good, logo_url: "https://evil.example/x.png" },
    { ...good, logo_url: "https://assets.rovlab.app/a.svg" },
    null,
    "x",
  ];
  const out = parseSponsors(rows);
  assert.ok(out);
  assert.equal(out.length, 3); // good, the foreign-logo row and the svg-logo row (both with logo stripped)
  assert.equal(out[0].logo_url, good.logo_url);
  assert.equal(out[1].logo_url, null);
  assert.equal(out[2].logo_url, null);
  const many = Array.from({ length: 10 }, (_, i) => ({ ...good, id: `0b6f5d4e-3c1a-4e8b-9f21-7a5c2d9e1b3${i}` }));
  assert.equal(parseSponsors(many)?.length, 6);
});

test("client: one request shared by every caller; failure yields an empty list and is not retried", () =>
  withEnv(async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return ok({ sponsors: [good] });
    }) as typeof fetch;
    const [a, b] = await Promise.all([getPublicSponsors(), getPublicSponsors()]);
    assert.deepEqual(a, [good]);
    assert.equal(a, b);
    assert.equal(calls, 1);

    resetClient();
    calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response("{}", { status: 503 });
    }) as typeof fetch;
    assert.deepEqual(await getPublicSponsors(), []);
    assert.deepEqual(await getPublicSponsors(), []);
    assert.equal(calls, 1);
  }));

test("client: parseSponsorsResponse re-checks link and logo", () => {
  assert.deepEqual(parseSponsorsResponse(null), []);
  assert.deepEqual(parseSponsorsResponse({ sponsors: "x" }), []);
  const out = parseSponsorsResponse({ sponsors: [good, { ...good, link_url: "javascript:1" }, { ...good, logo_url: "https://evil.example/a.png" }] });
  assert.equal(out.length, 2);
  assert.equal(out[1].logo_url, null);
});
