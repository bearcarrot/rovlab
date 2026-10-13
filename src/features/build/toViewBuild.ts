import type { HeroBuild, ItemSummary } from "@/types/item";
import type { ViewBuild } from "./buildView";

// แปลง HeroBuild (จาก services/items) เป็นข้อมูลสำหรับ ReadOnlyBuild
// ไอเทมที่ไม่พบในตาราง items จะถูกข้าม (ไม่แต่งชื่อ/ไอคอนเอง)
// thaiNames: ใส่ชื่อไทย (items.name_th) ให้ ReadOnlyBuild แสดงแทนชื่ออังกฤษ — หน้า Item Build เดิมไม่เปิด จึงไม่เปลี่ยนหน้าตา
export function toViewBuild(build: HeroBuild, items: ItemSummary[], thaiNames = false): ViewBuild {
  const bySlug = new Map(items.map((i) => [i.slug, i]));
  return {
    items: build.items.flatMap((i) => {
      const it = bySlug.get(i.itemSlug);
      return it
        ? [{ slug: it.slug, name: it.name, ...(thaiNames && it.nameTh ? { nameTh: it.nameTh } : {}), icon: it.icon || undefined, phase: i.phase, reason: i.reason }]
        : [];
    }),
    runes: build.arcana.map((a) => ({ key: a.name, name: a.name, icon: a.icon, color: a.color, quantity: a.quantity ?? 1 })),
    spell: build.spell
      ? { slug: build.spell.slug, name: build.spell.name, nameTh: build.spell.nameTh, icon: build.spell.icon, cooldownSeconds: build.spell.cooldownSeconds }
      : null,
    enchantments: (build.enchantments ?? []).map((e) => ({ slug: e.slug, name: e.name, nameTh: e.nameTh, icon: e.icon, tier: e.tier, type: e.type })),
  };
}
