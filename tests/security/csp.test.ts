import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// vercel.json enforces a CSP without 'unsafe-inline' for scripts: the one inline <script> in index.html is allowed by hash.
// If you edit that script, update the sha256 in vercel.json (this test prints the new value).
const html = readFileSync("index.html", "utf8");
const cfg = JSON.parse(readFileSync("vercel.json", "utf8"));
const headers: { key: string; value: string }[] = cfg.headers.find((h: { source: string }) => h.source === "/(.*)").headers;
const csp = headers.find((h) => h.key === "Content-Security-Policy")?.value ?? "";

test("CSP is enforced (not report-only)", () => {
  assert.ok(csp, "Content-Security-Policy header missing");
  assert.ok(!headers.some((h) => h.key === "Content-Security-Policy-Report-Only"));
});

test("script-src has no unsafe-inline / unsafe-eval, and blocks object/base-uri abuse", () => {
  const scriptSrc = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("script-src ")) ?? "";
  assert.ok(scriptSrc);
  assert.ok(!scriptSrc.includes("'unsafe-inline'") && !scriptSrc.includes("'unsafe-eval'"), scriptSrc);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /script-src-attr 'none'/);
});

test("every inline <script> in index.html is covered by a hash in the CSP", () => {
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g)];
  assert.ok(inline.length >= 1);
  for (const [, body] of inline) {
    const hash = `'sha256-${createHash("sha256").update(body).digest("base64")}'`;
    assert.ok(csp.includes(hash), `inline script hash missing from CSP: ${hash}`);
  }
});

test("index.html has no inline event handler attributes (blocked by script-src-attr 'none')", () => {
  assert.doesNotMatch(html, /\son(load|click|error|submit|change)=/i);
});

// ---- Announcements: embeds (YouTube/Vimeo) and direct video need frame-src / media-src ----
const directive = (name: string): string[] => {
  const d = csp.split(";").map((x) => x.trim()).find((x) => x === name || x.startsWith(`${name} `));
  return d ? d.split(/\s+/).slice(1) : [];
};

test("frame-src allows only Google sign-in plus the two embed hosts, with no wildcard or scheme-wide source", () => {
  const frame = directive("frame-src");
  assert.deepEqual([...frame].sort(), ["https://accounts.google.com/gsi/", "https://player.vimeo.com", "https://www.youtube-nocookie.com"]);
  for (const token of frame) assert.ok(!token.includes("*") && token !== "https:" && token !== "http:" && token !== "data:", token);
});

test("media-src is exactly 'self' https: (direct video from any https host; no http:, data: or blob:)", () => {
  assert.deepEqual(directive("media-src"), ["'self'", "https:"]);
});

test("the announcements change loosens nothing else", () => {
  assert.deepEqual(directive("default-src"), ["'self'"]);
  assert.ok(!directive("script-src").includes("https:"), "script-src must not become scheme-wide");
  assert.ok(directive("script-src").includes("'sha256-5z+1H/JOUpQQ3u+HKs3Qc90MPnLbRLmYkVajlbVlV7s='"));
  assert.deepEqual(directive("frame-ancestors"), ["'none'"]);
  assert.deepEqual(directive("object-src"), ["'none'"]);
  assert.ok(directive("connect-src").includes("https://mttcdaiwuasnkqlxbeqs.supabase.co"));
});
