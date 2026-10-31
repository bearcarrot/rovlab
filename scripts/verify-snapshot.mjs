#!/usr/bin/env node
// Read-only equivalence check: every published R2 snapshot row must equal what Supabase returns right now.
//   SUPABASE_URL=https://xxx.supabase.co SUPABASE_ANON_KEY=... node scripts/verify-snapshot.mjs [heroes hero-text]
// Optional: ASSETS_BASE (default https://assets.rovlab.app). Exit code 1 on any difference. Makes 1 + N small GETs; writes nothing.
import { isDeepStrictEqual } from "node:util";

const SB = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
const KEY = process.env.SUPABASE_ANON_KEY ?? "";
const BASE = (process.env.ASSETS_BASE ?? "https://assets.rovlab.app").replace(/\/+$/, "");
if (!SB || !KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_ANON_KEY (anon key only, never the service role key).");
  process.exit(2);
}

// Keep in step with DATASETS in api/_publish/core.ts (same columns, same order).
const DEFS = {
  heroes: { table: "heroes", columns: ["id", "slug", "name", "name_th", "role", "lane", "roles", "lanes", "difficulty", "icon_url", "phase"], order: "name.asc" },
  "hero-text": { table: "heroes", columns: ["id", "slug", "description", "strengths", "weaknesses"], order: "name.asc" },
};
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(DEFS);

const getJson = async (url, headers = {}) => {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
};

const manifest = await getJson(`${BASE}/data/manifest.json`);
let bad = 0;
for (const name of names) {
  const def = DEFS[name];
  const entry = manifest.datasets?.[name];
  if (!def || !entry) {
    console.log(`SKIP  ${name}: not in manifest (generation ${manifest.generation})`);
    continue;
  }
  const snap = (await getJson(`${BASE}/${entry.key}`)).rows;
  const live = await getJson(`${SB}/rest/v1/${def.table}?select=${def.columns.join(",")}&order=${def.order}`, { apikey: KEY, Authorization: `Bearer ${KEY}` });
  const same = snap.length === live.length && snap.every((row, i) => isDeepStrictEqual(row, live[i]));
  if (same) console.log(`OK    ${name}: ${snap.length} rows identical (generation ${manifest.generation})`);
  else {
    bad++;
    const i = snap.findIndex((row, j) => !isDeepStrictEqual(row, live[j]));
    console.log(`DIFF  ${name}: snapshot ${snap.length} rows vs live ${live.length}; first difference at index ${i}`);
    if (i >= 0) console.log("  snapshot:", JSON.stringify(snap[i]), "\n  live:    ", JSON.stringify(live[i]));
    console.log("  (a difference right after an admin edit just means the snapshot needs republishing)");
  }
}
process.exit(bad ? 1 : 0);
