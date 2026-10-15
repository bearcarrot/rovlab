import { test } from "node:test";
import assert from "node:assert/strict";
import { cutTier, parseProTable } from "../../supabase/functions/pro-stats/parse.ts";

// Run: node --experimental-strip-types --test tests/pro/parse.test.ts  (Node >= 22.6, no extra deps)
// HTML ด้านล่างสร้างเองตามลำดับคอลัมน์ที่เห็นในหัวตารางของ Liquipedia (ยังไม่ได้เทียบกับหน้าจริง)
const td = (v: string | number) => `<td>${v}</td>`;
const row = (rank: number, name: string, picks: number, wins: number, bans: number, opts: { details?: string; pb?: number } = {}) => {
  const cells = [
    rank, `<a href="/x" title="${name}"><img alt="${name}"></a> <a href="/x">${name}</a>`,
    picks, wins, picks - wins, "50.00%", "20.00%", // picks ∑ W L WR %T
    0, 0, 0, "0.00%", 0, 0, 0, "0.00%", // blue / red (ไม่ใช้)
    bans, bans ? "10.00%" : "-", // bans ∑ %T
    opts.pb ?? picks + bans, "30.00%", // P&B ∑ %T
  ];
  return `<tr>${cells.map(td).join("")}<td>${opts.details ?? "Show"}</td></tr>`;
};
const page = (...rows: string[]) => `<table><tr><th></th><th>Hero</th><th>Picks / ∑</th></tr>${rows.join("")}</table>`;
// Details ที่มีตารางซ้อน (ทำให้ regex ตัดแถวนอกก่อนเวลา) ต้องไม่ทำให้แถวฮีโร่หาย
const nested = `<table><tr><th>Played With</th><th>∑</th></tr><tr><td>Airi</td><td>3</td></tr></table>`;

test("P1 reads rows, computes win rate, sorts by ∑, banned-only hero counts, nested Details table is ignored", () => {
  const rows = parseProTable(
    page(row(1, "Toro", 20, 12, 30, { details: nested }), row(2, "Airi", 10, 4, 0, { details: nested }), row(3, "Krixi", 0, 0, 5))
  );
  assert.deepEqual(rows.map((r) => [r.name, r.sigma, r.picks, r.win_rate]), [["Toro", 50, 20, 60], ["Airi", 10, 10, 40], ["Krixi", 5, 0, 0]]);
  assert.equal(rows[2].ban_rate, 10); // "-" ในคอลัมน์ที่ไม่มีค่า = 0 ไม่ทำให้พัง
});

test("P2 tier cut is relative to the highest ∑ (highest = S+), boundaries are inclusive", () => {
  assert.deepEqual([50, 40, 39, 30, 29, 20, 19, 10, 9, 0].map((s) => cutTier(s, 50)), ["S+", "S+", "S", "S", "A", "A", "B", "B", "C", "C"]);
  assert.equal(cutTier(0, 0), "C");
  const rows = parseProTable(page(row(1, "Toro", 20, 12, 30), row(2, "Airi", 10, 4, 0)));
  assert.deepEqual(rows.map((r) => r.tier), ["S+", "B"]);
});

test("P3 shifted columns fail loudly instead of importing wrong numbers", () => {
  assert.throws(() => parseProTable(page(row(1, "Toro", 20, 12, 30, { pb: 99 }))), /โครงสร้างตาราง/);
});

test("P4 no table or duplicate heroes throw", () => {
  assert.throws(() => parseProTable("<p>nothing</p>"), /ไม่พบตาราง/);
  assert.throws(() => parseProTable(page(row(1, "Toro", 2, 1, 0), row(2, "toro", 2, 1, 0))), /ซ้ำ/);
});

test("P5 decodes entities in hero names", () => {
  assert.equal(parseProTable(page(row(1, "Kil&#39;Groth", 2, 1, 0)))[0].name, "Kil'Groth");
});
