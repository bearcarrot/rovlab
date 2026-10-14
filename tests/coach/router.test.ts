import { test } from "node:test";
import assert from "node:assert/strict";
import { ResponseCache, attemptPlan, cacheKey, providerErrorCode, routeRequest } from "../../supabase/functions/ai-coach/router.ts";

const names = (n: number) => Array.from({ length: n }, (_, i) => `H${i}`);
const draft = (m: number, e: number) => ({ mine: [...names(m), ...Array(5 - m).fill(null)], enemy: [...names(e), ...Array(5 - e).fill(null)] });

test("basic hero / skill / item-explain / simple counter questions -> lite", () => {
  for (const id of ["how-to-play", "skills", "pros-cons", "who-fits", "game-phase", "build-why", "how-to-face", "matchup-plan"]) {
    assert.equal(routeRequest(id, {}).tier, "lite", id);
  }
});

test("full draft analysis -> flash; thin draft -> lite", () => {
  assert.equal(routeRequest("draft-eval", draft(3, 2)).tier, "flash");
  assert.equal(routeRequest("draft-eval", draft(1, 1)).tier, "lite");
});

test("multi-hero pick (team synergy + counters) -> flash; small pick -> lite", () => {
  const big = { team: { mine: names(3), enemy: names(3) } };
  assert.equal(routeRequest("pick-nakroth", big).tier, "flash");
  assert.equal(routeRequest("pick-nakroth", { team: { mine: names(1), enemy: names(1) } }).tier, "lite");
});

test("build-situational needs a real build to use flash", () => {
  assert.equal(routeRequest("build-situational", { build: { available: true, items: [{ id: 1 }] } }).tier, "flash");
  assert.equal(routeRequest("build-situational", { build: { available: false, items: [] } }).tier, "lite");
});

test("unknown / missing action and client-supplied model or complexity flags never reach flash", () => {
  assert.equal(routeRequest("whatever", { model: "gemini-3.8-flash", complex: true }).tier, "lite");
  assert.equal(routeRequest(undefined, draft(5, 5)).tier, "lite");
  assert.equal(routeRequest({ toString: () => "draft-eval" }, draft(5, 5)).tier, "lite");
});

test("attempt plan is bounded: lite route never touches flash; flash route = flash once + lite", () => {
  assert.deepEqual(attemptPlan("lite", "F", "L").map((s) => s.model), ["L"]);
  const p = attemptPlan("flash", "F", "L");
  assert.deepEqual(p.map((s) => [s.model, s.retries]), [["F", 0], ["L", 1]]);
  assert.ok(p.reduce((n, s) => n + s.retries + 1, 0) <= 3);
  assert.deepEqual(attemptPlan("flash", null, "L").map((s) => s.model), ["L"]);
  assert.deepEqual(attemptPlan("flash", "L", "L").map((s) => s.model), ["L"]);
});

test("provider quota is distinguishable from other failures", () => {
  assert.equal(providerErrorCode(429), "provider_quota");
  assert.equal(providerErrorCode(503), "provider_overloaded");
  assert.equal(providerErrorCode(404), "provider_error");
});

test("cache: identical request hits, different hero/context/prompt/system version misses", async () => {
  const c = new ResponseCache<{ ok: boolean; out?: string; cacheable?: boolean }>(1000);
  let calls = 0;
  const run = (k: string) => c.getOrCompute(k, async () => (calls++, { ok: true, out: "x" }));
  const k1 = await cacheKey(["v1", "SYS-A", "lite", "q", JSON.stringify({ hero: "A" })]);
  const k2 = await cacheKey(["v1", "SYS-A", "lite", "q", JSON.stringify({ hero: "B" })]);
  const k3 = await cacheKey(["v1", "SYS-B", "lite", "q", JSON.stringify({ hero: "A" })]);
  assert.equal((await run(k1)).source, "miss");
  assert.equal((await run(k1)).source, "hit");
  assert.equal((await run(k2)).source, "miss");
  assert.equal((await run(k3)).source, "miss");
  assert.equal(calls, 3);
});

test("cache: failed / non-cacheable (validation fail, fallback) results are not stored", async () => {
  const c = new ResponseCache<{ ok: boolean; cacheable?: boolean }>(1000);
  let calls = 0;
  await c.getOrCompute("e", async () => (calls++, { ok: false }));
  await c.getOrCompute("e", async () => (calls++, { ok: false }));
  await c.getOrCompute("f", async () => (calls++, { ok: true, cacheable: false }));
  await c.getOrCompute("f", async () => (calls++, { ok: true, cacheable: false }));
  assert.equal(calls, 4);
});

test("cache: TTL expiry and concurrent identical requests share one compute", async () => {
  const c = new ResponseCache<{ ok: boolean }>(1000);
  let calls = 0;
  const slow = async () => (calls++, await new Promise((r) => setTimeout(r, 10)), { ok: true });
  const [a, b] = await Promise.all([c.getOrCompute("k", slow), c.getOrCompute("k", slow)]);
  assert.equal(calls, 1);
  assert.deepEqual([a.source, b.source].sort(), ["joined", "miss"]);
  const later = await c.getOrCompute("k", slow, Date.now() + 5000);
  assert.equal(later.source, "miss");
});
