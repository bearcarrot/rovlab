import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

type Rule = { source: string; headers: { key: string; value: string }[] };
const cfg = JSON.parse(await readFile(new URL("../../vercel.json", import.meta.url), "utf8")) as { rewrites: { source: string }[]; headers: Rule[] };

test("vercel.json: /v1 is immutable and not also matched by the generic image rule", () => {
  const generic = cfg.headers.find((h) => h.source.includes("png|webp"))!;
  const re = new RegExp(`^${generic.source}$`);
  for (const p of ["/v1/logo-64.webp", "/assets/x.png"]) assert.equal(re.test(p), false, `${p} must not match the generic image rule`);
  assert.equal(re.test("/logo.png"), true);
  const v1 = cfg.headers.find((h) => h.source === "/v1/(.*)")!;
  assert.match(v1.headers.find((x) => x.key === "Cache-Control")!.value, /max-age=31536000, immutable/);
});

test("the Supabase /img proxy is gone (images live in R2)", () => {
  assert.equal(JSON.stringify(cfg).includes("/img/"), false);
  assert.equal(JSON.stringify(cfg).includes("storage/v1/object/public/hero-icons"), false);
});

async function* walk(dir: URL): AsyncGenerator<URL> {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const u = new URL(e.name + (e.isDirectory() ? "/" : ""), dir);
    if (e.isDirectory()) yield* walk(u);
    else if (/\.(ts|tsx)$/.test(e.name)) yield u;
  }
}

test("no app code uploads to Supabase Storage or links the old /img proxy (admin uploads go to R2 via /api/upload)", async () => {
  const bad: string[] = [];
  for await (const f of walk(new URL("../../src/", import.meta.url))) {
    const text = await readFile(f, "utf8");
    if (/supabase\.storage\b|storage\.from\(/.test(text) || /["'`]\/img\//.test(text)) bad.push(f.pathname);
  }
  assert.deepEqual(bad, []);
});
