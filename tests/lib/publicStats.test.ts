import { test } from "node:test";
import assert from "node:assert/strict";
import handler, { parseAccounts, __resetPublicStatsForTests } from "../../api/public-stats.ts";
import {
  getAccountCount,
  parseAccountsResponse,
  __resetAccountCountForTests,
  MIN_VISIBLE_ACCOUNTS,
} from "../../src/services/publicStats.ts";

// Run: node --experimental-strip-types --test tests/lib/publicStats.test.ts

const URL_OK = "https://rovlab.app/api/public-stats";

function withEnv<T>(fn: () => Promise<T>): Promise<T> {
  const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
  const saved = { u: env.VITE_SUPABASE_URL, k: env.VITE_SUPABASE_ANON_KEY };
  const realFetch = globalThis.fetch;
  env.VITE_SUPABASE_URL = "https://abc.supabase.co";
  env.VITE_SUPABASE_ANON_KEY = "anon-key";
  __resetPublicStatsForTests();
  __resetAccountCountForTests();
  return fn().finally(() => {
    globalThis.fetch = realFetch;
    env.VITE_SUPABASE_URL = saved.u;
    env.VITE_SUPABASE_ANON_KEY = saved.k;
  });
}

const ok = (n: unknown) => new Response(JSON.stringify(n), { status: 200, headers: { "content-type": "application/json" } });

test("handler: returns only the aggregate, cached 24h on the CDN, anon key only", () =>
  withEnv(async () => {
    let seen: { url: string; method?: string; headers: Record<string, string> } | undefined;
    globalThis.fetch = (async (u: string, init?: RequestInit) => {
      seen = { url: String(u), method: init?.method, headers: init?.headers as Record<string, string> };
      return ok(1200);
    }) as typeof fetch;
    const res = await handler(new Request(URL_OK));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { accounts: 1200 });
    assert.match(res.headers.get("cache-control") ?? "", /s-maxage=86400/);
    assert.match(res.headers.get("cache-control") ?? "", /^public/);
    assert.equal(seen?.url, "https://abc.supabase.co/rest/v1/rpc/get_public_account_count");
    assert.equal(seen?.method, "POST");
    assert.equal(seen?.headers.apikey, "anon-key");
  }));

test("handler: only GET without parameters is accepted", () =>
  withEnv(async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return ok(1200);
    }) as typeof fetch;
    assert.equal((await handler(new Request(URL_OK, { method: "POST" }))).status, 405);
    const q = await handler(new Request(`${URL_OK}?x=1`));
    assert.equal(q.status, 400);
    assert.equal(q.headers.get("cache-control"), "no-store");
    assert.equal(calls, 0);
  }));

test("handler: a failure is not cached and is not retried against Supabase straight away", () =>
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
    await handler(new Request(URL_OK));
    assert.equal(calls, 1);
  }));

test("handler: after a good answer, a later failure serves the last good value with a short cache", () =>
  withEnv(async () => {
    globalThis.fetch = (async () => ok(1300)) as typeof fetch;
    assert.equal((await handler(new Request(URL_OK))).status, 200);
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      throw new Error("network");
    }) as typeof fetch;
    const res = await handler(new Request(URL_OK));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { accounts: 1300 });
    assert.match(res.headers.get("cache-control") ?? "", /s-maxage=300/);
    await handler(new Request(URL_OK));
    assert.equal(calls, 1);
  }));

test("handler: unexpected payloads count as failures (never forwarded)", () =>
  withEnv(async () => {
    for (const bad of [-5, "1200", { id: "x", email: "a@b.c" }, null, 1.5]) {
      __resetPublicStatsForTests();
      globalThis.fetch = (async () => ok(bad)) as typeof fetch;
      const res = await handler(new Request(URL_OK));
      assert.equal(res.status, 503);
      assert.deepEqual(await res.json(), { accounts: null });
    }
    assert.equal(parseAccounts(0), 0);
    assert.equal(parseAccounts(Number.NaN), null);
  }));

test("handler: missing configuration answers 503 without calling Supabase", () =>
  withEnv(async () => {
    const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
    delete env.VITE_SUPABASE_URL;
    delete env.SUPABASE_URL;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return ok(1200);
    }) as typeof fetch;
    const res = await handler(new Request(URL_OK));
    assert.equal(res.status, 503);
    assert.equal(calls, 0);
  }));

test("client: values below the visible minimum, or malformed, are hidden", () => {
  assert.equal(parseAccountsResponse({ accounts: 1200 }), 1200);
  assert.equal(parseAccountsResponse({ accounts: MIN_VISIBLE_ACCOUNTS }), MIN_VISIBLE_ACCOUNTS);
  assert.equal(parseAccountsResponse({ accounts: MIN_VISIBLE_ACCOUNTS - 100 }), null);
  assert.equal(parseAccountsResponse({ accounts: null }), null);
  assert.equal(parseAccountsResponse({ accounts: "1200" }), null);
  assert.equal(parseAccountsResponse(null), null);
  assert.equal(parseAccountsResponse(undefined), null);
});

test("client: one request per page load, shared by every caller", () =>
  withEnv(async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return ok({ accounts: 1200 });
    }) as typeof fetch;
    const [a, b] = await Promise.all([getAccountCount(), getAccountCount()]);
    const c = await getAccountCount();
    assert.deepEqual([a, b, c], [1200, 1200, 1200]);
    assert.equal(calls, 1);
  }));

test("client: a failed request is remembered, not retried, and yields null", () =>
  withEnv(async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response("{}", { status: 503 });
    }) as typeof fetch;
    assert.equal(await getAccountCount(), null);
    assert.equal(await getAccountCount(), null);
    assert.equal(calls, 1);
  }));
