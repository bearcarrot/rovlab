import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAbilityRows, cleanText, parseSkills, parseSkillsMap, pickIcon } from "../../src/lib/skills.ts";

// Run: node --experimental-strip-types --test tests/game-fetch/skills.test.ts
// ข้อมูลในเทสต์เป็นของสมมติ ไม่ใช่ผลตอบกลับจริงของเกม

const raw = (skills: unknown[]) => ({ code: 0, data: { skillList: [{ skills }] } });

test("S1 cleanText strips color tags, turns literal \\n into newlines and collapses blank lines", () => {
  assert.equal(cleanText("<color=#fff>ดาเมจ</color> 100\\n\\n\\n\\nเพิ่ม\r\nอีก"), "ดาเมจ 100\n\nเพิ่ม\nอีก");
  assert.equal(cleanText("  a < b  "), "a < b");
});

test("S2 pickIcon takes the first non-empty string field and fixes protocol-relative URLs", () => {
  assert.equal(pickIcon({ icon: "", iconUrl: " //cdn.example/x.png " }), "https://cdn.example/x.png");
  assert.equal(pickIcon({ img: "https://a/b.png" }), "https://a/b.png");
  assert.equal(pickIcon({ icon: 5 }), "");
});

test("S3 parseSkills reads idx/name/desc/icon and collects effect tags from any depth", () => {
  const r = parseSkills(
    raw([{ skillIdx: 1, name: "<b>Q</b>", desc: "ลดคูลดาวน์", icon: "//c/q.png", extra: { deep: { skillEffectType: 16, name: "บัฟ" } } }])
  );
  assert.deepEqual(r, [{ idx: 1, name: "Q", desc: "ลดคูลดาวน์", icon: "https://c/q.png", tags: [{ type: 16, name: "บัฟ" }] }]);
  assert.deepEqual(parseSkills({ code: -1 }), []);
  assert.deepEqual(parseSkills(null), []);
});

test("S4 parseSkillsMap accepts raw game responses and the old skills.json shape", () => {
  const m = parseSkillsMap(
    JSON.stringify({
      "101": raw([{ skillIdx: 0, name: "P" }]),
      "102": [{ idx: 2, name: "W", desc: "d", icon: "https://i/w.png", tags: [{ type: 8, name: "ฮีล" }] }],
      "abc": [{ idx: 1 }],
    })
  );
  assert.deepEqual([...m.keys()], [101, 102]);
  assert.deepEqual(m.get(102), [{ idx: 2, name: "W", desc: "d", icon: "https://i/w.png", tags: [{ type: 8, name: "ฮีล" }] }]);
  assert.throws(() => parseSkillsMap("{oops"), /JSON/);
  assert.throws(() => parseSkillsMap('{"1":[]}'), /ไม่พบ/);
  assert.throws(() => parseSkillsMap("[]"), /รูปแบบ/);
});

const sk = (idx: number, name: string, icon = "") => ({ idx, name, desc: `d${idx}`, icon, tags: [] });

test("S5 buildAbilityRows names ex slots, orders normal forms first and skips non passive/1-4 slots", () => {
  const { rows, skipped, ex } = buildAbilityRows(7, [sk(0, "P"), sk(1, "Q"), sk(2, "W"), sk(1, "Q2"), sk(0, "P2"), sk(1, "Q3"), sk(9, "X")], new Map(), true);
  assert.deepEqual(rows.map((r) => [r.slot, r.sort_order]), [["passive", 0], ["1", 1], ["2", 2], ["passive-ex", 3], ["1-ex", 4], ["1-ex2", 5]]);
  assert.equal(skipped, 1);
  assert.equal(ex, 3);
  assert.ok(rows.every((r) => r.game_id === 7));
});

test("S6 keeps the stored name unless overwriteName, and never blanks an existing icon", () => {
  const existing = new Map([["1", { name: "ชื่อที่แก้เอง", icon_url: "https://old/q.png" }]]);
  const keep = buildAbilityRows(1, [sk(1, "Q ใหม่", "")], existing, false).rows[0];
  assert.equal(keep.name, "ชื่อที่แก้เอง");
  assert.equal(keep.icon_url, "https://old/q.png");
  const over = buildAbilityRows(1, [sk(1, "Q ใหม่", "https://new/q.png")], existing, true).rows[0];
  assert.equal(over.name, "Q ใหม่");
  assert.equal(over.icon_url, "https://new/q.png");
  assert.equal(buildAbilityRows(1, [sk(2, "W")], new Map(), false).rows[0].icon_url, null);
});
