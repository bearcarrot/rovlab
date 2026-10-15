import type { HeroBuild, ItemSummary } from "@/types/item";

// context ฝั่ง Coach Ai: บิลด์ที่เลือกบนหน้า Hero Detail (ข้อมูลจริงจาก DB เท่านั้น ไม่แต่งเพิ่ม)
// ชื่อไอเทม/รูน/พลังแฝง/สกิลชาเลนเจอร์ ส่งเป็นภาษาอังกฤษตรงกับในเกม (คอลัมน์ name); ส่วนคำอธิบายยังเป็นไทยตามข้อมูลใน DB
// ai-coach ตัด context ที่ 8000 ตัวอักษร (ดู supabase/functions/ai-coach) จึงเผื่อไว้ที่ 7200 แล้วย่อข้อความทีละขั้น
const BUDGET = 7200;
const STEPS = [
  { passive: 90, reason: 140, stats: 4 },
  { passive: 50, reason: 80, stats: 3 },
  { passive: 0, reason: 40, stats: 2 },
  { passive: 0, reason: 0, stats: 0 },
];

const squash = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, Math.max(0, n - 1))}…`;
};

type Step = (typeof STEPS)[number];

function block(build: HeroBuild, items: ItemSummary[], latestPatch: string | null, st: Step) {
  const bySlug = new Map(items.map((i) => [i.slug, i]));
  return {
    // บอก AI ว่าข้อมูลก้อนนี้คือข้อเท็จจริงจากฐานข้อมูล ส่วนคำแนะนำเชิงกลยุทธ์เป็นของ AI
    dataSource: "ฐานข้อมูล RoV LAB (ข้อเท็จจริง ไม่ใช่การประเมินของ AI)",
    buildId: build.id ?? null,
    kind: build.source === "curated" ? "curated" : "heuristic",
    // บิลด์นี้เป็นของ RoV LAB ไม่ใช่ Top Server — ให้แนะนำผู้ใช้ดูบิลด์ Top 10 Server ในเกมควบคู่
    note: "บิลด์นี้เป็นของ RoV LAB อาจอัปเดตไม่เท่าในเกม ไม่ใช่ข้อมูล Top Server",
    patch: build.patch,
    latestPatch,
    // null = ไม่ทราบแพตช์ล่าสุด; false = บิลด์เก่ากว่าแพตช์ปัจจุบัน ห้ามเรียกว่าเมต้าล่าสุด
    patchIsLatest: latestPatch ? build.patch === latestPatch : null,
    createdAt: build.createdAt ? build.createdAt.slice(0, 10) : null,
    // เรียงตามลำดับในบิลด์; id = slug ของ items (คีย์ที่ไม่ซ้ำใน DB); ข้ามไอเทมที่ไม่พบใน items
    items: build.items.flatMap((b) => {
      const it = bySlug.get(b.itemSlug);
      if (!it) return [];
      return [
        {
          id: it.slug,
          name: it.name,
          phase: b.phase,
          cost: it.cost,
          ...(st.stats > 0 && it.stats.length > 0 ? { stats: it.stats.slice(0, st.stats).map((s) => squash(s, 40)) } : {}),
          ...(st.passive > 0 && it.passive ? { passive: squash(it.passive, st.passive) } : {}),
          ...(st.reason > 0 && b.reason ? { reason: squash(b.reason, st.reason) } : {}),
        },
      ];
    }),
    runes: build.arcana.map((a) => ({ name: a.name, color: a.color ?? null, quantity: a.quantity ?? 1 })),
    challengerSpell: build.spell
      ? {
          name: build.spell.name,
          cooldownSeconds: build.spell.cooldownSeconds,
          ...(st.reason > 0 && build.spell.description ? { description: squash(build.spell.description, st.reason) } : {}),
        }
      : null,
    enchantments: (build.enchantments ?? []).map((e) => ({ name: e.name, tier: e.tier, type: e.type })),
  };
}

/** บิลด์ที่ตัดข้อความให้พอดีงบ — ไม่ตัดรายการ (ชื่อไอเทม/รูน/พลังแฝงอยู่ครบเสมอ) */
export function buildForCoach(build: HeroBuild, items: ItemSummary[], latestPatch: string | null, base: Record<string, unknown>) {
  for (const st of STEPS) {
    const v = { ...base, build: block(build, items, latestPatch, st) };
    if (JSON.stringify(v).length <= BUDGET) return v;
  }
  return { ...base, build: block(build, items, latestPatch, STEPS[STEPS.length - 1]) };
}

/** ฮีโร่นี้ไม่มีบิลด์ในระบบ: บอก AI ตรงๆ เพื่อไม่ให้แต่งไอเทมเอง */
export function noBuildForCoach(base: Record<string, unknown>) {
  return { ...base, build: { available: false, note: "ยังไม่มีบิลด์แนะนำของฮีโร่นี้ในฐานข้อมูล ห้ามแต่งชื่อไอเทมหรือรูนขึ้นเอง" } };
}
