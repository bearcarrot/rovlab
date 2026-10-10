/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ChevronDown, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { useIsAdmin } from "@/features/auth/useIsAdmin";
import { Chip, LANE_OPTIONS, LaneFilterRow, ROLE_OPTIONS, RoleFilterRow, useFilterIcons, useFilterLabels } from "@/features/heroes/HeroFilters";
import { ImageSelect } from "@/features/admin/ImageSelect";
import { RuneSlots, ItemSlots, type RowMove } from "@/features/admin/BuildSlots";
import { BuildSpellEditor } from "@/features/admin/BuildSpellEditor";
import { BuildEnchantmentEditor } from "@/features/admin/BuildEnchantmentEditor";
import { usePersistedState } from "@/hooks/usePersistedState";
import { supabase } from "@/lib/supabase";
import { EFFECT_COLOR_PRESETS, safeHex, tagColor, tagNames } from "@/lib/effectTags";
import { clearFilterIconsCache, sortByOrder } from "@/services/filterIcons";
import { clearEffectTagStylesCache } from "@/services/effectTagStyles";
import { useToast } from "@/components/ui/toast";
import type { HeroLane, HeroRole } from "@/types/hero";

// ใช้ client แบบ untyped เพราะตารางถูกกำหนดแบบ config ด้านล่าง
const db: any = supabase;

type Row = Record<string, any>;
type RefType = "hero" | "item" | "rune" | "patch" | "guideCat";
// icon = ไอคอนของรายการที่เลือก (แสดงบนการ์ดและข้างช่องเลือก)
// alt = ชื่อสำรองไว้ใช้ค้นหา (เช่น ชื่อไทยของฮีโร่) ไม่ได้แสดงบนหน้าจอ
// roles / lanes = ตำแหน่งและเลนของฮีโร่ ใช้กับชิปกรองในแท็บสถิติ/Tier List
// tagType = รหัสแท็กของเกม (เฉพาะรายการแท็กสกิล ใช้ตอนเพิ่มแท็กให้สกิล)
type RefOpt = {
  id: string;
  label: string;
  color?: string;
  icon?: string;
  alt?: string;
  roles?: string[];
  lanes?: string[];
  tagType?: number;
};
// text | num | date | sel(เลือกจาก opts) | hero/item/rune/patch/guideCat(เลือกจากตารางอื่น)
// | area(ข้อความยาว) | arr(หลายค่าคั่นด้วย ,) | img(รูป: วาง URL หรืออัปโหลดไฟล์)
// | multi(เลือกได้หลายค่าจาก opts แบบปุ่ม ค่าแรก = ตัวหลัก)
// | choice(ปุ่มชิปจาก choices ค่าเดียว หรือหลายค่าถ้า multiChoice แตะซ้ำเพื่อเอาออก)
// | tags(แท็กสกิล: jsonb [{type,name}] แตะเลือกจากรายการในแท็บ "แท็กและสี") | color(สี hex)
type Col = {
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
  // รูปแบบวงกลม (border-radius 50%) ใช้กับไอคอนสกิลและรูน
  round?: boolean;
  // ขอบสีทอง 1px รอบรูป (ใช้กับไอคอนสกิล)
  gold?: boolean;
};
type Labels = { role: (code: string) => string; lane: (code: string) => string };
type FilterCfg = {
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
type Cfg = {
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

const TIERS = ["S+", "S", "A", "B", "C"];
const SOURCES = ["curated", "heuristic"];
const REF_TYPES: string[] = ["hero", "item", "rune", "patch", "guideCat"];
const BUCKET = "hero-icons";
// แรงก์ที่ใช้ใน DB (hero_stats.rank_tier / tier_lists.rank_tier): all = ทั้งหมด, high = Commander ขึ้นไป — ชุดเดียวกันทั้งแท็บสถิติและ Tier List
const RANK_CHIPS = [
  { value: "all", label: "ทั้งหมด" },
  { value: "high", label: "Commander+" },
];
// ตารางสีแท็กสกิล: แก้แล้วต้องล้างแคชสีที่หน้าเว็บโหลดไว้
const TAG_STYLES_TABLE = "effect_tag_styles";
// หน้ารูนในเกมมี 30 ช่อง = แดง 10 + ม่วง 10 + เขียว 10
const MAX_SLOTS = 10;
const SLOT_COLORS = [
  { k: "red", label: "แดง", hex: "#ef4444" },
  { k: "purple", label: "ม่วง", hex: "#a855f7" },
  { k: "green", label: "เขียว", hex: "#22c55e" },
] as const;
const DIFFICULTY_TH: Record<string, string> = { easy: "ง่าย", medium: "ปานกลาง", hard: "ยาก" };
// ไอเทม: ระดับ (items.tier = 1–3) และประเภท (ค่าใน items.role_tags เลือกได้หลายประเภทต่อไอเทม) — ใช้ทั้งชิปกรองและช่องแก้ไข
const ITEM_TIER_CHOICES = [
  { value: "1", label: "T1" },
  { value: "2", label: "T2" },
  { value: "3", label: "T3" },
];
// "none" = ยังไม่ได้ใส่ tier (ไอเทมเดิมยังไม่มีค่า) ช่วยให้ไล่ใส่ให้ครบ
const ITEM_TIER_FILTERS = [...ITEM_TIER_CHOICES, { value: "none", label: "ยังไม่ระบุ" }];
const ITEM_TYPE_CHOICES = [
  { value: "physical", label: "โจมตี" },
  { value: "magic", label: "เวท" },
  { value: "defense", label: "ป้องกัน" },
  { value: "boots", label: "เคลื่อนที่" },
  { value: "jungle", label: "ป่า" },
  { value: "support", label: "ซัพพอร์ต" },
];
const ITEM_TYPE_LABEL: Record<string, string> = Object.fromEntries(ITEM_TYPE_CHOICES.map((o) => [o.value, o.label]));
// ไอคอนสกิลและรูนเป็นวงกลม ส่วนฮีโร่/ไอเทมเป็นสี่เหลี่ยมมุมมน
const ROUND = "rounded-[50%]";
// แอดมินเลือกฮีโร่ด้วยชื่ออังกฤษ (ตรงกับเกม) ใช้ชื่อไทยเป็นตัวสำรองเท่านั้น
const heroName = (r?: Row) => r?.name || r?.name_th || "?";
const heroFilter = (col: string): FilterCfg => ({
  col,
  table: "heroes",
  sel: "id,name,name_th,icon_url",
  order: "name",
  label: (r) => heroName(r),
  icon: (r) => r.icon_url ?? undefined,
});
// ตัวเลือกบิลด์ (ใช้กับแท็บไอเทมในบิลด์และรูนในบิลด์)
const buildFilter: FilterCfg = {
  col: "build_id",
  table: "item_builds",
  sel: "id,source,heroes(name,name_th,icon_url),patches(code),rune(name)",
  label: (r) => `${heroName(r.heroes)} · ${r.patches?.code ?? "?"} · ${r.source}`,
  icon: (r) => r.heroes?.icon_url ?? undefined,
};

const CFG: Record<string, Cfg> = {
  heroes: {
    label: "ฮีโร่",
    table: "heroes",
    order: "name",
    add: true,
    search: "name",
    heroChips: true,
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
    label: "ตำแหน่ง (Role)",
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
    label: "เลน (Lane)",
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
      { k: "reason", type: "area" },
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
    // ชิปแรงก์ (ทั้งหมด / Commander+) เหมือนแท็บ Tier List: กรองแถวสถิติตาม rank_tier และใช้เป็นค่าตอนเพิ่มแถวใหม่
    rankChips: RANK_CHIPS,
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
  patches: {
    label: "แพตช์",
    table: "patches",
    order: "released_at",
    asc: false,
    add: true,
    cols: [{ k: "code" }, { k: "released_at", type: "date" }, { k: "notes", type: "area" }],
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

// ---------- UI primitives ----------

// ช่องกรอกทุกชนิดสูงเท่ากัน (h-11) และใช้ text-base บนมือถือเพื่อไม่ให้ iOS ซูมเอง
const ctl =
  "block w-full rounded-lg border border-border bg-bg-raised px-3 text-base text-text outline-none transition " +
  "placeholder:text-text-faint focus:border-accent focus:ring-1 focus:ring-accent sm:text-sm";
const inp = `${ctl} h-11`;
const area = `${ctl} min-h-[96px] resize-y py-2.5 leading-relaxed`;

const BTN_BASE =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium " +
  "transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-accent/60";
const BTN_VARIANT = {
  primary: "bg-accent text-accent-fg hover:brightness-110",
  secondary: "border border-border bg-bg-raised text-text hover:border-text-faint",
  danger: "border border-loss/40 bg-loss/10 text-loss hover:bg-loss/20",
  dangerSolid: "bg-loss text-white hover:brightness-110",
} as const;

function Btn({
  variant = "secondary",
  className = "",
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BTN_VARIANT }) {
  return <button type="button" {...p} className={`${BTN_BASE} ${BTN_VARIANT[variant]} ${className}`} />;
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <span className="mb-1.5 block text-xs font-medium text-text-muted">{label}</span>
      {children}
    </div>
  );
}

// ฟอร์มแก้ไข/เพิ่ม: จอ ≥ sm จัดช่องสั้นเป็น 2 คอลัมน์ ช่องยาว (ข้อความหลายบรรทัด ปุ่มหลายตัว รูป ลิสต์) เต็มความกว้าง
const fieldGrid = "grid gap-3 sm:grid-cols-2";
const fieldSpan = (c: Col) =>
  c.type === "area" ||
  c.type === "multi" ||
  c.type === "choice" ||
  c.type === "img" ||
  c.type === "arr" ||
  c.type === "tags" ||
  c.type === "color"
    ? "sm:col-span-2"
    : "";

// ---------- helpers ----------

const toArr = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.map(String)
    : String(v ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
const isArrCol = (c: Col) => c.type === "arr" || c.type === "multi" || (c.type === "choice" && !!c.multiChoice);
const norm = (c: Col, v: unknown) =>
  c.type === "tags" ? tagNames(v).join("|") : isArrCol(c) ? toArr(v).join("|") : String(v ?? "");
// refs / prev ใช้กับช่องแท็ก: หา type ของแท็กจากรายการแท็ก และคง type เดิมของแท็กที่สกิลมีอยู่แล้ว (แท็กชื่อซ้ำบางตัวมีหลาย type)
const clean = (c: Col, v: unknown, refs?: Record<string, RefOpt[]>, prev?: unknown) => {
  if (c.type === "tags") {
    const typeOf = new Map<string, number>();
    for (const o of refs?.effectTag ?? []) if (o.tagType != null) typeOf.set(o.label, o.tagType);
    if (Array.isArray(prev)) {
      for (const t of prev) {
        const name = t && typeof t === "object" ? String((t as any).name ?? "") : "";
        const type = Number((t as any)?.type);
        if (name && Number.isFinite(type)) typeOf.set(name, type);
      }
    }
    return tagNames(v).map((name) => ({ type: typeOf.get(name) ?? 0, name }));
  }
  return isArrCol(c) ? toArr(v) : v === "" || v == null ? null : c.type === "num" || c.num ? Number(v) : v;
};

const show = (c: Col, v: any, refs: Record<string, RefOpt[]>) => {
  if (v == null || v === "" || c.type === "img") return "";
  if (c.type === "tags") return tagNames(v).join(", ");
  if (c.type === "choice") {
    const names = new Map((c.choices ?? []).map((o) => [o.value, o.label]));
    return (c.multiChoice ? toArr(v) : [String(v)]).map((x) => names.get(x) ?? x).join(", ");
  }
  if (c.type && REF_TYPES.includes(c.type)) return refs[c.type]?.find((o) => o.id === v)?.label ?? "";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
};

type Tag = { text: string; kind: "role" | "lane" | "diff" };
const TAG_STYLE: Record<Tag["kind"], string> = {
  role: "border-accent/40 bg-accent/10 text-accent",
  lane: "border-border bg-bg-raised text-text-muted",
  diff: "border-border bg-bg-surface text-text-faint",
};

// หัวข้อ + คำอธิบายย่อ + รูป (ถ้ามี) + ป้ายสรุป ของแถว ตอนพับการ์ด
const summary = (cfg: Cfg, row: Row, refs: Record<string, RefOpt[]>, labels: Labels) => {
  const parts = cfg.cols.map((c) => show(c, row[c.k], refs)).filter(Boolean);
  const imgCol = cfg.cols.find((c) => c.type === "img");
  let img = imgCol ? (row[imgCol.k] as string | null) : null;
  let round = !!imgCol?.round;
  const gold = !!imgCol?.gold;
  if (!imgCol) {
    // แท็บที่อ้างอิงฮีโร่/ไอเทม/รูน: ใช้ไอคอนของตัวที่เลือกไว้
    for (const c of cfg.cols) {
      if (!c.type || !REF_TYPES.includes(c.type)) continue;
      const icon = refs[c.type]?.find((o) => o.id === row[c.k])?.icon;
      if (icon) {
        img = icon;
        round = c.type === "rune";
        break;
      }
    }
  }
  // แท็บฮีโร่: โชว์ตำแหน่ง เลน และระดับความยากที่หน้าการ์ดเลย ไม่ต้องกดขยาย (★ = ตัวหลัก)
  const tags: Tag[] = [];
  if (cfg.table === "heroes") {
    const roles = toArr(row.roles);
    const lanes = toArr(row.lanes);
    (roles.length > 0 ? roles : toArr(row.role)).forEach((r, i) =>
      tags.push({ text: `${labels.role(r)}${i === 0 ? " ★" : ""}`, kind: "role" })
    );
    (lanes.length > 0 ? lanes : toArr(row.lane)).forEach((l, i) =>
      tags.push({ text: `${labels.lane(l)}${i === 0 ? " ★" : ""}`, kind: "lane" })
    );
    if (row.difficulty) tags.push({ text: `ความยาก ${DIFFICULTY_TH[row.difficulty] ?? row.difficulty}`, kind: "diff" });
  }
  // แท็บไอเทม: โชว์ Tier และประเภทที่หน้าการ์ด (ไม่ต้องกดขยาย)
  if (cfg.table === "items") {
    if (row.tier != null && row.tier !== "") tags.push({ text: `T${row.tier}`, kind: "role" });
    toArr(row.role_tags).forEach((t) => tags.push({ text: ITEM_TYPE_LABEL[t] ?? t, kind: "lane" }));
  }
  // แท็บ "แท็กและสี": ช่องสีตัวอย่างหน้าการ์ด
  const swatch = cfg.table === TAG_STYLES_TABLE ? (safeHex(row.color) ?? undefined) : undefined;
  return {
    title: parts[0] ?? "(ว่าง)",
    sub: parts.slice(1, 3).join(" · "),
    img,
    round,
    gold,
    tags,
    swatch,
  };
};

// ตำแหน่ง/เลนของฮีโร่ในแถว: แท็บฮีโร่อ่านจากแถวเอง แท็บอื่นอ่านจากฮีโร่ที่อ้างอิง (null = หาไม่เจอ)
// ใช้ roles/lanes (หลายค่า) ถ้าว่างค่อยถอยไปใช้ role/lane เดี่ยว
const arrOr = (many: unknown, one: unknown) => {
  const a = toArr(many);
  return a.length > 0 ? a : toArr(one);
};
function heroAttrs(cfg: Cfg, row: Row, refs: Record<string, RefOpt[]>): { roles: string[]; lanes: string[] } | null {
  if (cfg.table === "heroes") return { roles: arrOr(row.roles, row.role), lanes: arrOr(row.lanes, row.lane) };
  const c = cfg.cols.find((x) => x.type === "hero");
  const o = c ? refs.hero?.find((x) => x.id === row[c.k]) : undefined;
  return o ? { roles: o.roles ?? [], lanes: o.lanes ?? [] } : null;
}

// ตัดตัวพิมพ์/ช่องว่าง/เครื่องหมายออก เพื่อให้พิมพ์ "azzenka" ก็เจอ Azzen'Ka, "wiro" ก็เจอ Wiro Sableng
const squash = (s: string) => s.toLowerCase().replace(/[\s'’`"\-_.]/g, "");
// ข้อความที่ใช้ค้นหาของแถว: เฉพาะช่องที่เป็นชื่อ (อ้างอิงฮีโร่/ไอเทม/ข้อความสั้น) + ชื่อสำรอง (ชื่อไทย)
// ไม่รวมช่องข้อความยาว (reason) กันค้นแล้วเจอแถวที่แค่พูดถึงชื่อนั้น
const searchText = (cfg: Cfg, row: Row, refs: Record<string, RefOpt[]>) =>
  squash(
    cfg.cols
      .filter((c) => !c.type || c.type === "text" || REF_TYPES.includes(c.type))
      .flatMap((c) => {
        const alt =
          c.type && REF_TYPES.includes(c.type) ? refs[c.type]?.find((o) => o.id === row[c.k])?.alt : undefined;
        return [show(c, row[c.k], refs), alt ?? ""];
      })
      .join(" ")
  );

// รวมจำนวนช่องรูนต่อสีจากแถวของบิลด์ที่เลือก (อ่านจาก state จึงอัปเดตทันทีที่แก้จำนวน/เปลี่ยนรูน)
function summarizeSlots(rows: Row[], rune: RefOpt[]) {
  const colorById = new Map(rune.map((a) => [a.id, a.color]));
  const used: Record<string, number> = { red: 0, purple: 0, green: 0 };
  let uncolored = 0;
  for (const r of rows) {
    const n = Number(r.quantity) || 0;
    const color = colorById.get(r.rune_id);
    if (color && color in used) used[color] += n;
    else uncolored += n;
  }
  return { used, uncolored };
}

// อัปโหลดรูปเข้า Supabase Storage (bucket hero-icons, แยกโฟลเดอร์ตามชื่อตาราง) แล้วคืน public URL
async function uploadImage(file: File, folder: string): Promise<string> {
  const path = `${folder}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) throw new Error(error.message);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// ปุ่มชิปจากรายการคงที่ (Tier ไอเทม / ประเภทไอเทม): ค่าเดียว แตะซ้ำเพื่อเอาออก / หลายค่า (multiChoice) แตะสลับเลือก
// ค่าใน DB ที่ไม่อยู่ใน choices (เช่น role_tags เก่า) ยังแสดงให้กดเอาออกได้ ไม่ถูกลบเงียบ ๆ
function ChoicePicker({ c, v, onChange }: { c: Col; v: unknown; onChange: (val: string) => void }) {
  const sel = c.multiChoice ? toArr(v) : v == null || v === "" ? [] : [String(v)];
  const choices = c.choices ?? [];
  const known = new Set(choices.map((o) => o.value));
  const all = [...choices, ...sel.filter((x) => !known.has(x)).map((value) => ({ value, label: value }))];
  const toggle = (val: string) =>
    c.multiChoice
      ? onChange((sel.includes(val) ? sel.filter((x) => x !== val) : [...sel, val]).join(","))
      : onChange(sel[0] === val ? "" : val);
  return (
    <div className="flex flex-wrap gap-2">
      {all.map((o) => {
        const on = sel.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(o.value)}
            className={`h-11 rounded-full border px-4 text-sm transition ${
              on
                ? "border-accent bg-accent/15 font-medium text-accent"
                : "border-border bg-bg-raised text-text-muted hover:border-text-faint"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ปุ่มเลือกตำแหน่ง/เลนของฮีโร่ (ไอคอน + ชื่อจาก DB): รายการรหัส ชื่อ ไอคอน ลำดับ มาจาก hero_roles / hero_lanes (แก้ได้ในแท็บ "ตำแหน่ง"/"เลน")
// รหัสไม่แสดงให้แอดมินเห็น แต่ใช้เป็นค่าที่บันทึก — ตัวแรกที่เลือก (★) = ตัวหลัก
function MultiPicker({ c, v, onChange }: { c: Col; v: unknown; onChange: (val: string) => void }) {
  const fi = useFilterIcons();
  const isRole = c.k === "roles";
  const icons = isRole ? fi.roles : fi.lanes;
  const labels = isRole ? fi.roleLabels : fi.laneLabels;
  const order = isRole ? fi.roleOrder : fi.laneOrder;
  const fallback = (isRole ? ROLE_OPTIONS : LANE_OPTIONS) as { value: string; label: string }[];
  const sel = toArr(v);
  // รายการคือรหัสจาก DB (เรียงตาม sort_order); DB ยังไม่โหลด/ว่างใช้ opts สำรอง และรหัสที่ฮีโร่มีอยู่แล้วแต่ไม่อยู่ในรายการก็ยังแสดง (จะได้กดเอาออกได้)
  const base = order.length > 0 ? order : (c.opts ?? []);
  const codes = sortByOrder(
    [...base, ...sel.filter((x) => !base.includes(x))].map((value) => ({ value })),
    order
  ).map((o) => o.value);
  const labelOf = (code: string) => labels[code] ?? fallback.find((o) => o.value === code)?.label ?? code;
  const toggle = (code: string) => onChange((sel.includes(code) ? sel.filter((x) => x !== code) : [...sel, code]).join(","));
  return (
    <div className="flex flex-wrap gap-2">
      {codes.map((code) => {
        const idx = sel.indexOf(code);
        const on = idx >= 0;
        const icon = icons[code];
        return (
          <button
            key={code}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(code)}
            className={`flex h-11 items-center gap-2 rounded-full border px-4 text-sm transition ${
              on
                ? "border-accent bg-accent/15 font-medium text-accent"
                : "border-border bg-bg-raised text-text-muted hover:border-text-faint"
            }`}
          >
            {icon ? (
              <img
                src={icon}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-5 w-5 shrink-0 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : null}
            <span>
              {labelOf(code)}
              {on && idx === 0 ? " ★" : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// onCommit: เรียกเมื่อแก้เสร็จ (select/อัปโหลด = ทันที, input = ตอนคลิกออก/กด Enter) ใช้บันทึกลง DB อัตโนมัติ
function Cell({
  c,
  v,
  refs,
  folder,
  onChange,
  onCommit,
  onError,
}: {
  c: Col;
  v: any;
  refs: Record<string, RefOpt[]>;
  folder: string;
  onChange: (v: string) => void;
  onCommit?: (v: string) => void;
  onError: (m: string) => void;
}) {
  const change = (val: string) => {
    onChange(val);
    onCommit?.(val);
  };
  if (c.ro) return <p className="flex h-11 items-center px-1 text-sm text-text-muted">{String(v ?? "")}</p>;
  if (c.type === "sel")
    return (
      <select className={inp} value={v ?? c.opts?.[0] ?? ""} onChange={(e) => change(e.target.value)}>
        {c.opts?.map((o) => (
          <option key={o} value={o}>
            {o || "— ไม่ระบุ —"}
          </option>
        ))}
      </select>
    );
  if (c.type === "multi") return <MultiPicker c={c} v={v} onChange={change} />;
  if (c.type === "choice") return <ChoicePicker c={c} v={v} onChange={change} />;
  if (c.type === "tags") {
    // แท็กสกิล: แตะเปิด/ปิดแต่ละแท็ก (ป้ายใช้สีที่ตั้งไว้ในแท็บ "แท็กและสี") แท็กที่สกิลมีแต่ไม่อยู่ในรายการ (เช่นชื่อที่นำเข้าผิด) ก็แสดงให้กดปิดได้
    const sel = tagNames(v);
    const cat = refs.effectTag ?? [];
    const colors: Record<string, string> = Object.fromEntries(cat.filter((o) => o.color).map((o) => [o.label, o.color!]));
    const names = [...cat.map((o) => o.label), ...sel.filter((n) => !cat.some((o) => o.label === n))];
    const toggle = (n: string) => change((sel.includes(n) ? sel.filter((x) => x !== n) : [...sel, n]).join(","));
    if (names.length === 0)
      return <p className="text-sm text-text-faint">ยังไม่มีรายการแท็ก เพิ่มได้ที่แท็บ "แท็กและสี"</p>;
    return (
      <div className="flex flex-wrap gap-2">
        {names.map((n) => {
          const on = sel.includes(n);
          const hex = tagColor(n, colors);
          return (
            <button
              key={n}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(n)}
              className={`h-9 rounded-full border px-3 text-sm transition ${
                on ? "font-semibold" : "border-border bg-bg-raised text-text-muted hover:border-text-faint"
              }`}
              style={on ? { color: hex, borderColor: hex, backgroundColor: `${hex}33` } : undefined}
            >
              {n}
            </button>
          );
        })}
      </div>
    );
  }
  if (c.type === "color") {
    // สี hex: ตัวเลือกสี (บันทึกตอนปิดตัวเลือก) + ช่องพิมพ์รหัส + ชุดสีสำเร็จรูป (แตะแล้วบันทึกทันที)
    const hex = safeHex(v) ?? "#94a3b8";
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="เลือกสี"
            value={hex}
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => onCommit?.(e.target.value)}
            className="h-11 w-14 shrink-0 cursor-pointer rounded-lg border border-border bg-bg-raised p-1"
          />
          <input
            className={inp}
            placeholder="#ef4444"
            value={v ?? ""}
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => {
              const val = e.target.value.trim();
              if (!val) return;
              const h = safeHex(val);
              if (!h) {
                onError("รหัสสีไม่ถูกต้อง ใช้รูปแบบ #RRGGBB เช่น #ef4444");
                return;
              }
              onChange(h);
              onCommit?.(h);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {EFFECT_COLOR_PRESETS.map((p) => (
            <button
              key={p.hex}
              type="button"
              title={p.label}
              aria-label={p.label}
              onClick={() => change(p.hex)}
              className={`h-8 w-8 rounded-full border-2 transition ${hex === p.hex ? "border-text" : "border-border"}`}
              style={{ backgroundColor: p.hex }}
            />
          ))}
        </div>
      </div>
    );
  }
  if (c.type && REF_TYPES.includes(c.type)) {
    // ฮีโร่/ไอเทม/รูน/แพตช์/หมวด: dropdown แบบมีรูปในรายการ (ไม่มีรูป = แสดงตัวอักษรย่อ)
    return (
      <ImageSelect
        value={v ?? ""}
        options={refs[c.type] ?? []}
        round={c.type === "rune"}
        onChange={change}
      />
    );
  }
  if (c.type === "img")
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {v ? (
            <img
              src={v}
              alt=""
              className={`h-11 w-11 shrink-0 border object-cover ${c.gold ? "border-accent" : "border-border"} ${
                c.round ? ROUND : "rounded-lg"
              }`}
            />
          ) : null}
          <input
            className={inp}
            placeholder="วาง URL รูป"
            value={v ?? ""}
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => onCommit?.(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </div>
        <label className={`${BTN_BASE} ${BTN_VARIANT.secondary} w-full cursor-pointer sm:w-auto`}>
          <ImagePlus className="h-4 w-4" /> อัปโหลดรูป
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const input = e.target;
              const f = input.files?.[0];
              if (!f) return;
              try {
                change(await uploadImage(f, folder));
              } catch (err) {
                onError(`อัปโหลดไม่สำเร็จ: ${(err as Error).message}`);
              }
              input.value = "";
            }}
          />
        </label>
      </div>
    );
  if (c.type === "area")
    return (
      <textarea
        className={area}
        rows={3}
        value={v ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onCommit?.(e.target.value)}
      />
    );
  return (
    <input
      className={inp}
      type={c.type === "num" ? "number" : c.type === "date" ? "date" : "text"}
      inputMode={c.type === "num" ? "decimal" : undefined}
      step={c.type === "num" ? "any" : undefined}
      placeholder={c.type === "arr" ? "คั่นด้วย ," : undefined}
      value={Array.isArray(v) ? v.join(", ") : (v ?? "")}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onCommit?.(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

// id = คีย์ของแท็บ ใช้ตั้งชื่อค่าที่จำไว้ (ชิปตำแหน่ง/เลน แรงก์ แพตช์ และตัวเลือกใน dropdown แยกกันต่อแท็บ)
function Editor({ id, cfg, refs }: { id: string; cfg: Cfg; refs: Record<string, RefOpt[]> }) {
  const blank = () => Object.fromEntries(cfg.cols.filter((c) => c.type === "sel").map((c) => [c.k, c.opts?.[0]]));
  const { roleLabel, laneLabel } = useFilterLabels();
  const labels: Labels = { role: roleLabel, lane: laneLabel };
  // แจ้งผลด้วย toast กลางของแอป (อยู่เหนือ Editor จึงไม่หายตอนสลับแท็บ)
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [opts, setOpts] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Row>(blank);
  const [showAdd, setShowAdd] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  // ค่าที่จำไว้ (sessionStorage) รีเฟรชแล้วไม่หาย: ชิปตำแหน่ง/เลน, แรงก์/แพตช์/เลนของ Tier List, ตัวเลือกใน dropdown, Tier/ประเภทไอเทม
  const [roleSaved, setRole] = usePersistedState<HeroRole | null>(`admin:${id}:role`, null);
  const [laneSaved, setLane] = usePersistedState<HeroLane | null>(`admin:${id}:lane`, null);
  const tl = cfg.filter?.tierList;
  // ชิปแรงก์: Tier List (เลือกลิสต์) หรือแท็บสถิติ (กรองแถวตาม rank_tier) ใช้สถานะจำค่าตัวเดียวกันต่อแท็บ
  const rankOpts = tl?.ranks ?? cfg.rankChips;
  const [rankSaved, setRankV] = usePersistedState<string>(`admin:${id}:rank`, rankOpts?.[0]?.value ?? "");
  const [patchSaved, setPatchSaved] = usePersistedState<string>(`admin:${id}:patch`, "");
  const [listLaneSaved, setListLane] = usePersistedState<HeroLane | null>(`admin:${id}:listlane`, null);
  const [fvSaved, setFvSaved] = usePersistedState<string>(`admin:${id}:fv`, "");
  const [itemTier, setItemTier] = usePersistedState<string | null>(`admin:${id}:itemtier`, null);
  const [itemType, setItemType] = usePersistedState<string | null>(`admin:${id}:itemtype`, null);
  // ค่าที่จำไว้อาจเก่า (เช่นรหัสตำแหน่ง/เลนที่เปลี่ยนชื่อไปแล้ว) ใช้เฉพาะค่าที่ยังมีอยู่ ไม่งั้นกลับไปค่าเริ่มต้น
  const role = ROLE_OPTIONS.some((o) => o.value === roleSaved) ? roleSaved : null;
  const lane = LANE_OPTIONS.some((o) => o.value === laneSaved) ? laneSaved : null;
  const listLane = LANE_OPTIONS.some((o) => o.value === listLaneSaved) ? listLaneSaved : null;
  const rankV = rankOpts?.some((r) => r.value === rankSaved) ? rankSaved : (rankOpts?.[0]?.value ?? "");
  // ค่าที่บันทึกลง DB ล่าสุด ใช้เทียบว่ามีการแก้จริงหรือไม่
  const orig = useRef<Record<string, Row>>({});

  const ok = toast.success;
  const err = toast.error;

  const loadOpts = useCallback(() => {
    if (!cfg.filter) return;
    let r = db.from(cfg.filter.table).select(cfg.filter.sel);
    if (cfg.filter.order) r = r.order(cfg.filter.order);
    r.then(({ data, error }: { data: Row[] | null; error: { message: string } | null }) => {
      if (error) toast.error(`โหลดตัวเลือกไม่สำเร็จ: ${error.message}`);
      setOpts(data ?? []);
    });
  }, [cfg, toast]);

  useEffect(() => {
    loadOpts();
  }, [loadOpts]);

  // Tier List: แพตช์ = ทุกแพตช์ในตาราง patches (ใหม่สุดก่อน) แม้ยังไม่มีลิสต์ — เลือกแล้วสร้างลิสต์ได้
  // ลิสต์ที่เลือก = ตรงกับ แรงก์ + แพตช์ + เลน (lane เป็น null = "ทุกเลน") ถ้าไม่มี fv จะว่างและขึ้นปุ่มสร้าง
  const patchOpts = tl ? (refs.patch ?? []).map((p) => ({ id: p.id, code: p.label })) : [];
  const patchV = patchOpts.find((p) => p.id === patchSaved)?.id ?? patchOpts[0]?.id ?? "";
  // ตัวเลือกที่เลือกอยู่ (ค่าที่จำไว้ถ้ายังอยู่ในรายการ ไม่งั้นใช้ตัวแรก)
  const fv = tl
    ? (opts.find((o) => o.rank_tier === rankV && o.patch_id === patchV && (o.lane ?? null) === listLane)?.id ?? "")
    : (opts.find((o) => o.id === fvSaved)?.id ?? opts[0]?.id ?? "");

  const load = useCallback(async () => {
    if (cfg.filter && !fv) {
      setRows([]);
      return;
    }
    let r = db.from(cfg.table).select("*");
    if (cfg.filter) r = r.eq(cfg.filter.col, fv);
    if (cfg.search && q) r = r.ilike(cfg.search, `%${q}%`);
    if (cfg.order) r = r.order(cfg.order, { ascending: cfg.asc ?? true });
    const { data, error } = await r;
    if (error) err(error.message);
    else {
      const list = data as Row[];
      orig.current = Object.fromEntries(list.map((x) => [x.id, { ...x }]));
      setRows(list);
    }
  }, [cfg, fv, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const edit = (i: number, k: string, v: string) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  async function commit(row: Row, c: Col, v: string) {
    if (norm(c, orig.current[row.id]?.[c.k]) === norm(c, v)) return; // ไม่มีอะไรเปลี่ยน
    const val = clean(c, v, refs, orig.current[row.id]?.[c.k]);
    const body: Row = { [c.k]: val };
    if (cfg.table === "heroes") body.updated_at = new Date().toISOString();
    const { error } = await db.from(cfg.table).update(body).eq("id", row.id);
    if (error) {
      err(`บันทึกไม่สำเร็จ (${c.k}): ${error.message}`);
    } else {
      orig.current[row.id] = { ...orig.current[row.id], [c.k]: val };
      // ชื่อ/ไอคอน/ลำดับของตำแหน่ง/เลนถูกแคชไว้ในแอป ล้างเพื่อให้หน้าถัดไปเห็นข้อมูลใหม่
      if (cfg.table === "hero_roles" || cfg.table === "hero_lanes") clearFilterIconsCache();
      // สีแท็กสกิลก็ถูกแคชไว้เช่นกัน
      if (cfg.table === TAG_STYLES_TABLE) clearEffectTagStylesCache();
      ok(`บันทึก ${c.label ?? c.k} แล้ว`);
    }
  }

  async function remove(row: Row) {
    const { error } = await db.from(cfg.table).delete().eq("id", row.id);
    setConfirmId(null);
    if (error) err(error.message);
    else {
      if (cfg.table === TAG_STYLES_TABLE) clearEffectTagStylesCache();
      ok("ลบแล้ว");
      void load();
    }
  }

  async function add() {
    if (cfg.filter && !fv) {
      err("ยังไม่ได้เลือกลิสต์ที่จะเพิ่มรายการลงไป");
      return;
    }
    // ข้ามช่องที่ว่าง (รวมถึงลิสต์ว่าง) เพื่อให้ค่า default ของ DB ทำงาน (เช่น quantity = 10)
    const body: Row = {};
    for (const c of cfg.cols) {
      const val = clean(c, draft[c.k], refs);
      if (val !== null && !(Array.isArray(val) && val.length === 0)) body[c.k] = val;
    }
    if (cfg.filter) body[cfg.filter.col] = fv;
    // สถิติ: ถ้าไม่ได้กรอกแรงก์ ใช้แรงก์ที่ชิปเลือกอยู่
    if (cfg.rankChips && body.rank_tier == null && rankV) body.rank_tier = rankV;
    const { error } = await db.from(cfg.table).insert(body);
    if (error) err(error.message);
    else {
      if (cfg.table === TAG_STYLES_TABLE) clearEffectTagStylesCache();
      setDraft(blank());
      setShowAdd(false);
      ok("เพิ่มแล้ว");
      void load();
    }
  }

  // ---------- มุมมองช่อง (ไอเทม/รูนในบิลด์) ----------
  const nextSort = () => rows.reduce((m, r) => Math.max(m, Number(r.sort_order) || 0), 0) + 1;

  // ไอเทมในบิลด์: เพิ่มแถวใหม่ในช่วงเกมที่เลือก (เหตุผลแก้ภายหลังในการ์ด)
  async function addBuildItem(itemId: string, phase: string) {
    if (!fv) return;
    const { error } = await db
      .from(cfg.table)
      .insert({ [cfg.filter!.col]: fv, item_id: itemId, phase, reason: "", sort_order: nextSort() });
    if (error) err(error.message);
    else void load();
  }

  // รูนในบิลด์: รูนที่มีอยู่แล้วในบิลด์ = จำนวน +1, ยังไม่มี = เพิ่มแถวใหม่จำนวน 1
  async function addRune(runeId: string) {
    if (!fv) return;
    const existing = rows.find((r) => r.rune_id === runeId);
    const { error } = existing
      ? await db.from(cfg.table).update({ quantity: (Number(existing.quantity) || 0) + 1 }).eq("id", existing.id)
      : await db.from(cfg.table).insert({ [cfg.filter!.col]: fv, rune_id: runeId, quantity: 1, sort_order: nextSort() });
    if (error) err(error.message);
    else void load();
  }

  // ลดจำนวนรูนทีละ 1 ถึง 0 = ลบแถว
  async function decRune(row: Row) {
    const n = Number(row.quantity) || 0;
    const { error } =
      n <= 1
        ? await db.from(cfg.table).delete().eq("id", row.id)
        : await db.from(cfg.table).update({ quantity: n - 1 }).eq("id", row.id);
    if (error) err(error.message);
    else void load();
  }

  // ลากย้ายช่อง: BuildSlots คำนวณว่าแถวไหนต้องเปลี่ยน phase / sort_order แล้วส่งมาที่นี่
  // อัปเดตหน้าจอทันที (ไม่ต้องรอ DB) แล้วบันทึกทุกแถวพร้อมกัน ถ้าพลาดโหลดจาก DB ใหม่ให้ตรงกับของจริง
  async function applyMoves(moves: RowMove[]) {
    if (moves.length === 0) return;
    const byId = new Map(moves.map((m) => [m.id, m.patch]));
    setRows((rs) =>
      rs
        .map((r) => (byId.has(r.id) ? { ...r, ...byId.get(r.id) } : r))
        .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
    );
    const res = await Promise.all(moves.map((m) => db.from(cfg.table).update(m.patch).eq("id", m.id)));
    const bad = res.find((x: { error: { message: string } | null }) => x.error);
    if (bad) err(`ย้ายไม่สำเร็จ: ${bad.error.message}`);
    void load();
  }

  // Tier List: สร้างลิสต์เปล่าของ แรงก์ + แพตช์ + เลน ที่เลือกอยู่ (ยังไม่มีในตาราง tier_lists)
  async function createList() {
    if (!patchV) return;
    const { error } = await db
      .from(cfg.filter!.table)
      .insert({ patch_id: patchV, rank_tier: rankV, lane: listLane });
    if (error) err(error.message);
    else {
      ok("สร้าง Tier List แล้ว");
      loadOpts();
    }
  }

  // รอให้โหลดรายชื่อรูนก่อนค่อยคำนวณ ไม่งั้นจะขึ้นเตือนว่าไม่มีสีชั่วครู่
  const slotInfo = cfg.slots && (refs.rune?.length ?? 0) > 0 ? summarizeSlots(rows, refs.rune) : null;

  // รายการที่แสดง: กรองด้วยชิปตำแหน่ง/เลน (ถ้าแท็บเปิดใช้) → กรองด้วยคำค้นและเรียงชื่อ A→Z (ถ้าเปิด clientSearch)
  // ตารางอื่นเรียงตามที่ DB ส่งมา เก็บ i = ตำแหน่งเดิมใน rows ไว้ เพราะการแก้ไขอ้างอิงตำแหน่งนี้
  const view = (() => {
    let list = rows.map((row, i) => ({ row, i, info: summary(cfg, row, refs, labels) }));
    // แท็บที่อ้างอิงฮีโร่ต้องรอรายชื่อฮีโร่โหลดก่อน ไม่งั้นรายการจะว่างชั่วครู่
    const heroesReady = cfg.table === "heroes" || (refs.hero?.length ?? 0) > 0;
    const laneChip = cfg.heroChips === true;
    if (cfg.heroChips && heroesReady && (role || (laneChip && lane))) {
      list = list.filter(({ row }) => {
        const a = heroAttrs(cfg, row, refs);
        return !!a && (!role || a.roles.includes(role)) && (!laneChip || !lane || a.lanes.includes(lane));
      });
    }
    // สถิติ: แสดงเฉพาะแถวของแรงก์ที่ชิปเลือก
    if (cfg.rankChips) list = list.filter(({ row }) => row.rank_tier === rankV);
    // ไอเทม: กรองตาม Tier (T1–T3 / ยังไม่ระบุ) และประเภท (ไอเทมที่มีประเภทนั้นอยู่ใน role_tags)
    if (cfg.table === "items") {
      if (itemTier) {
        list = list.filter(({ row }) => (itemTier === "none" ? row.tier == null : String(row.tier ?? "") === itemTier));
      }
      if (itemType) list = list.filter(({ row }) => toArr(row.role_tags).includes(itemType));
    }
    if (!cfg.clientSearch) return list;
    const needle = squash(q);
    const hit = needle ? list.filter(({ row }) => searchText(cfg, row, refs).includes(needle)) : list;
    return hit.sort(
      (a, b) =>
        a.info.title.localeCompare(b.info.title, "en", { sensitivity: "base" }) ||
        a.info.sub.localeCompare(b.info.sub, "en", { sensitivity: "base" })
    );
  })();

  const chip = (on: boolean) =>
    `h-11 rounded-full border px-4 text-sm transition ${
      on
        ? "border-accent bg-accent font-medium text-accent-fg"
        : "border-border bg-bg-surface text-text-muted hover:border-text-faint hover:text-text"
    }`;

  return (
    <div className="space-y-4 pb-24">
      {/* ตัวกรอง / ค้นหา: มือถือเรียงลง เดสก์ท็อปเรียงข้าง */}
      {(cfg.filter || cfg.search || cfg.clientSearch) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {tl ? (
            <>
              {/* Tier List: แรงก์ (ชิป) + แพตช์ (dropdown) แยกกัน เลนอยู่ในชิปด้านล่าง */}
              <div role="group" aria-label="แรงก์" className="flex flex-wrap gap-2">
                {tl.ranks.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={rankV === o.value}
                    onClick={() => setRankV(o.value)}
                    className={chip(rankV === o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <select
                aria-label="แพตช์"
                className={`${inp} sm:w-auto sm:min-w-[10rem]`}
                value={patchV}
                onChange={(e) => setPatchSaved(e.target.value)}
              >
                {patchOpts.length === 0 && <option value="">— ไม่มีแพตช์ —</option>}
                {patchOpts.map((p) => (
                  <option key={p.id} value={p.id}>
                    แพตช์ {p.code}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              {cfg.filter && (
                // ตัวกรองหลัก (ฮีโร่/บิลด์/แพตช์): dropdown มีไอคอนฮีโร่ในรายการ ไม่ให้ล้างค่า (ต้องมีตัวเลือกเสมอ)
                <ImageSelect
                  className="sm:min-w-[18rem] sm:max-w-full"
                  clearable={false}
                  value={fv}
                  options={opts.map((o) => ({
                    id: o.id as string,
                    label: cfg.filter!.label(o, labels),
                    icon: cfg.filter!.icon?.(o),
                    alt: o.name_th ?? o.heroes?.name_th,
                  }))}
                  onChange={setFvSaved}
                />
              )}
              {/* สถิติ: ชิปแรงก์ (ทั้งหมด / Commander+) หน้าตาเหมือนแท็บ Tier List */}
              {cfg.rankChips && (
                <div role="group" aria-label="แรงก์" className="flex flex-wrap gap-2">
                  {cfg.rankChips.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      aria-pressed={rankV === o.value}
                      onClick={() => setRankV(o.value)}
                      className={chip(rankV === o.value)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          {(cfg.search || cfg.clientSearch) && (
            <input
              className={`${inp} sm:w-64`}
              type="search"
              autoComplete="off"
              placeholder={cfg.clientSearch ? "ค้นหาชื่อฮีโร่ (อังกฤษ/ไทย)..." : "ค้นหาชื่อ..."}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          )}
        </div>
      )}

      {/* Tier List: ชิปเลนของลิสต์ (ทุกเลน = ลิสต์รวม) ใช้ชุดเดียวกับหน้าฮีโร่ */}
      {tl && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-text-muted">เลนของ Tier List</p>
          <LaneFilterRow value={listLane} onChange={setListLane} />
        </div>
      )}

      {/* ชิปกรองฮีโร่ ตำแหน่ง / เลน (ชื่อ ลำดับ ไอคอนมาจาก DB) */}
      {cfg.heroChips && (
        <div className="space-y-1">
          {tl && <p className="text-xs font-medium text-text-muted">กรองตำแหน่งฮีโร่</p>}
          <RoleFilterRow value={role} onChange={setRole} />
          {cfg.heroChips === true && <LaneFilterRow value={lane} onChange={setLane} />}
        </div>
      )}

      {/* ไอเทม: ชิปกรอง Tier (T1–T3) และ ประเภท (โจมตี/เวท/ป้องกัน/เคลื่อนที่/ป่า/ซัพพอร์ต) แตะซ้ำเพื่อยกเลิก */}
      {cfg.table === "items" && (
        <div className="space-y-2">
          <div className="space-y-1">
            <p className="text-xs font-medium text-text-muted">ระดับ (Tier)</p>
            <div role="group" aria-label="Tier ไอเทม" className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              <Chip active={itemTier === null} onClick={() => setItemTier(null)} label="ทั้งหมด" />
              {ITEM_TIER_FILTERS.map((o) => (
                <Chip
                  key={o.value}
                  active={itemTier === o.value}
                  onClick={() => setItemTier(itemTier === o.value ? null : o.value)}
                  label={o.label}
                />
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-text-muted">ประเภท</p>
            <div role="group" aria-label="ประเภทไอเทม" className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              <Chip active={itemType === null} onClick={() => setItemType(null)} label="ทั้งหมด" />
              {ITEM_TYPE_CHOICES.map((o) => (
                <Chip
                  key={o.value}
                  active={itemType === o.value}
                  onClick={() => setItemType(itemType === o.value ? null : o.value)}
                  label={o.label}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* จำนวนช่องรูนต่อสี (สีละ 10 ช่อง) — เตือนเท่านั้น ไม่ขวางการบันทึก */}
      {slotInfo && (
        <section aria-label="จำนวนช่องรูน" className="space-y-2 rounded-card border border-border bg-bg-surface p-3 shadow-card sm:max-w-xl">
          <div className="grid grid-cols-3 gap-2">
            {SLOT_COLORS.map(({ k, label, hex }) => {
              const n = slotInfo.used[k];
              const over = n > MAX_SLOTS;
              return (
                <div key={k} className="rounded-lg border border-border bg-bg-raised px-3 py-2">
                  <p className="flex items-center gap-1.5 text-xs text-text-muted">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: hex }} />
                    {label}
                  </p>
                  <p className={`mt-0.5 text-base font-semibold ${over ? "text-loss" : n === MAX_SLOTS ? "text-win" : ""}`}>
                    {n}/{MAX_SLOTS}
                  </p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.min(100, (n / MAX_SLOTS) * 100)}%`, backgroundColor: over ? "#ef4444" : hex }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {SLOT_COLORS.some(({ k }) => slotInfo.used[k] > MAX_SLOTS) && (
            <p className="flex items-start gap-1.5 text-xs text-loss">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              รูนสีนี้ใส่ได้รวมไม่เกิน {MAX_SLOTS} ช่องต่อหน้ารูน ลดจำนวนหรือลบรูนบางตัว
            </p>
          )}
          {slotInfo.uncolored > 0 && (
            <p className="flex items-start gap-1.5 text-xs text-loss">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              มี {slotInfo.uncolored} ช่องที่รูนยังไม่ได้ตั้งสี ไปตั้งสีได้ในแท็บ "รูน" จึงจะนับรวม
            </p>
          )}
        </section>
      )}

      {/* มุมมองช่องแบบ TeamSlots ของ Draft Assistant: ไอเทมตามช่วงเกม / รูน 3 สี สีละ 10 ช่อง (ลากย้ายช่องได้) */}
      {cfg.slotsView === "items" && fv && (
        <ItemSlots
          rows={rows}
          items={refs.item ?? []}
          onAdd={(itemId, phase) => void addBuildItem(itemId, phase)}
          onRemove={(row) => void remove(row)}
          onOpen={(row) => setOpenId(row.id)}
          onMoves={(m) => void applyMoves(m)}
        />
      )}
      {cfg.slotsView === "rune" && fv && (
        <RuneSlots
          rows={rows}
          rune={refs.rune ?? []}
          colors={SLOT_COLORS}
          max={MAX_SLOTS}
          onAdd={(runeId) => void addRune(runeId)}
          onDec={(row) => void decRune(row)}
          onMoves={(m) => void applyMoves(m)}
        />
      )}

      {/* เพิ่มรายการ */}
      {cfg.add &&
        (showAdd ? (
          <section className="space-y-4 rounded-card border border-accent/40 bg-bg-surface p-4 shadow-card">
            <h2 className="font-display text-base font-semibold">เพิ่ม{cfg.label}</h2>
            <div className={fieldGrid}>
              {cfg.cols.map((c) => (
                <Field key={c.k} label={c.label ?? c.k} className={fieldSpan(c)}>
                  <Cell
                    c={c}
                    v={draft[c.k]}
                    refs={refs}
                    folder={cfg.table}
                    onChange={(v) => setDraft((d) => ({ ...d, [c.k]: v }))}
                    onError={err}
                  />
                </Field>
              ))}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Btn onClick={() => setShowAdd(false)}>ยกเลิก</Btn>
              <Btn variant="primary" onClick={add}>
                <Plus className="h-4 w-4" /> บันทึก
              </Btn>
            </div>
          </section>
        ) : (
          <Btn variant="primary" className="w-full sm:w-auto" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" /> เพิ่ม{cfg.label}
          </Btn>
        ))}

      <p className="text-xs text-text-muted">
        {view.length === rows.length ? rows.length : `${view.length}/${rows.length}`} รายการ · แก้ไขแล้วบันทึกอัตโนมัติ
      </p>

      {/* รายการ: การ์ดพับได้ แตะเพื่อแก้ไข จอ ≥ lg เรียง 2 คอลัมน์ การ์ดที่เปิดอยู่กินเต็มแถว */}
      <div className="grid gap-2 lg:grid-cols-2 lg:items-start">
        {view.length === 0 &&
          (tl && !fv ? (
            <div className="space-y-3 rounded-card border border-dashed border-border p-6 text-center lg:col-span-2">
              <p className="text-sm text-text-muted">ยังไม่มี Tier List สำหรับแรงก์ / แพตช์ / เลนนี้</p>
              {patchV && (
                <Btn variant="primary" onClick={() => void createList()}>
                  <Plus className="h-4 w-4" /> สร้าง Tier List นี้
                </Btn>
              )}
            </div>
          ) : (
            <p className="rounded-card border border-dashed border-border p-6 text-center text-sm text-text-muted lg:col-span-2">
              {rows.length === 0 ? "ยังไม่มีข้อมูล" : "ไม่พบรายการที่ตรงกับตัวกรองหรือคำค้นหา"}
            </p>
          ))}
        {view.map(({ row, i, info }) => {
          const open = openId === row.id;
          const { title, sub, img, round, gold, tags, swatch } = info;
          return (
            <article
              key={row.id}
              className={`min-w-0 overflow-hidden rounded-card border border-border bg-bg-surface shadow-card ${
                open ? "lg:col-span-2" : ""
              }`}
            >
              <button
                type="button"
                aria-expanded={open}
                onClick={() => {
                  setOpenId(open ? null : row.id);
                  setConfirmId(null);
                }}
                className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-bg-raised"
              >
                {swatch ? (
                  <span
                    aria-hidden
                    className="h-9 w-9 shrink-0 rounded-lg border border-border"
                    style={{ backgroundColor: swatch }}
                  />
                ) : null}
                {img ? (
                  <img
                    src={img}
                    alt=""
                    className={`h-9 w-9 shrink-0 border object-cover ${gold ? "border-accent" : "border-border"} ${
                      round ? ROUND : "rounded-lg"
                    }`}
                  />
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{title}</span>
                  {sub && <span className="block truncate text-xs text-text-muted">{sub}</span>}
                  {tags.length > 0 && (
                    <span className="mt-1.5 flex flex-wrap gap-1">
                      {tags.map((t, ti) => (
                        <span
                          key={ti}
                          className={`rounded-full border px-2 py-0.5 text-[11px] leading-none ${TAG_STYLE[t.kind]}`}
                        >
                          {t.text}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
                <ChevronDown className={`h-5 w-5 shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
              </button>

              {open && (
                <div className="space-y-4 border-t border-border p-4">
                  <div className={fieldGrid}>
                    {cfg.cols.map((c) => (
                      <Field key={c.k} label={c.label ?? c.k} className={fieldSpan(c)}>
                        <Cell
                          c={c}
                          v={row[c.k]}
                          refs={refs}
                          folder={cfg.table}
                          onChange={(v) => edit(i, c.k, v)}
                          onCommit={(v) => void commit(row, c, v)}
                          onError={err}
                        />
                      </Field>
                    ))}
                  </div>

                  {!cfg.noDelete && (
                    <div className="border-t border-border pt-4">
                      {confirmId === row.id ? (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                          <span className="text-sm text-text-muted sm:mr-auto">ลบรายการนี้ถาวร?</span>
                          <Btn onClick={() => setConfirmId(null)}>
                            <X className="h-4 w-4" /> ยกเลิก
                          </Btn>
                          <Btn variant="dangerSolid" onClick={() => void remove(row)}>
                            <Trash2 className="h-4 w-4" /> ยืนยันลบ
                          </Btn>
                        </div>
                      ) : (
                        <Btn variant="danger" className="w-full sm:w-auto" onClick={() => setConfirmId(row.id)}>
                          <Trash2 className="h-4 w-4" /> ลบรายการ
                        </Btn>
                      )}
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

// แท็บที่มีหน้าจอของตัวเอง (ไม่ใช่ตารางแบบ CFG): แสดงต่อท้ายแถบแท็บ ถัดจาก "รูนในบิลด์" ตามลำดับด้านล่าง
const CUSTOM_TABS: Record<string, { label: string; after: string; render: () => ReactNode }> = {
  buildSpell: { label: "สกิลชาเลนเจอร์ในบิลด์", after: "buildRune", render: () => <BuildSpellEditor /> },
  buildEnchant: { label: "พลังแฝงในบิลด์", after: "buildSpell", render: () => <BuildEnchantmentEditor /> },
};
const isCustomTab = (k: string) => Object.prototype.hasOwnProperty.call(CUSTOM_TABS, k);
// ลำดับแท็บทั้งหมด: ตาราง CFG ตามเดิม โดยแท็บ custom แทรกต่อจากแท็บที่ระบุใน `after`
const TAB_KEYS: string[] = (() => {
  const keys = Object.keys(CFG);
  for (const [k, c] of Object.entries(CUSTOM_TABS)) {
    const at = keys.indexOf(c.after);
    keys.splice(at < 0 ? keys.length : at + 1, 0, k);
  }
  return keys;
})();

export function Admin() {
  const { user, loading } = useAuth();
  const { isAdmin, checking, error } = useIsAdmin();
  const toast = useToast();
  // แท็บที่เปิดอยู่จำไว้ด้วย รีเฟรชแล้วกลับมาที่แท็บเดิมพร้อมตัวกรองที่เลือกไว้
  const [savedTab, setTab] = usePersistedState<string>("admin:tab", "heroes");
  const tab = Object.prototype.hasOwnProperty.call(CFG, savedTab) || isCustomTab(savedTab) ? savedTab : "heroes";
  const [refs, setRefs] = useState<Record<string, RefOpt[]>>({});
  const navRef = useRef<HTMLElement>(null);

  // รีเฟรชแล้วแท็บที่จำไว้อาจอยู่นอกจอ (แถบแท็บเลื่อนแนวนอนบนมือถือ) เลื่อนให้แท็บที่เปิดอยู่มาอยู่กลางแถบ
  useEffect(() => {
    const nav = navRef.current;
    const el = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (nav && el) nav.scrollTo({ left: el.offsetLeft - (nav.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
  }, [tab, isAdmin]);

  // โหลดตัวเลือกสำหรับช่องที่อ้างอิงตารางอื่น (ฮีโร่/ไอเทม/รูน/แพตช์/หมวดคู่มือ) พร้อมไอคอน (ถ้ามี) ไว้แสดงในการ์ดและช่องเลือก
  // โหลดใหม่ทุกครั้งที่สลับแท็บ เพื่อให้หมวดที่เพิ่ง เพิ่ม/แก้ ในแท็บ "หมวดคู่มือ" โผล่ในช่องเลือกของแท็บ "คู่มือ" ทันที
  useEffect(() => {
    if (!isAdmin) return;
    // มีตัวเลือกชุดไหนโหลดพลาดหรือไม่ — แจ้งครั้งเดียวตอนจบ แทนที่จะเด้ง toast ทีละชุด
    const state = { failed: false };
    const opt = (
      table: string,
      sel: string,
      order: string,
      asc: boolean,
      label: (r: Row) => string,
      icon?: (r: Row) => string | undefined,
      alt?: (r: Row) => string | undefined,
      extra?: (r: Row) => Partial<RefOpt>
    ) =>
      db
        .from(table)
        .select(sel)
        .order(order, { ascending: asc })
        .then(({ data, error }: { data: Row[] | null; error: unknown }) => {
          if (error) state.failed = true;
          return (data ?? []).map((r) => ({ id: r.id as string, label: label(r), icon: icon?.(r), alt: alt?.(r), ...extra?.(r) }));
        });
    // รูนเก็บสีไว้ด้วย เพื่อใช้คำนวณจำนวนช่องต่อสีในแท็บ "รูนในบิลด์"
    const runeOpts = db
      .from("rune")
      .select("id,name,color,icon_url")
      .order("name", { ascending: true })
      .then(({ data, error }: { data: Row[] | null; error: unknown }) => {
        if (error) state.failed = true;
        return (data ?? []).map((r) => ({
          id: r.id as string,
          label: r.name as string,
          color: (r.color ?? undefined) as string | undefined,
          icon: (r.icon_url ?? undefined) as string | undefined,
        }));
      });
    void Promise.all([
      // ชื่อไทยเก็บเป็น alt ไว้ใช้ค้นหาอย่างเดียว (ยังแสดงชื่ออังกฤษเหมือนเดิม)
      // roles / lanes ไว้ให้ชิปกรองในแท็บสถิติและ Tier List
      opt(
        "heroes",
        "id,name,name_th,icon_url,roles,lanes,role,lane",
        "name",
        true,
        heroName,
        (r) => r.icon_url ?? undefined,
        (r) => (r.name_th as string | null) ?? undefined,
        (r) => ({ roles: arrOr(r.roles, r.role), lanes: arrOr(r.lanes, r.lane) })
      ),
      // ไอเทมในบิลด์แสดงชื่ออังกฤษ (ตรงกับเกม/เว็บทางการ) ชื่อไทยใน DB เป็นการแปลเครื่อง
      opt("items", "id,name,icon_url", "name", true, (r) => r.name ?? "?", (r) => r.icon_url ?? undefined),
      runeOpts,
      opt("patches", "id,code", "released_at", false, (r) => r.code),
      // หมวดคู่มือ ใช้เป็นตัวเลือกของช่อง "หมวดหมู่" ในแท็บ "คู่มือ" (เรียงตาม sort_id เหมือนที่แสดงบนเว็บ)
      opt("guide_categories", "id,name_th,slug,sort_id", "sort_id", true, (r) => r.name_th ?? r.slug ?? "?"),
      // รายการแท็กสกิล (ชื่อ + สี + type ของเกม) ใช้เป็นปุ่มเลือกในช่อง "แท็กสกิล" ของแท็บ "สกิล"
      // ตารางยังไม่มี = รายการว่าง (ช่องแท็กจะบอกให้ไปเพิ่มที่แท็บ "แท็กและสี")
      opt(
        TAG_STYLES_TABLE,
        "id,name,tag_type,color",
        "tag_type",
        true,
        (r) => r.name ?? "?",
        undefined,
        undefined,
        (r) => ({ color: (r.color ?? undefined) as string | undefined, tagType: (r.tag_type ?? undefined) as number | undefined })
      ),
    ])
      .then(([hero, item, rune, patch, guideCat, effectTag]) => {
        setRefs({ hero, item, rune, patch, guideCat, effectTag });
        if (state.failed) toast.error("โหลดตัวเลือกบางรายการไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง");
      })
      .catch(() => toast.error("โหลดตัวเลือกไม่สำเร็จ ตรวจสอบการเชื่อมต่อแล้วลองรีเฟรชหน้านี้"));
  }, [isAdmin, tab, toast]);

  if (loading || checking) return <p className="text-text-muted">กำลังตรวจสอบสิทธิ์...</p>;
  if (!user)
    return (
      <p>
        ต้อง <Link to="/login" className="text-accent underline">เข้าสู่ระบบ</Link> ก่อน แล้วกลับมาที่ /admin
      </p>
    );
  if (!isAdmin) return <p className="text-loss">บัญชีนี้ไม่มีสิทธิ์แอดมิน {error && `(${error})`}</p>;

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-semibold">RoV LAB Admin</h1>

      {/* แท็บ: มือถือเลื่อนแนวนอน (relative เพื่อให้คำนวณตำแหน่งเลื่อนได้) เดสก์ท็อปขึ้นบรรทัดใหม่ */}
      <nav
        ref={navRef}
        aria-label="ตาราง"
        className="relative overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex w-max gap-2 md:w-auto md:flex-wrap">
          {TAB_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              aria-current={k === tab ? "page" : undefined}
              className={`h-10 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm transition ${
                k === tab
                  ? "border-accent bg-accent font-medium text-accent-fg"
                  : "border-border bg-bg-surface text-text-muted hover:border-text-faint hover:text-text"
              }`}
            >
              {isCustomTab(k) ? CUSTOM_TABS[k].label : CFG[k].label}
            </button>
          ))}
        </div>
      </nav>

      {isCustomTab(tab) ? <div key={tab}>{CUSTOM_TABS[tab].render()}</div> : <Editor key={tab} id={tab} cfg={CFG[tab]} refs={refs} />}
    </div>
  );
}
