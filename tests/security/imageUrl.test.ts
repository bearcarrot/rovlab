import { test } from "node:test";
import assert from "node:assert/strict";
import { STORAGE_PREFIX, viaVercel } from "../../src/lib/imageUrl.ts";

test("Supabase hero-icons URLs map to the same-origin /img/ path (one URL per icon for page + share canvas)", () => {
  assert.equal(viaVercel(`${STORAGE_PREFIX}heroes/1792601038213-a.webp`), "/img/heroes/1792601038213-a.webp");
});

test("R2 and other URLs are left untouched", () => {
  assert.equal(viaVercel("https://assets.rovlab.app/hero-icons/heroes/1-a.webp"), "https://assets.rovlab.app/hero-icons/heroes/1-a.webp");
  assert.equal(viaVercel("https://cdn.example/x.png"), "https://cdn.example/x.png");
  assert.equal(viaVercel("/img/already.png"), "/img/already.png");
});

test("vercel.json: /v1 and /img are immutable and not also matched by the generic image rule", async () => {
  const { readFile } = await import("node:fs/promises");
  const cfg = JSON.parse(await readFile(new URL("../../vercel.json", import.meta.url), "utf8")) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };
  const generic = cfg.headers.find((h) => h.source.includes("png|webp"))!;
  const re = new RegExp(`^${generic.source}$`);
  for (const p of ["/v1/logo-64.webp", "/img/heroes/1-a.webp", "/assets/x.png"]) assert.equal(re.test(p), false, `${p} must not match the generic image rule`);
  assert.equal(re.test("/logo.png"), true);
  const cc = (src: string) => cfg.headers.find((h) => h.source === src)!.headers.find((x) => x.key === "Cache-Control")!.value;
  assert.match(cc("/v1/(.*)"), /max-age=31536000, immutable/);
  assert.match(cc("/img/(.*)"), /s-maxage=31536000.*immutable/);
});
