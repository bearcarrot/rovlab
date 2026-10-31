import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DATASETS, MANIFEST_KEY, buildBody, checkCount, disable, historyKey, mergeManifest, parseManifest, pickColumns, publish, rollback,
  type DatasetDef, type Entry, type Manifest, type ManifestRead, type PublishDeps, type Row,
} from "../../api/_publish/core.ts";

// Run: node --experimental-strip-types --test tests/publish/core.test.ts

const heroes = DATASETS.heroes;
const hero = (i: number, extra: Row = {}): Row => ({
  id: `id-${i}`, slug: `hero-${i}`, name: `Hero ${i}`, name_th: `ฮีโร่ ${i}`, role: "mage", lane: "mid", roles: ["mage"], lanes: ["mid"],
  difficulty: "easy", icon_url: null, phase: null, description: "d", strengths: [], weaknesses: [], ...extra,
});
const many = (n: number, extra: Row = {}) => Array.from({ length: n }, (_, i) => hero(i, extra));

type Fake = PublishDeps & { data: Map<string, string>; history: Map<number, Manifest>; manifest: { m: Manifest | null; etag: string | null }; log: string[] };

function fake(opts: { rows?: unknown[]; manifest?: Manifest | null; putData?: "failed"; putManifest?: Array<"ok" | "conflict" | "failed">; readManifest?: "error" } = {}): Fake {
  const f: Fake = {
    data: new Map(), history: new Map(), log: [],
    manifest: { m: opts.manifest ?? null, etag: opts.manifest ? '"e1"' : null },
    now: () => "2026-10-31T10:00:00.000Z",
    async fetchRows() {
      return opts.rows ?? many(130);
    },
    async putData(key, json) {
      f.log.push(`data:${key}`);
      if (opts.putData === "failed") return "failed";
      if (f.data.has(key)) return "exists";
      f.data.set(key, json);
      return "created";
    },
    async readManifest(): Promise<ManifestRead> {
      if (opts.readManifest === "error") return "error";
      return { manifest: f.manifest.m, etag: f.manifest.etag };
    },
    async readHistory(g) {
      return f.history.get(g) ?? null;
    },
    async putHistory(g, m) {
      f.log.push(`history:${g}`);
      f.history.set(g, m);
      return "created";
    },
    async putManifest(m, etag) {
      f.log.push(`manifest:${etag}`);
      const next = opts.putManifest?.shift() ?? "ok";
      if (next === "ok") f.manifest = { m, etag: '"e2"' };
      return next;
    },
  };
  return f;
}

test("pickColumns keeps only approved columns in a fixed order and fills missing with null", () => {
  const [row] = pickColumns(heroes, [{ ...hero(1), created_by: "secret", email: "x@y" }]);
  assert.deepEqual(Object.keys(row), [...heroes.columns]);
  assert.equal("created_by" in row, false);
  const [sparse] = pickColumns(heroes, [{ id: "a", slug: "a" }]);
  assert.equal(sparse.phase, null);
  assert.throws(() => pickColumns(heroes, [null]));
});

test("heroes columns match HERO_LIST_COLS in src/services/heroes.ts", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../../src/services/heroes.ts", import.meta.url), "utf8");
  const m = /const HERO_LIST_COLS = "([^"]+)"/.exec(src);
  assert.ok(m, "HERO_LIST_COLS not found");
  assert.deepEqual(m[1].split(",").map((s) => s.trim()), [...heroes.columns]);
});

test("buildBody is deterministic and content-addressed", async () => {
  const a = await buildBody(heroes, many(60));
  const b = await buildBody(heroes, many(60));
  assert.equal(a.json, b.json);
  assert.equal(a.key, b.key);
  assert.match(a.key, /^data\/v\/heroes\/[0-9a-f]{12}\.json$/);
  const c = await buildBody(heroes, many(61));
  assert.notEqual(a.key, c.key);
  assert.equal(a.count, 60);
  assert.equal(JSON.parse(a.json).rows.length, 60);
});

test("checkCount refuses empty, tiny and halved datasets unless forced", () => {
  const prev: Entry = { key: "data/v/heroes/aaaaaaaaaaaa.json", count: 130, bytes: 1, schema: 1 };
  assert.equal(checkCount(heroes, 130, prev, false), null);
  assert.match(checkCount(heroes, 0, prev, false) ?? "", /only 0/);
  assert.match(checkCount(heroes, 10, undefined, false) ?? "", /minimum/);
  assert.match(checkCount(heroes, 60, { ...prev, count: 130 }, false) ?? "", /under half/);
  assert.equal(checkCount(heroes, 20, prev, true), null);
  assert.match(checkCount(heroes, 0, prev, true) ?? "", /0 rows/);
});

test("publish uploads data first and the manifest last, archiving the previous manifest", async () => {
  const prev: Manifest = mergeManifest(null, { heroes: { key: "data/v/heroes/aaaaaaaaaaaa.json", count: 130, bytes: 1, schema: 1 } }, "2026-10-30T00:00:00.000Z");
  const f = fake({ manifest: prev });
  const out = await publish(f, ["heroes", "hero-text"]);
  assert.ok(out.ok && out.changed);
  const order = f.log.map((l) => l.split(":")[0]);
  assert.deepEqual(order, ["data", "data", "history", "manifest"]);
  assert.equal(f.log.at(-1), 'manifest:"e1"'); // conditional on the etag that was read
  assert.equal(f.manifest.m?.generation, 2);
  assert.deepEqual(Object.keys(f.manifest.m?.datasets ?? {}).sort(), ["hero-text", "heroes"]);
  assert.equal(f.history.get(1)?.generation, 1);
  assert.ok(parseManifest(JSON.parse(JSON.stringify(f.manifest.m))));
});

test("first publish creates the manifest with a create-only condition and no history", async () => {
  const f = fake();
  const out = await publish(f, ["heroes"]);
  assert.ok(out.ok && out.changed);
  assert.equal(f.log.at(-1), "manifest:null");
  assert.equal(f.history.size, 0);
  assert.equal(f.manifest.m?.generation, 1);
});

test("publishing identical data changes nothing", async () => {
  const f = fake();
  await publish(f, ["heroes"]);
  const logLen = f.log.length;
  const again = await publish(f, ["heroes"]);
  assert.ok(again.ok && !again.changed);
  assert.equal(again.ok && again.results.heroes, "unchanged");
  assert.equal(f.log.length, logLen);
});

test("a failed data upload leaves the manifest untouched", async () => {
  const f = fake({ putData: "failed" });
  const out = await publish(f, ["heroes"]);
  assert.ok(!out.ok && out.code === "UPLOAD_FAILED");
  assert.equal(f.log.some((l) => l.startsWith("manifest") || l.startsWith("history")), false);
  assert.equal(f.manifest.m, null);
});

test("an existing identical object (412) counts as success", async () => {
  const f = fake();
  const b = await buildBody(heroes, many(130));
  f.data.set(b.key, b.json);
  const out = await publish(f, ["heroes"]);
  assert.ok(out.ok && out.changed);
});

test("suspicious reads are refused before anything is written", async () => {
  const empty = fake({ rows: [] });
  const r1 = await publish(empty, ["heroes"]);
  assert.ok(!r1.ok && r1.code === "SUSPICIOUS_COUNT");
  assert.equal(empty.log.length, 0);

  const prev = mergeManifest(null, { heroes: { key: "data/v/heroes/aaaaaaaaaaaa.json", count: 130, bytes: 1, schema: 1 } }, "x");
  const half = fake({ rows: many(60), manifest: prev });
  const r2 = await publish(half, ["heroes"]);
  assert.ok(!r2.ok && r2.code === "SUSPICIOUS_COUNT");
  assert.equal(half.log.length, 0);
  assert.ok((await publish(fake({ rows: many(60), manifest: prev }), ["heroes"], { force: true })).ok);
});

test("a read error from Supabase or an unreadable manifest aborts without writing", async () => {
  const f = fake();
  f.fetchRows = async () => {
    throw new Error("boom");
  };
  const r = await publish(f, ["heroes"]);
  assert.ok(!r.ok && r.code === "READ_FAILED");
  const g = fake({ readManifest: "error" });
  const r2 = await publish(g, ["heroes"]);
  assert.ok(!r2.ok && r2.code === "MANIFEST_UNREADABLE");
  assert.equal(g.log.length, 0);
});

test("rejects unknown dataset names", async () => {
  const f = fake();
  for (const bad of [[], ["items"], ["heroes", "__proto__"], ["constructor"]]) {
    const r = await publish(f, bad as string[]);
    assert.ok(!r.ok && r.code === "BAD_DATASET", JSON.stringify(bad));
  }
  assert.equal(f.log.length, 0);
});

test("a lost manifest race is retried once, then reported", async () => {
  const retry = fake({ putManifest: ["conflict", "ok"] });
  const ok = await publish(retry, ["heroes"]);
  assert.ok(ok.ok && ok.changed);
  assert.equal(retry.log.filter((l) => l.startsWith("manifest")).length, 2);

  const always = fake({ putManifest: ["conflict", "conflict"] });
  const bad = await publish(always, ["heroes"]);
  assert.ok(!bad.ok && bad.code === "CONFLICT");
});

test("a failed manifest write is reported and the old manifest stays", async () => {
  const f = fake({ putManifest: ["failed"] });
  const r = await publish(f, ["heroes"]);
  assert.ok(!r.ok && r.code === "MANIFEST_FAILED");
  assert.equal(f.manifest.m, null);
});

test("rollback restores an archived generation under a new generation number", async () => {
  const f = fake();
  await publish(f, ["heroes"]); // generation 1
  const first = f.manifest.m!;
  f.fetchRows = async () => many(131);
  await publish(f, ["heroes"]); // generation 2, archives 1
  assert.notEqual(f.manifest.m!.datasets.heroes.key, first.datasets.heroes.key);
  const r = await rollback(f, 1);
  assert.ok(r.ok && r.changed);
  assert.equal(f.manifest.m!.generation, 3);
  assert.equal(f.manifest.m!.datasets.heroes.key, first.datasets.heroes.key);
  assert.ok(!(await rollback(f, 99)).ok);
  assert.ok(!(await rollback(f, 0)).ok);
});

test("disable removes a dataset so clients fall back to Supabase", async () => {
  const f = fake();
  await publish(f, ["heroes", "hero-text"]);
  const r = await disable(f, "heroes");
  assert.ok(r.ok && r.changed);
  assert.deepEqual(Object.keys(f.manifest.m!.datasets), ["hero-text"]);
  const again = await disable(f, "heroes");
  assert.ok(again.ok && !again.changed);
  assert.ok(!(await disable(f, "nope")).ok);
});

test("parseManifest rejects malformed manifests and foreign keys", () => {
  assert.equal(parseManifest(null), null);
  assert.equal(parseManifest({ schema: 2, generation: 1, generatedAt: "x", datasets: {} }), null);
  const bad = { schema: 1, generation: 1, generatedAt: "x", datasets: { heroes: { key: "data/v/other/aaaaaaaaaaaa.json", count: 1, bytes: 1, schema: 1 } } };
  assert.equal(parseManifest(bad), null);
  const evil = { ...bad, datasets: { heroes: { key: "../secret.json", count: 1, bytes: 1, schema: 1 } } };
  assert.equal(parseManifest(evil), null);
  assert.equal(MANIFEST_KEY, "data/manifest.json");
  assert.equal(historyKey(3), "data/manifest-history/3.json");
});

// keep the type import used even when assertions are stripped
const _unused: DatasetDef | undefined = undefined;
void _unused;
