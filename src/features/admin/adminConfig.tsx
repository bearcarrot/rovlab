/* eslint-disable @typescript-eslint/no-explicit-any */
import { ITEM_TYPE_CHOICES } from "@/features/build/buildView";
import { supabase } from "@/lib/supabase";

// ใช้ client แบบ untyped เพราะตารางถูกกำหนดแบบ config ด้านล่าง
export const db: any = supabase;

export type Row = Record<string, any>;
export type RefType = "hero" | "item" | "rune" | "patch" | "guideCat";
// icon = ไอคอนของรายการที่เลือก (แสดงบนการ์ดและข้างช่องเลือก)
// alt = ชื่อสำรองไว้ใช้ค้นหา (เช่น ชื่อไทยของฮีโร่) ไม่ได้แสดงบนหน้าจอ
// roles / lanes = ตำแหน่งและเลนของฮีโร่ ใช้กับชิปกรองในแท็บสถิติ/Tier List
// tagType = รหัสแท็กของเกม (เฉพาะรายการแท็กสกิล ใช้ตอนเพิ่มแท็กให้สกิล)
export type RefOpt = {
  id: string;
  label: string;
  color?: string;
  icon?: string;
  alt?: string;
  roles?: string[];
  lanes?: string[];
  // ไอเทม: ใช้แสดงในกริดเลือกไอเทมแบบร้านค้าในเกม (ค่าจากคอลัมน์ items เดิม ไม่มีฟิลด์ใหม่)
  tier?: number;
  cost?: number;
  tags?: string[];
  stat?: string;
  tagType?: number;
};
// text | num | date | sel(เลือกจาก opts) | hero/item/rune/patch/guideCat(เลือกจากตารางอื่น)
// | area(ข้อความยาว) | arr(หลายค่าคั่นด้วย ,) | img(รูป: วาง URL หรืออัปโหลดไฟล์)
// | multi(เลือกได้หลายค่าจาก opts แบบปุ่ม ค่าแรก = ตัวหลัก)
// | choice(ปุ่มชิปจาก choices ค่าเดียว หรือหลายค่าถ้า multiChoice แตะซ้ำเพื่อเอาออก) | tags(แท็กสกิล: jsonb [{type,name}] แตะเลือกจากรายการในแท็บ "แท็กและสี") | color(สี hex)
export type Col = {
  k: string;
  label?: string;
  type?: "text" | "num" | "date" | "sel" | "area" | "arr" | "img" | "multi" | "choice" | "tags" | "color" | RefType;
  // multi: รายการสำรองใช้เมื่อยังโหลด hero_roles / hero_lanes ไม่ได้ (ปกติรหัส/ชื่อ/ไอคอน/ลำดับมาจาก DB)
  opts?: string[];
  // choice: รายการ {ค่าที่บันทึก, ชื่อที่แสดง}; multiChoice = คอลัมน์อาร์เรย์เลือกได้หลายค่า; num = แปลงเป็นตัวเลขก่อนบันทึก
  choices?: { value: string; label: string }[];
  multiChoice?: boolean;
  num?: boolean;
  // แสดงอย่างเดียว แก้ไม่ได้ (เช่น รหัสตำแหน่งที่ผูกกับ CHECK ใน DB)
  ro?: boolean;
  // คอลัมน์ NOT NULL ใน DB: เว้นว่าง = บันทึกเป็น "" แทน null
  blank?: boolean;
  // รูปแบบวงกลม (border-radius 50%) ใช้กับไอคอนสกิลและรูน
  round?: boolean;
  // ขอบสีทอง 1px รอบรูป (ใช้กับไอคอนสกิล)
  gold?: boolean;
};
export type Labels = { role: (code: string) => string; lane: (code: string) => string };
export type FilterCfg = {
  col: string;
  table: string;
  sel: string;
  order?: string;
  label: (r: Row, labels?: Labels) => string;
  // ไอคอนที่โชว์ใน dropdown ตัวกรอง (เช่น ไอคอนฮีโร่)
  icon?: (r: Row) => string | undefined;
  // เลือก "ลิสต์" ของ Tier List จาก 3 ตัวเลือกแยกกัน แทน dropdown เดียว:
  // แรงก์ = ชิป, แพตช์ = dropdown (ทุกแพตช์ในตาราง patches แม้ยังไม่มีลิสต์), เลน = ชิป (ทุกเลน = ลิสต์ที่ lane เป็น null)
  // ถ้ายังไม่มีลิสต์ของชุดที่เลือก มีปุ่มสร้างให้ ต้องมีคอลัมน์ rank_tier / patch_id / lane ใน sel
  tierList?: { ranks: { value: string; label: string }[] };
};
export type Cfg = {
  label: string;
  table: string;
  order?: string;
  asc?: boolean;
  add?: boolean;
  // ซ่อนปุ่มลบ (แถวอ้างอิงคงที่ เช่น ตำแหน่ง/เลน) กันลบแล้วเพิ่มกลับไม่ได้
  noDelete?: boolean;
  search?: string;
  // ค้นหา + เรียงตามชื่อฝั่งเบราว์เซอร์ ใช้กับตารางที่ชื่อฮีโร่มาจากการอ้างอิง (ไม่ใช่คอลัมน์ในตาราง)
  // ค้นได้ทั้งชื่ออังกฤษ/ไทย และพิมพ์ไม่ต้องใส่ช่องว่าง/เครื่องหมายก็เจอ (เช่น "azzenka" = Azzen'Ka)
  clientSearch?: boolean;
  // ค้นหาคอลัมน์อื่นด้วยพร้อมกับ search (เช่น ชื่อไทยของฮีโร่) ใช้ OR
  searchAlso?: string[];
  // ชิปกรองฮีโร่ (ค่าที่เลือกจำไว้ตามแท็บ รีเฟรชแล้วไม่หาย)
  // true = ตำแหน่ง + เลน, "role" = เฉพาะตำแหน่ง (แท็บที่เลนถูกใช้เลือกลิสต์ไปแล้ว)
  heroChips?: boolean | "role";
  // ชิปกรองแรงก์จากคอลัมน์ rank_tier ของแถวเอง (สถิติฮีโร่): กรองรายการ และใช้เป็นค่าเริ่มต้นตอนเพิ่มแถวใหม่
  rankChips?: { value: string; label: string }[];
  cols: Col[];
  // แสดงสรุปจำนวนช่องรูนต่อสี (แดง/ม่วง/เขียว สีละไม่เกิน 10) ใช้กับแท็บรูนในบิลด์
  slots?: boolean;
  // มุมมองแบบช่อง (เหมือน TeamSlots ใน Draft Assistant) เหนือรายการการ์ด: items = ไอเทมตามช่วงเกม, rune = ช่องรูน 3 สี
  slotsView?: "items" | "rune";
  // ตัวกรองด้านบน (เช่น เลือกฮีโร่/แพตช์/บิลด์) และตอนเพิ่มแถวจะใส่ค่านี้ให้อัตโนมัติ
  filter?: FilterCfg;
};

export const TIERS = ["S+", "S", "A", "B", "C"];
export const SOURCES = ["curated", "heuristic"];
export const REF_TYPES: string[] = ["hero", "item", "rune", "patch", "guideCat"];
// แรงก์ที่ใช้ใน DB (hero_stats.rank_tier / tier_lists.rank_tier): all = ทั้งหมด, high = Commander ขึ้นไป — ชุดเดียวกันทั้งแท็บสถิติและ Tier List
export const RANK_CHIPS = [
  { value: "all", label: "ทั้งหมด" },
  { value: "high", label: "Commander+" },
];
// แท็บสถิติเท่านั้นมีชิป Pro: สถิติ Pro นำเข้าจาก Liquipedia และตัด Tier อัตโนมัติ จึงไม่มี Tier List ที่แอดมินจัดเอง (ไม่ใส่ใน RANK_CHIPS)
// ใช้แก้/เติมแถวของฮีโร่ที่ชื่อบน Liquipedia ไม่ตรงกับ DB — ค่าที่แก้มือถูกทับเมื่อนำเข้า Pro ใหม่
export const STAT_RANK_CHIPS = [...RANK_CHIPS, { value: "pro", label: "Pro" }];
// ตารางสีแท็กสกิล: แก้แล้วต้องล้างแคชสีที่หน้าเว็บโหลดไว้
export const TAG_STYLES_TABLE = "effect_tag_styles";
// หน้ารูนในเกมมี 30 ช่อง = แดง 10 + ม่วง 10 + เขียว 10
export const MAX_SLOTS = 10;
export const SLOT_COLORS = [
  { k: "red", label: "แดง", hex: "#ef4444" },
  { k: "purple", label: "ม่วง", hex: "#a855f7" },
  { k: "green", label: "เขียว", hex: "#22c55e" },
] as const;
export const DIFFICULTY_TH: Record<string, string> = { easy: "ง่าย", medium: "ปานกลาง", hard: "ยาก" };
// ไอเทม: ระดับ (items.tier = 1–3) และประเภท (ค่าใน items.role_tags เลือกได้หลายประเภทต่อไอเทม) — ใช้ทั้งชิปกรองและช่องแก้ไข
export const ITEM_TIER_CHOICES = [
  { value: "1", label: "T1" },
  { value: "2", label: "T2" },
  { value: "3", label: "T3" },
];
// "none" = ยังไม่ได้ใส่ tier (ไอเทมเดิมยังไม่มีค่า) ช่วยให้ไล่ใส่ให้ครบ
export const ITEM_TIER_FILTERS = [...ITEM_TIER_CHOICES, { value: "none", label: "ยังไม่ระบุ" }];
export const ITEM_TYPE_LABEL: Record<string, string> = Object.fromEntries(ITEM_TYPE_CHOICES.map((o) => [o.value, o.label]));
// ไอคอนสกิลและรูนเป็นวงกลม ส่วนฮีโร่/ไอเทมเป็นสี่เหลี่ยมมุมมน
export const ROUND = "rounded-[50%]";
// แอดมินเลือกฮีโร่ด้วยชื่ออังกฤษ (ตรงกับเกม) ใช้ชื่อไทยเป็นตัวสำรองเท่านั้น
export const heroName = (r?: Row) => r?.name || r?.name_th || "?";
export const heroFilter = (col: string): FilterCfg => ({
  col,
  table: "heroes",
  sel: "id,name,name_th,icon_url",
  order: "name",
  label: (r) => heroName(r),
  icon: (r) => r.icon_url ?? undefined,
});
// ตัวเลือกบิลด์ (ใช้กับแท็บไอเทมในบิลด์และรูนในบิลด์)
export const buildFilter: FilterCfg = {
  col: "build_id",
  table: "item_builds",
  sel: "id,source,heroes(name,name_th,icon_url),patches(code),rune(name)",
  label: (r) => `${heroName(r.heroes)} · ${r.patches?.code ?? "?"} · ${r.source}`,
  icon: (r) => r.heroes?.icon_url ?? undefined,
};

export const CFG: Record<string, Cfg> = {
  heroes: {
    label: "ฮีโร่",
    table: "heroes",
    order: "name",
    add: true,
    search: "name",
    heroChips: true,
    searchAlso: ["name_th"],
    cols: [
      { k: "slug" },
      { k: "name" },
      { k: "name_th" },
      // แตะเลือกได้หลายตัว ตัวแรกที่เลือก (★) = ตำแหน่ง/เลนหลัก ระบบซิงค์ไปที่คอลัมน์ role / lane ให้เอง
      // ชื่อ/ไอคอน/ลำดับของปุ่มมาจาก hero_roles / hero_lanes (ดู MultiPicker) — opts คือรายการสำรองเท่านั้น
      { k: "roles", label: "ตำแหน่ง (เลือกได้หลายตัว · ★ = ตัวหลัก)", type: "multi", opts: ["assassin", "fighter", "mage", "carry", "support", "tank"] },
      { k: "lanes", label: "เลน (เลือกได้หลายตัว · ★ = ตัวหลัก)", type: "multi", opts: ["slayer", "jungle", "mid", "abyssal", "roaming"] },
      { k: "difficulty", type: "sel", opts: ["easy", "medium", "hard"] },
      { k: "icon_url", label: "ไอคอน", type: "img" },
      { k: "description", type: "area" },
      { k: "strengths", type: "arr" },
      { k: "weaknesses", type: "arr" },
    ],
  },
  // ชื่อ ไอคอน และลำดับของตำแหน่ง/เลน (ทุกหน้าใช้ชุดเดียวกันจาก DB) ว่าง = แสดงเฉพาะข้อความ
  // รหัส (code) แก้ไม่ได้: ถูกอ้างจากฮีโร่ / สถิติ / Tier / ตัวกรอง
  roleIcons: {
    label: "ตำแหน่ง",
    table: "hero_roles",
    order: "sort_order",
    noDelete: true,
    cols: [
      { k: "label", label: "ชื่อที่แสดง" },
      { k: "code", label: "รหัส (แก้ไม่ได้)", ro: true },
      { k: "icon_url", label: "ไอคอน (เว้นว่าง = แสดงเฉพาะข้อความ)", type: "img" },
      { k: "sort_order", label: "ลำดับ (เล็ก = แสดงก่อน)", type: "num" },
    ],
  },
  laneIcons: {
    label: "เลน",
    table: "hero_lanes",
    order: "sort_order",
    noDelete: true,
    cols: [
      { k: "label", label: "ชื่อที่แสดง" },
      { k: "code", label: "รหัส (แก้ไม่ได้)", ro: true },
      { k: "icon_url", label: "ไอคอน (เว้นว่าง = แสดงเฉพาะข้อความ)", type: "img" },
      { k: "sort_order", label: "ลำดับ (เล็ก = แสดงก่อน)", type: "num" },
    ],
  },
  abilities: {
    label: "สกิล",
    table: "hero_abilities",
    order: "sort_order",
    add: true,
    filter: heroFilter("hero_id"),
    cols: [
      { k: "slot" },
      { k: "name" },
      { k: "icon_url", label: "ไอคอน", type: "img", round: true, gold: true },
      { k: "description", type: "area" },
      // แตะเพื่อเปิด/ปิดแท็กของสกิล (บันทึกทันที) รายการแท็กและสีจัดการที่แท็บ "แท็กและสี"
      { k: "effect_tags", label: "แท็กสกิล (แตะเพื่อเปิด/ปิด)", type: "tags" },
      { k: "sort_order", type: "num" },
    ],
  },
  // รายการแท็กสกิลทั้งหมด + สีป้าย (ใช้ทั้งหน้าฮีโร่ และเป็นตัวเลือกในแท็บ "สกิล")
  effectTags: {
    label: "แท็กและสี",
    table: TAG_STYLES_TABLE,
    order: "tag_type",
    add: true,
    search: "name",
    cols: [
      { k: "name", label: "ชื่อแท็ก (ต้องตรงกับที่ใช้ในสกิล)" },
      { k: "color", label: "สีป้าย", type: "color" },
      { k: "tag_type", label: "รหัสแท็กในเกม (type)", type: "num" },
    ],
  },
  counters: {
    label: "เคาน์เตอร์",
    table: "hero_counters",
    add: true,
    filter: heroFilter("hero_id"),
    cols: [
      { k: "counter_hero_id", label: "ฮีโร่ที่ชนะทาง", type: "hero" },
      { k: "strength", type: "sel", opts: ["best", "good", "situational"] },
      { k: "reason", type: "area" },
      { k: "lane_tip", type: "area" },
    ],
  },
  synergies: {
    label: "ซินเนอร์จี้",
    table: "hero_synergies",
    add: true,
    filter: heroFilter("hero_id"),
    cols: [{ k: "partner_hero_id", label: "คู่หู", type: "hero" }, { k: "reason", type: "area" }],
  },
  matchups: {
    label: "Matchup",
    table: "matchups",
    add: true,
    filter: heroFilter("hero_a_id"),
    cols: [
      { k: "hero_b_id", label: "กับฮีโร่", type: "hero" },
      { k: "lane" },
      { k: "difficulty", type: "sel", opts: ["ง่าย", "ปานกลาง", "ยาก"] },
      { k: "early", type: "area" },
      { k: "mid", type: "area" },
      { k: "late", type: "area" },
      { k: "win_condition", type: "area" },
      { k: "tips", type: "area" },
      { k: "source", type: "sel", opts: SOURCES },
    ],
  },
  items: {
    label: "ไอเทม",
    table: "items",
    order: "name",
    add: true,
    search: "name",
    cols: [
      { k: "slug" },
      { k: "name" },
      { k: "name_th" },
      { k: "cost", type: "num" },
      // ระดับ T1–T3 (ว่าง = ยังไม่ระบุ แตะซ้ำที่ปุ่มที่เลือกอยู่เพื่อเอาออก) และประเภท (เก็บในคอลัมน์ role_tags เดิม)
      { k: "tier", label: "ระดับ (Tier)", type: "choice", choices: ITEM_TIER_CHOICES, num: true },
      { k: "role_tags", label: "ประเภท (เลือกได้หลายตัว)", type: "choice", choices: ITEM_TYPE_CHOICES, multiChoice: true },
      { k: "stats", type: "arr" },
      { k: "passive", type: "area" },
      { k: "icon_url", label: "ไอคอน", type: "img" },
    ],
  },
  rune: {
    label: "รูน",
    table: "rune",
    order: "name",
    add: true,
    cols: [
      { k: "name" },
      { k: "color", label: "สี", type: "sel", opts: ["", "red", "purple", "green"] },
      { k: "icon_url", label: "ไอคอน", type: "img", round: true },
      { k: "description", type: "area" },
    ],
  },
  builds: {
    label: "บิลด์",
    table: "item_builds",
    add: true,
    filter: heroFilter("hero_id"),
    cols: [
      { k: "patch_id", label: "แพตช์", type: "patch" },
      { k: "source", type: "sel", opts: SOURCES },
      { k: "rune_id", label: "รูนชุดเดียว (แบบเดิม)", type: "rune" },
    ],
  },
  buildItems: {
    label: "ไอเทมในบิลด์",
    table: "item_build_items",
    order: "sort_order",
    add: true,
    slotsView: "items",
    filter: buildFilter,
    cols: [
      { k: "item_id", label: "ไอเทม", type: "item" },
      { k: "phase", type: "sel", opts: ["early", "core", "situational"] },
      // reason เป็น NOT NULL ใน DB — เว้นว่างได้ จะบันทึกเป็น "" (blank)
      { k: "reason", type: "area", blank: true },
      { k: "sort_order", type: "num" },
    ],
  },
  buildRune: {
    label: "รูนในบิลด์",
    table: "item_build_rune",
    order: "sort_order",
    add: true,
    slots: true,
    slotsView: "rune",
    filter: buildFilter,
    cols: [
      { k: "rune_id", label: "รูน", type: "rune" },
      { k: "quantity", label: "จำนวน (x)", type: "num" },
      { k: "reason", type: "area" },
      { k: "sort_order", type: "num" },
    ],
  },
  stats: {
    label: "สถิติ",
    table: "hero_stats",
    add: true,
    clientSearch: true,
    heroChips: true,
    // ชิปแรงก์ (ทั้งหมด / Commander+ / Pro) กรองแถวสถิติตาม rank_tier และใช้เป็นค่าตอนเพิ่มแถวใหม่ (Tier List มีแค่ทั้งหมด / Commander+)
    rankChips: STAT_RANK_CHIPS,
    cols: [
      { k: "hero_id", label: "ฮีโร่", type: "hero" },
      { k: "rank_tier" },
      { k: "win_rate", type: "num" },
      { k: "pick_rate", type: "num" },
      { k: "ban_rate", type: "num" },
      { k: "tier", type: "sel", opts: TIERS },
      { k: "matches", type: "num" },
    ],
    filter: { col: "patch_id", table: "patches", sel: "id,code", label: (r) => r.code },
  },
  tiers: {
    label: "Tier List",
    table: "tier_list_entries",
    add: true,
    clientSearch: true,
    // เลนใช้เลือกลิสต์ (ชิปเลนด้านบน) จึงเหลือชิปกรองตำแหน่งอย่างเดียว
    heroChips: "role",
    cols: [
      { k: "hero_id", label: "ฮีโร่", type: "hero" },
      { k: "tier", type: "sel", opts: TIERS },
      { k: "reason", type: "area" },
    ],
    filter: {
      col: "tier_list_id",
      table: "tier_lists",
      sel: "id,rank_tier,lane,patch_id,patches(code)",
      label: (r, labels) =>
        `${r.patches?.code ?? "?"} · ${r.lane ? (labels?.lane(r.lane) ?? r.lane) : "ทุกเลน"}`,
      tierList: { ranks: RANK_CHIPS },
    },
  },
  // แต้มช่วงเกม (ต้น/กลาง/เลท 1-10) ต่อฮีโร่ต่อเลน — Draft Assistant ใช้คำนวณมิเตอร์ช่วงเกมของทีม
  // ฮีโร่/เลนที่ไม่มีแถว = แอปประเมินจาก Role (หน้าเว็บคนทั่วไปจะเห็นค่าใหม่หลังแคชสูงสุด 5 นาที)
  phase: {
    label: "ช่วงเกม",
    table: "hero_phase_points",
    add: true,
    filter: heroFilter("hero_id"),
    cols: [
      { k: "lane", label: "เลน", type: "sel", opts: ["slayer", "jungle", "mid", "abyssal", "roaming"] },
      { k: "early", label: "ต้นเกม (1-10)", type: "num" },
      { k: "mid", label: "กลางเกม (1-10)", type: "num" },
      { k: "late", label: "เลทเกม (1-10)", type: "num" },
    ],
  },
  patches: {
    label: "แพตช์",
    table: "patches",
    order: "released_at",
    asc: false,
    add: true,
    cols: [{ k: "code" }, { k: "released_at", type: "date" }, { k: "notes", type: "array" === "x" ? "text" : "area" }],
  },
  guides: {
    label: "คู่มือ",
    table: "guides",
    // เรียงตามลำดับที่แสดงบนเว็บ (sort_id เล็ก = ก่อน)
    order: "sort_id",
    asc: true,
    add: true,
    cols: [
      { k: "slug" },
      { k: "title" },
      // เลือกหมวดจากแท็บ "หมวดคู่มือ" เว้นว่าง = ยังไม่จัดหมวด (หน้าคู่มือจะแสดงเฉพาะใน "ทั้งหมด")
      { k: "category_id", label: "หมวดหมู่", type: "guideCat" },
      { k: "cover_url", label: "รูปปก", type: "img" },
      { k: "difficulty", type: "sel", opts: ["", "easy", "medium", "hard"] },
      { k: "reading_minutes", type: "num" },
      // ตัวเลขน้อย = แสดงก่อน ค่าเริ่มต้น 0 เท่ากันทุกเล่ม = เรียงตามระดับความยาก (ง่าย → ยาก)
      { k: "sort_id", label: "ลำดับ (เล็ก = แสดงก่อน)", type: "num" },
      { k: "content", type: "area" },
    ],
  },
  guideCats: {
    label: "หมวดคู่มือ",
    table: "guide_categories",
    order: "sort_id",
    asc: true,
    add: true,
    cols: [
      { k: "slug" },
      { k: "name_th" },
      { k: "sort_id", label: "ลำดับ (เล็ก = แสดงก่อน)", type: "num" },
    ],
  },
};
