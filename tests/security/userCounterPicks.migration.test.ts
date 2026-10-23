import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Static check of the migration text. It does NOT run Postgres: real cross-user isolation must be verified against a
// non-production database (see the report). This only guards against someone loosening the policies by accident.
const sql = readFileSync(new URL("../../supabase/migrations/20261023_user_counter_picks.sql", import.meta.url), "utf8");

test("RLS is enabled and anon has no access", () => {
  assert.match(sql, /alter table public\.user_counter_picks enable row level security/i);
  assert.match(sql, /revoke all on public\.user_counter_picks from anon, authenticated/i);
  assert.doesNotMatch(sql, /grant [^;]*to[^;]*\banon\b/i);
});

test("every policy is owner-only and for authenticated", () => {
  const policies = sql.match(/create policy [\s\S]*?;/gi) ?? [];
  assert.equal(policies.length, 4); // select / insert / update / delete
  for (const p of policies) {
    assert.match(p, /to authenticated/i);
    assert.match(p, /owner_id = \(select auth\.uid\(\)\)/i);
    assert.doesNotMatch(p, /is_admin|using\s*\(\s*true\s*\)|is_public/i);
  }
  assert.match(policies.find((p) => /for update/i.test(p)) ?? "", /with check/i); // a row cannot be handed to another account
});

test("duplicates, same-hero pairs and bad strength are rejected by constraints", () => {
  assert.match(sql, /unique \(owner_id, enemy_hero_id, counter_hero_id\)/i);
  assert.match(sql, /enemy_hero_id <> counter_hero_id/i);
  assert.match(sql, /strength in \('best', 'good', 'situational'\)/i);
});

test("migration is additive: never touches existing tables", () => {
  assert.doesNotMatch(sql, /(alter|drop|truncate|delete from|update|insert into)\s+(table\s+)?(public\.)?(hero_counters|user_combos|hero_synergies)/i);
});
