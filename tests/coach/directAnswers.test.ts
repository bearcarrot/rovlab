import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildWhyAnswer,
  howToFaceAnswer,
  matchupPlanAnswer,
  prosConsAnswer,
  skillsAnswer,
  type MatchupPlanInput,
} from "../../src/features/coach/directAnswers.ts";

// Run: node --experimental-strip-types --test tests/coach/directAnswers.test.ts  (Node >= 22.6, no extra deps)
// undefined = "DB cannot answer / not sure" → CoachFab falls back to ai-coach (Gemini)

// ---------- skills ----------
test("D1 skills: lists every real skill with its description", () => {
  const out = skillsAnswer("Arum", [
    { slot: "1", name: "Dash", description: "พุ่งไปข้างหน้า" },
    { slot: "ult", name: "Burst", description: "ดาเมจสูง" },
  ]);
  assert.ok(out);
  assert.match(out, /^สกิลของ Arum ตามข้อมูลในระบบ/);
  assert.match(out, /\[1\] \*\*Dash\*\*: พุ่งไปข้างหน้า/);
  assert.match(out, /\[ult\] \*\*Burst\*\*: ดาเมจสูง/);
});

test("D2 skills: any skill without a description, or no skills → undefined (AI answers)", () => {
  assert.equal(skillsAnswer("A", [{ slot: "1", name: "Dash", description: "x" }, { slot: "2", name: "Hit", description: "  " }]), undefined);
  assert.equal(skillsAnswer("A", []), undefined);
});

// ---------- pros / cons ----------
test("D3 pros-cons: needs both sides", () => {
  const out = prosConsAnswer("Arum", ["เคลื่อนที่เร็ว", " "], ["เลือดน้อย"]);
  assert.ok(out);
  assert.match(out, /- เคลื่อนที่เร็ว/);
  assert.match(out, /- เลือดน้อย/);
  assert.equal(prosConsAnswer("Arum", ["a"], []), undefined);
  assert.equal(prosConsAnswer("Arum", [], ["b"]), undefined);
  assert.equal(prosConsAnswer("Arum", ["", "  "], ["b"]), undefined);
});

// ---------- how to face ----------
const counter = (heroNameTh: string | undefined, strength: "best" | "good" | "situational", reason = "", laneTip = "") => ({
  heroSlug: heroNameTh ?? "x",
  heroNameTh,
  strength,
  reason,
  laneTip,
});

test("D4 how-to-face: best first, ties keep source order, capped at 5, needs reason or tip", () => {
  const out = howToFaceAnswer("Zill", [
    counter("C", "situational", "r3"),
    counter("A", "good", "r2"),
    counter("B", "best", "r1", "tip1"),
    counter("D", "best", "r4"),
    counter("E", "good", "r5"),
    counter("F", "good", "r6"),
    counter("NoText", "best", "", ""), // skipped: nothing the team wrote
    counter(undefined, "best", "ghost"), // skipped: no hero name
  ]);
  assert.ok(out);
  const names = [...out.matchAll(/^- \*\*(\w+)\*\*/gm)].map((m) => m[1]);
  assert.deepEqual(names, ["B", "D", "A", "E", "F"]);
  assert.match(out, /\*\*B\*\* \(ชนะทางได้ดีที่สุด\): r1 · เคล็ดลับเลน: tip1/);
  assert.doesNotMatch(out, /NoText|ghost/);
});

test("D5 how-to-face: nothing usable → undefined", () => {
  assert.equal(howToFaceAnswer("Zill", []), undefined);
  assert.equal(howToFaceAnswer("Zill", [counter("A", "best", "", "")]), undefined);
});

// ---------- matchup plan ----------
const plan: MatchupPlanInput = {
  aName: "A", bName: "B", lane: "เลนกลาง", difficulty: "ยาก",
  early: "เก็บเลเวล", mid: "", late: "ระวังโดนล้ม", winCondition: "", tips: "ถือสกิลหนี",
  source: "curated", reversed: false,
};

test("D6 matchup-plan: curated plan for the user's side is used, empty sections skipped", () => {
  const out = matchupPlanAnswer(plan);
  assert.ok(out);
  assert.match(out, /แผนเล่น A เจอ B ที่ทีมงานเขียนไว้/);
  assert.match(out, /เลน: เลนกลาง · ความยาก: ยาก/);
  assert.match(out, /- \*\*ต้นเกม\*\*: เก็บเลเวล/);
  assert.match(out, /- \*\*ท้ายเกม\*\*: ระวังโดนล้ม/);
  assert.match(out, /- \*\*เคล็ดลับ\*\*: ถือสกิลหนี/);
  assert.doesNotMatch(out, /กลางเกม|เงื่อนไขชนะ/);
});

test("D7 matchup-plan: reversed plan, heuristic source or empty plan → undefined (AI answers)", () => {
  assert.equal(matchupPlanAnswer({ ...plan, reversed: true }), undefined);
  assert.equal(matchupPlanAnswer({ ...plan, source: "heuristic" }), undefined);
  assert.equal(matchupPlanAnswer({ ...plan, early: "", late: "", tips: "" }), undefined);
});

test("D8 matchup-plan: no shared lane omits the lane label", () => {
  const out = matchupPlanAnswer({ ...plan, lane: "" });
  assert.ok(out);
  assert.doesNotMatch(out, /เลน:/);
  assert.match(out, /ความยาก: ยาก/);
});

// ---------- build why ----------
const item = (slug: string, name: string) => ({ id: slug, slug, name, nameTh: `ไทย-${name}`, cost: 2000, stats: [], passive: "", icon: "" });
const items = [item("a-sword", "Sword A"), item("b-boots", "Boots B")];
const build = {
  heroSlug: "h", patch: "27.08", source: "curated" as const,
  items: [
    { itemSlug: "b-boots", reason: "เคลื่อนที่เร็ว", phase: "early" as const },
    { itemSlug: "ghost-item", reason: "ไม่มีใน DB", phase: "core" as const }, // must never be invented
    { itemSlug: "a-sword", reason: "", phase: "situational" as const },
  ],
  arcana: [{ name: "Sage", reason: "พลังเวทเพิ่ม" }, { name: "NoReason", reason: "" }],
};

test("D9 build-why: English item names, unknown slugs skipped, reasons only where written, Top Server note", () => {
  const out = buildWhyAnswer("Arum", build, items, "27.08");
  assert.ok(out);
  assert.match(out, /เหตุผลของบิลด์ Arum ตามข้อมูลในระบบ \(แพตช์ 27\.08\)/);
  assert.match(out, /- \*\*Boots B\*\* \(ต้นเกม\): เคลื่อนที่เร็ว/);
  assert.match(out, /- \*\*Sword A\*\* \(ตามสถานการณ์\)$/m); // in the build but no reason written → name only, no invented reason
  assert.match(out, /- \*\*Sage\*\*: พลังเวทเพิ่ม/);
  assert.doesNotMatch(out, /ghost|NoReason/);
  assert.match(out, /Top 10 Server/);
});

test("D10 build-why: stale patch is flagged (never called latest)", () => {
  assert.match(buildWhyAnswer("Arum", build, items, "27.09")!, /แพตช์ 27\.08 เก่ากว่าแพตช์ปัจจุบัน 27\.09/);
  assert.doesNotMatch(buildWhyAnswer("Arum", build, items, null)!, /เก่ากว่า/);
});

test("D11 build-why: heuristic build, no build, or no written reasons → undefined (AI answers)", () => {
  assert.equal(buildWhyAnswer("Arum", { ...build, source: "heuristic" }, items, "27.08"), undefined);
  assert.equal(buildWhyAnswer("Arum", null, items, "27.08"), undefined);
  assert.equal(buildWhyAnswer("Arum", undefined, items, "27.08"), undefined);
  const noReasons = { ...build, items: build.items.map((i) => ({ ...i, reason: "" })), arcana: [{ name: "Sage", reason: "" }] };
  assert.equal(buildWhyAnswer("Arum", noReasons, items, "27.08"), undefined);
});
