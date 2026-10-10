// กติกาการเลือก "พลังแฝง" (enchantment) ในบิลด์ — ฟังก์ชันล้วน ไม่แตะ React / Supabase เพื่อให้ทดสอบและรีวิวง่าย
//
// สายหลัก (primary)   : 3 ช่อง ช่อง n = พลังแฝง Tier n ทุกช่องต้องมาจากสายเดียวกัน (เลือกได้ถึง Tier 3)
// สายรอง (secondary)  : 2 ช่อง ต้องไม่ใช่สายเดียวกับสายหลัก และเลือกได้ 2 แบบ
//                       - Tier 1 สองอัน (จะคนละสายหรือสายเดียวกันก็ได้ แต่ห้ามซ้ำตัวเดิม)
//                       - Tier 1 + Tier 2 โดยต้องเป็นสาย (สี) เดียวกัน — Tier 2 เลือกได้ต่อเมื่อมี Tier 1 สายเดียวกันอีกช่อง
//                       ไม่มี Tier 3 ในสายรอง และ Tier 2 มีได้ไม่เกิน 1 อัน
// ใช้เฉพาะพลังแฝงที่ status = active / seasonal (inactive และ test_server เลือกลงบิลด์ไม่ได้)
// ค่าคงที่ทั้งหมดอยู่ที่ไฟล์นี้ไฟล์เดียว ถ้ากติกาในเกมเปลี่ยนให้แก้ที่นี่ (และ trigger ใน migration 20261011)

export type SelectionType = "primary" | "secondary";

export const PRIMARY_SLOTS = 3;
export const SECONDARY_SLOTS = 2;
export const PICKABLE_STATUSES = ["active", "seasonal"] as const;

export type EnchOpt = {
  id: string;
  name: string;
  nameTh: string;
  treeId: string;
  tier: number | null;
  status: string;
  icon?: string;
  verified: boolean;
};

// แถวใน item_build_enchantments (เฉพาะคอลัมน์ที่กติกาใช้)
export type SelRow = { id?: string; enchantment_id: string; selection_type: SelectionType; sort_order: number };

export type Check = { ok: true } | { ok: false; reason: string };
const ok: Check = { ok: true };
const no = (reason: string): Check => ({ ok: false, reason });

export const slotsOf = (t: SelectionType) => (t === "primary" ? PRIMARY_SLOTS : SECONDARY_SLOTS);
export const isPickable = (o: EnchOpt) => (PICKABLE_STATUSES as readonly string[]).includes(o.status);

type ById = ReadonlyMap<string, EnchOpt>;

// สายหลักของบิลด์ = สายของพลังแฝงสายหลักที่เลือกไว้ (ไม่มี = ยังไม่ได้เลือกสายหลัก)
export function primaryTree(rows: readonly SelRow[], byId: ById): string | null {
  for (const r of rows) {
    if (r.selection_type !== "primary") continue;
    const o = byId.get(r.enchantment_id);
    if (o) return o.treeId;
  }
  return null;
}

// ตรวจชุดที่เลือกทั้งชุด คืนรายการปัญหา (ว่าง = ถูกต้องตามกติกา) — ใช้ทั้งตอนเลือกและตอนโหลดบิลด์เดิมมาแสดง
export function validateSelection(rows: readonly SelRow[], byId: ById): string[] {
  const problems: string[] = [];
  const primary = rows.filter((r) => r.selection_type === "primary");
  const secondary = rows.filter((r) => r.selection_type === "secondary");
  const opt = (r: SelRow) => byId.get(r.enchantment_id);

  if (primary.length > PRIMARY_SLOTS) problems.push(`สายหลักเลือกได้ไม่เกิน ${PRIMARY_SLOTS} ช่อง`);
  if (secondary.length > SECONDARY_SLOTS) problems.push(`สายรองเลือกได้ไม่เกิน ${SECONDARY_SLOTS} ช่อง`);

  const seenSlot = new Set<string>();
  for (const r of rows) {
    const key = `${r.selection_type}:${r.sort_order}`;
    if (seenSlot.has(key)) problems.push("มีสองรายการอยู่ในช่องเดียวกัน");
    seenSlot.add(key);
    if (r.sort_order < 1 || r.sort_order > slotsOf(r.selection_type)) problems.push("หมายเลขช่องไม่ถูกต้อง");
    if (!opt(r)) problems.push("มีพลังแฝงที่ไม่พบในฐานข้อมูล");
  }

  const ids = rows.map((r) => r.enchantment_id);
  if (new Set(ids).size !== ids.length) problems.push("เลือกพลังแฝงตัวเดียวกันซ้ำไม่ได้");

  // สายหลัก: ช่อง n ต้องเป็น Tier n และอยู่สายเดียวกันทั้งหมด
  const pTrees = new Set<string>();
  for (const r of primary) {
    const o = opt(r);
    if (!o) continue;
    pTrees.add(o.treeId);
    if (o.tier !== r.sort_order) problems.push(`ช่องสายหลักที่ ${r.sort_order} ต้องเป็นพลังแฝง Tier ${r.sort_order}`);
  }
  if (pTrees.size > 1) problems.push("พลังแฝงสายหลักต้องมาจากสายเดียวกันทั้งหมด");

  // สายรอง: ห้ามสายเดียวกับสายหลัก, ไม่มี Tier 3, Tier 2 ต้องคู่กับ Tier 1 สายเดียวกัน และมีได้ไม่เกิน 1
  const pTree = pTrees.size === 1 ? [...pTrees][0] : null;
  let tier2 = 0;
  for (const r of secondary) {
    const o = opt(r);
    if (!o) continue;
    if (pTree && o.treeId === pTree) problems.push("สายรองต้องไม่ใช่สายเดียวกับสายหลัก");
    if (o.tier !== 1 && o.tier !== 2) problems.push("สายรองเลือกได้เฉพาะ Tier 1 หรือ Tier 2");
    if (o.tier === 2) {
      tier2++;
      const mate = secondary.find((x) => x !== r && opt(x)?.tier === 1 && opt(x)?.treeId === o.treeId);
      if (!mate) problems.push("Tier 2 ในสายรองต้องคู่กับ Tier 1 ของสายเดียวกัน (สีเดียวกัน)");
    }
  }
  if (tier2 > 1) problems.push("สายรองมี Tier 2 ได้ไม่เกิน 1 อัน");

  return [...new Set(problems)];
}

// ช่องที่ว่างอยู่ตัวแรกของสายนั้น (สายหลักช่อง = Tier)
export function nextFreeSlot(rows: readonly SelRow[], type: SelectionType): number | null {
  const used = new Set(rows.filter((r) => r.selection_type === type).map((r) => r.sort_order));
  for (let n = 1; n <= slotsOf(type); n++) if (!used.has(n)) return n;
  return null;
}

// เลือก `cand` ลงช่อง `slot` ของสาย `type` ได้หรือไม่ (ถ้าช่องนั้นมีของเดิมอยู่ = แทนที่)
// คืนเหตุผลภาษาไทยเมื่อไม่ได้ เพื่อแสดงให้แอดมินเห็นว่าทำไมปุ่มถูกปิด
export function canPick(rows: readonly SelRow[], byId: ById, type: SelectionType, slot: number, cand: EnchOpt): Check {
  if (!isPickable(cand)) return no("พลังแฝงนี้ยังไม่เปิดใช้ในเกมจริง (inactive / Test Server)");
  if (slot < 1 || slot > slotsOf(type)) return no("ไม่มีช่องนี้");

  const rest = rows.filter((r) => !(r.selection_type === type && r.sort_order === slot));
  if (rest.some((r) => r.enchantment_id === cand.id)) return no("เลือกพลังแฝงตัวเดียวกันซ้ำไม่ได้");

  const pTree = primaryTree(rest, byId);
  if (type === "primary") {
    if (cand.tier !== slot) return no(`ช่องสายหลักที่ ${slot} ต้องเป็น Tier ${slot}`);
    if (pTree && cand.treeId !== pTree) return no("สายหลักต้องเลือกจากสายเดียวกันทั้งหมด");
    const clash = rest.find((r) => r.selection_type === "secondary" && byId.get(r.enchantment_id)?.treeId === cand.treeId);
    if (clash) return no("สายนี้ถูกใช้เป็นสายรองอยู่แล้ว (ห้ามเป็นสายเดียวกับสายหลัก)");
    return ok;
  }

  // สายรอง
  if (pTree && cand.treeId === pTree) return no("สายรองต้องไม่ใช่สายเดียวกับสายหลัก");
  if (cand.tier !== 1 && cand.tier !== 2) return no("สายรองเลือกได้เฉพาะ Tier 1 หรือ Tier 2");
  const others = rest.filter((r) => r.selection_type === "secondary");
  if (cand.tier === 2) {
    const mate = others.find((r) => byId.get(r.enchantment_id)?.tier === 1 && byId.get(r.enchantment_id)?.treeId === cand.treeId);
    if (!mate) return no("Tier 2 ต้องเลือก Tier 1 ของสายเดียวกัน (สีเดียวกัน) ไว้ในอีกช่องก่อน");
    if (others.some((r) => byId.get(r.enchantment_id)?.tier === 2)) return no("สายรองมี Tier 2 ได้ไม่เกิน 1 อัน");
  }
  // แทนที่ Tier 1 ที่ Tier 2 อีกช่องพึ่งอยู่ ต้องยังเป็นสายเดียวกัน
  const dependent = others.find((r) => {
    const o = byId.get(r.enchantment_id);
    return o?.tier === 2;
  });
  if (dependent && cand.tier === 1) {
    const t2 = byId.get(dependent.enchantment_id)!;
    if (cand.treeId !== t2.treeId) return no("อีกช่องเป็น Tier 2 ต้องใช้ Tier 1 สายเดียวกันกับมัน");
  }
  return ok;
}

// ลบช่องนี้ได้หรือไม่ (สายรอง: ลบ Tier 1 ที่ Tier 2 พึ่งอยู่ไม่ได้ ต้องลบ Tier 2 ก่อน / สายหลัก: ลบ Tier ต่ำกว่าที่มี Tier สูงกว่าอยู่ได้)
export function canRemove(rows: readonly SelRow[], byId: ById, type: SelectionType, slot: number): Check {
  const target = rows.find((r) => r.selection_type === type && r.sort_order === slot);
  if (!target) return ok;
  if (type === "secondary") {
    const o = byId.get(target.enchantment_id);
    if (o?.tier === 1) {
      const dependent = rows.some(
        (r) => r.selection_type === "secondary" && r !== target && byId.get(r.enchantment_id)?.tier === 2 && byId.get(r.enchantment_id)?.treeId === o.treeId
      );
      if (dependent) return no("ลบ Tier 2 ของสายนี้ก่อน (Tier 2 ต้องมี Tier 1 สายเดียวกันคู่อยู่)");
    }
  }
  return ok;
}

// พลังแฝงที่ยังเลือกลงช่องนี้ได้ (ใช้กรองกริดเลือก) พร้อมเหตุผลของตัวที่เลือกไม่ได้
export function pickerOptions(
  rows: readonly SelRow[],
  byId: ById,
  all: readonly EnchOpt[],
  type: SelectionType,
  slot: number
): { opt: EnchOpt; check: Check }[] {
  const tierOk = (o: EnchOpt) => (type === "primary" ? o.tier === slot : o.tier === 1 || o.tier === 2);
  return all.filter(tierOk).map((opt) => ({ opt, check: canPick(rows, byId, type, slot, opt) }));
}
