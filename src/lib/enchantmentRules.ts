// กติกาการเลือก "พลังแฝง" (enchantment) ในบิลด์ — ฟังก์ชันล้วน ไม่แตะ React / Supabase เพื่อให้ทดสอบและรีวิวง่าย
// (หน้าตาในแอดมินเลียนแบบหน้าพลังแฝงในเกม: สีหลัก → โหนด I / II / III, สีรอง 2 ช่อง)
//
// สายหลัก (primary)   : 3 ช่อง ช่อง n = พลังแฝง Tier n ทุกช่องต้องมาจากสาย (สี) เดียวกัน (เลือกได้ถึง Tier 3)
// สายรอง (secondary)  : 2 ช่อง แต่ละช่องเลือกสีเอง และต้องไม่ใช่สีเดียวกับสายหลัก
//                       - ช่อง 1 เป็น Tier 1 เสมอ
//                       - ช่อง 2 เลือกหลังช่อง 1: คนละสีกับช่อง 1 = Tier 1, สีเดียวกับช่อง 1 = Tier 2
//                         (Tier 2 เลือกได้ก็ต่อเมื่อเลือกสีเดียวกับช่อง 1)
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

const rowAt = (rows: readonly SelRow[], type: SelectionType, slot: number) =>
  rows.find((r) => r.selection_type === type && r.sort_order === slot);

// สีของพลังแฝงที่อยู่ในช่องนั้น (ไม่มี = ว่าง)
export function treeAt(rows: readonly SelRow[], byId: ById, type: SelectionType, slot: number): string | null {
  const r = rowAt(rows, type, slot);
  return (r && byId.get(r.enchantment_id)?.treeId) || null;
}

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
    if (o.tier !== r.sort_order) problems.push(`ช่องสายหลัก Tier ${r.sort_order} ต้องเป็นพลังแฝง Tier ${r.sort_order}`);
  }
  if (pTrees.size > 1) problems.push("พลังแฝงสายหลักต้องมาจากสีเดียวกันทั้งหมด");

  // สายรอง: ห้ามสีเดียวกับสายหลัก / ช่อง 1 = Tier 1 / ช่อง 2: คนละสีกับช่อง 1 = Tier 1, สีเดียวกัน = Tier 2
  const pTree = pTrees.size === 1 ? [...pTrees][0] : null;
  for (const r of secondary) {
    const o = opt(r);
    if (o && pTree && o.treeId === pTree) problems.push("สายรองต้องไม่ใช่สีเดียวกับสายหลัก");
  }
  const s1 = secondary.find((r) => r.sort_order === 1);
  const s2 = secondary.find((r) => r.sort_order === 2);
  const o1 = s1 && opt(s1);
  const o2 = s2 && opt(s2);
  if (o1 && o1.tier !== 1) problems.push("ช่อง 1 ของสายรองต้องเป็น Tier 1");
  if (s2 && !s1) problems.push("ต้องเลือกช่อง 1 ของสายรองก่อนช่อง 2");
  if (o1 && o2) {
    if (o1.treeId === o2.treeId && o2.tier !== 2) problems.push("ช่อง 2 สีเดียวกับช่อง 1 ต้องเป็น Tier 2");
    if (o1.treeId !== o2.treeId && o2.tier !== 1) problems.push("ช่อง 2 คนละสีกับช่อง 1 ต้องเป็น Tier 1 (Tier 2 ต้องสีเดียวกับช่อง 1)");
  }

  return [...new Set(problems)];
}

// Tier ที่พลังแฝงของสี `treeId` ต้องมีเมื่อใส่ในช่องนี้ (null = ช่องนี้ยังเลือกไม่ได้ เช่น สายรองช่อง 2 ที่ช่อง 1 ยังว่าง)
export function requiredTier(rows: readonly SelRow[], byId: ById, type: SelectionType, slot: number, treeId: string): number | null {
  if (type === "primary") return slot;
  if (slot === 1) return 1;
  const t1 = treeAt(rows, byId, "secondary", 1);
  if (!t1) return null;
  return t1 === treeId ? 2 : 1;
}

// ช่องนี้เปิดให้เลือกได้หรือยัง (สายรองช่อง 2 ต้องเลือกช่อง 1 ก่อน)
export function slotAvailable(rows: readonly SelRow[], byId: ById, type: SelectionType, slot: number): Check {
  if (slot < 1 || slot > slotsOf(type)) return no("ไม่มีช่องนี้");
  if (type === "secondary" && slot === 2 && !treeAt(rows, byId, "secondary", 1)) return no("เลือกช่อง 1 ของสายรองก่อน");
  return ok;
}

// ปัญหาใหม่ที่เกิดจากการเปลี่ยนชุด `next` เมื่อเทียบกับชุดเดิม `prev` (ไม่โทษปัญหาเก่าที่มีอยู่แล้ว)
const newProblem = (prev: readonly SelRow[], next: readonly SelRow[], byId: ById): string | null => {
  const before = new Set(validateSelection(prev, byId));
  return validateSelection(next, byId).find((p) => !before.has(p)) ?? null;
};

// เลือก `cand` ลงช่อง `slot` ของสาย `type` ได้หรือไม่ (ถ้าช่องนั้นมีของเดิมอยู่ = แทนที่)
// คืนเหตุผลภาษาไทยเมื่อไม่ได้ เพื่อแสดงให้แอดมินเห็นว่าทำไมตัวเลือกถูกปิด
export function canPick(rows: readonly SelRow[], byId: ById, type: SelectionType, slot: number, cand: EnchOpt): Check {
  if (!isPickable(cand)) return no("พลังแฝงนี้ยังไม่เปิดใช้ในเกมจริง (inactive / Test Server)");
  const avail = slotAvailable(rows, byId, type, slot);
  if (!avail.ok) return avail;
  const rest = rows.filter((r) => !(r.selection_type === type && r.sort_order === slot));
  const next: SelRow[] = [...rest, { enchantment_id: cand.id, selection_type: type, sort_order: slot }];
  const problem = newProblem(rest, next, byId);
  return problem ? no(problem) : ok;
}

// เอาพลังแฝงออกจากช่องนี้ได้หรือไม่ (สายรอง: ลบช่อง 1 ไม่ได้ถ้าช่อง 2 ยังมีอยู่ ต้องลบช่อง 2 ก่อน)
export function canRemove(rows: readonly SelRow[], byId: ById, type: SelectionType, slot: number): Check {
  if (!rowAt(rows, type, slot)) return ok;
  if (type === "secondary" && slot === 1 && rowAt(rows, "secondary", 2)) return no("ลบช่อง 2 ของสายรองก่อน แล้วค่อยลบช่อง 1");
  return ok;
}

export type TreeChoice = { treeId: string; check: Check };

// สี (สาย) ที่กดเลือกได้ที่ไอคอนสีของช่องนั้น — ตัวที่เลือกไม่ได้มี check.reason บอกเหตุผล
// สายหลัก: เลือกได้ทุกสี ยกเว้นสีที่ถูกใช้เป็นสายรองอยู่ (เปลี่ยนสีจะล้างพลังแฝงสายหลักที่เลือกไว้ ให้หน้าจอถามยืนยันเอง)
// สายรอง : ห้ามสีเดียวกับสายหลัก; สีของช่อง 1 เปลี่ยนไม่ได้ขณะที่ช่อง 2 มีอยู่ (ต้องลบช่อง 2 ก่อน)
export function treeChoices(rows: readonly SelRow[], byId: ById, treeIds: readonly string[], type: SelectionType, slot: number): TreeChoice[] {
  const avail = slotAvailable(rows, byId, type, slot);
  const pTree = primaryTree(rows, byId);
  const own = treeAt(rows, byId, type, slot);
  const secondaryTrees = new Set(rows.filter((r) => r.selection_type === "secondary").map((r) => byId.get(r.enchantment_id)?.treeId));
  return treeIds.map((treeId) => {
    if (!avail.ok) return { treeId, check: avail };
    if (type === "primary") {
      if (treeId !== pTree && secondaryTrees.has(treeId)) return { treeId, check: no("สีนี้ถูกใช้เป็นสายรองอยู่ ลบสายรองสีนั้นก่อน") };
      return { treeId, check: ok };
    }
    if (pTree && treeId === pTree) return { treeId, check: no("เป็นสีของสายหลักอยู่แล้ว") };
    if (slot === 1 && rowAt(rows, "secondary", 2) && own && treeId !== own) return { treeId, check: no("ลบช่อง 2 ของสายรองก่อน จึงจะเปลี่ยนสีช่อง 1 ได้") };
    return { treeId, check: ok };
  });
}

// พลังแฝงของสี `treeId` ที่ใส่ช่องนี้ได้ (Tier ตรงกับที่ช่องต้องการ) พร้อมเหตุผลของตัวที่เลือกไม่ได้
export function pickerOptions(
  rows: readonly SelRow[],
  byId: ById,
  all: readonly EnchOpt[],
  type: SelectionType,
  slot: number,
  treeId: string
): { opt: EnchOpt; check: Check }[] {
  const tier = requiredTier(rows, byId, type, slot, treeId);
  if (tier == null) return [];
  return all.filter((o) => o.treeId === treeId && o.tier === tier).map((opt) => ({ opt, check: canPick(rows, byId, type, slot, opt) }));
}
