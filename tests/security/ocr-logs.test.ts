import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// scoreboard-ocr handles scoreboard text (player names). No log call may print the model's text or an upstream response body.
test("scoreboard-ocr never logs model output or response bodies", () => {
  const src = readFileSync(new URL("../../supabase/functions/scoreboard-ocr/index.ts", import.meta.url), "utf8");
  const calls = src.match(/console\.\w+\([^;]*\);/g) ?? [];
  assert.ok(calls.length > 0);
  for (const c of calls) assert.doesNotMatch(c, /\btext\b|\.text\(\)|\.json\(\)|\braw\b|\bb64\b/, c);
});
