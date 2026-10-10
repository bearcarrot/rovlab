// Pure helpers for the Admin Game Database Manager (items / rune / challenger_spells / enchantments).
// No React / Supabase here so validation and payload building stay easy to review and test.

export type CatalogKind = "items" | "rune" | "spells" | "enchantments";

export const TABLE: Record<CatalogKind, string> = {
  items: "items",
  rune: "rune",
  spells: "challenger_spells",
  enchantments: "enchantments",
};

export const STATUSES = [
  { value: "active", label: "ใช้งานอยู่ (Active)" },
  { value: "seasonal", label: "ตามซีซัน (Seasonal)" },
  { value: "test_server", label: "Test Server" },
  { value: "inactive", label: "ไม่ใช้งาน (Inactive)" },
] as const;
export const ENCH_CATEGORIES = [
  { value: "standard", label: "standard" },
  { value: "keystone", label: "keystone" },
  { value: "seasonal", label: "seasonal" },
  { value: "test_server", label: "test_server" },
];
export const RUNE_COLORS = [
  { value: "red", label: "แดง" },
  { value: "purple", label: "ม่วง" },
  { value: "green", label: "เขียว" },
];
export const ITEM_TYPES = [
  { value: "physical", label: "โจมตี" },
  { value: "magic", label: "เวท" },
  { value: "defense", label: "ป้องกัน" },
  { value: "boots", label: "เคลื่อนที่" },
  { value: "jungle", label: "ป่า" },
  { value: "support", label: "ซัพพอร์ต" },
];

export type VerifyState = "verified" | "needs" | "test" | "inactive";

// test_server / inactive take priority: test-server content is never shown as confirmed live data,
// even if someone verified it. NULL verified_at = needs verification (never auto-verified).
export function verifyState(row: { status?: string | null; verified_at?: string | null }): VerifyState {
  if (row.status === "test_server") return "test";
  if (row.status === "inactive") return "inactive";
  return row.verified_at ? "verified" : "needs";
}

export const VERIFY_LABEL: Record<VerifyState, string> = {
  verified: "ยืนยันกับเกมจริงแล้ว",
  needs: "รอตรวจสอบ",
  test: "Test Server (ยังไม่ใช่เกมจริง)",
  inactive: "ไม่ใช้งาน / Legacy",
};

export type Form = Record<string, string>;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isUrl = (s: string) => {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};
const isInt = (s: string) => /^-?\d+$/.test(s.trim());

export function validate(kind: CatalogKind, f: Form): Record<string, string> {
  const e: Record<string, string> = {};
  const t = (k: string) => (f[k] ?? "").trim();
  if (!t("name")) e.name = "ต้องกรอกชื่ออังกฤษ";
  else if (t("name").length > 100) e.name = "ยาวเกิน 100 ตัวอักษร";
  if (kind !== "rune") {
    if (!t("name_th")) e.name_th = "ต้องกรอกชื่อไทย";
    else if (t("name_th").length > 100) e.name_th = "ยาวเกิน 100 ตัวอักษร";
    if (!t("slug")) e.slug = "ต้องกรอก slug";
    else if (!SLUG.test(t("slug"))) e.slug = "ใช้ได้เฉพาะ a-z, 0-9 และขีดกลาง เช่น seed-of-darkness";
  }
  if (t("icon_url") && !isUrl(t("icon_url"))) e.icon_url = "ต้องเป็น URL ที่ขึ้นต้นด้วย http:// หรือ https://";
  if (t("source_url") && !isUrl(t("source_url"))) e.source_url = "ต้องเป็น URL ที่ขึ้นต้นด้วย http:// หรือ https://";
  if (t("description").length > 2000) e.description = "ยาวเกิน 2000 ตัวอักษร";
  if (t("passive").length > 2000) e.passive = "ยาวเกิน 2000 ตัวอักษร";

  if (kind === "items") {
    if (!t("cost") || !isInt(t("cost")) || Number(t("cost")) < 0) e.cost = "ราคาต้องเป็นจำนวนเต็ม ≥ 0";
    if (t("tier") && !["1", "2", "3"].includes(t("tier"))) e.tier = "Tier ต้องเป็น 1–3";
  }
  if (kind === "rune" && t("color") && !RUNE_COLORS.some((c) => c.value === t("color"))) e.color = "สีไม่ถูกต้อง";
  if (kind === "spells" || kind === "enchantments") {
    if (!STATUSES.some((s) => s.value === t("status"))) e.status = "เลือกสถานะ";
    if (t("sort_order") && !isInt(t("sort_order"))) e.sort_order = "ต้องเป็นจำนวนเต็ม";
  }
  if (kind === "spells" && t("cooldown_seconds") && (!isInt(t("cooldown_seconds")) || Number(t("cooldown_seconds")) < 0)) {
    e.cooldown_seconds = "คูลดาวน์ต้องเป็นจำนวนเต็ม ≥ 0 (วินาที)";
  }
  if (kind === "enchantments") {
    if (!t("tree_id")) e.tree_id = "เลือกสาย (Tree)";
    if (t("tier_level") && !["1", "2", "3"].includes(t("tier_level"))) e.tier_level = "Tier ต้องเป็น 1–3";
    if (!ENCH_CATEGORIES.some((c) => c.value === t("category"))) e.category = "เลือกประเภท";
  }
  return e;
}

const nul = (s: string | undefined) => (s ?? "").trim() || null;
const lines = (s: string | undefined) => (s ?? "").split("\n").map((x) => x.trim()).filter(Boolean);

// Only editable columns are sent, so other columns (e.g. items.patch_id) are preserved on update.
export function toPayload(kind: CatalogKind, f: Form): Record<string, unknown> {
  const t = (k: string) => (f[k] ?? "").trim();
  if (kind === "items") {
    return {
      slug: t("slug"), name: t("name"), name_th: t("name_th"), cost: Number(t("cost")),
      tier: t("tier") ? Number(t("tier")) : null,
      role_tags: (f.role_tags ?? "").split(",").map((x) => x.trim()).filter(Boolean),
      stats: lines(f.stats), passive: nul(f.passive), icon_url: nul(f.icon_url),
    };
  }
  if (kind === "rune") {
    return { name: t("name"), color: nul(f.color), description: nul(f.description), icon_url: nul(f.icon_url) };
  }
  if (kind === "spells") {
    return {
      slug: t("slug"), name: t("name"), name_th: t("name_th"), description: t("description"),
      cooldown_seconds: t("cooldown_seconds") ? Number(t("cooldown_seconds")) : null,
      status: t("status"), icon_url: nul(f.icon_url), source_url: nul(f.source_url),
      sort_order: t("sort_order") ? Number(t("sort_order")) : 0,
    };
  }
  return {
    slug: t("slug"), tree_id: t("tree_id"), name: t("name"), name_th: t("name_th"), description: t("description"),
    tier_level: t("tier_level") ? Number(t("tier_level")) : null,
    category: t("category"), status: t("status"), icon_url: nul(f.icon_url), source_url: nul(f.source_url),
    sort_order: t("sort_order") ? Number(t("sort_order")) : 0,
  };
}

export function toForm(kind: CatalogKind, row: Record<string, any> | null): Form {
  const s = (v: unknown) => (v == null ? "" : String(v));
  const r = row ?? {};
  if (kind === "items") {
    return {
      slug: s(r.slug), name: s(r.name), name_th: s(r.name_th), cost: s(r.cost), tier: s(r.tier),
      role_tags: Array.isArray(r.role_tags) ? r.role_tags.join(",") : "",
      stats: Array.isArray(r.stats) ? r.stats.join("\n") : "", passive: s(r.passive), icon_url: s(r.icon_url),
    };
  }
  if (kind === "rune") return { name: s(r.name), color: s(r.color), description: s(r.description), icon_url: s(r.icon_url) };
  if (kind === "spells") {
    return {
      slug: s(r.slug), name: s(r.name), name_th: s(r.name_th), description: s(r.description),
      cooldown_seconds: s(r.cooldown_seconds), status: s(r.status) || "active", icon_url: s(r.icon_url),
      source_url: s(r.source_url), sort_order: s(r.sort_order) || "0",
    };
  }
  return {
    slug: s(r.slug), tree_id: s(r.tree_id), name: s(r.name), name_th: s(r.name_th), description: s(r.description),
    tier_level: s(r.tier_level), category: s(r.category) || "standard", status: s(r.status) || "active",
    icon_url: s(r.icon_url), source_url: s(r.source_url), sort_order: s(r.sort_order) || "0",
  };
}

// Friendly Thai message for common Postgres / PostgREST errors.
export function explainDbError(err: { code?: string; message: string }): string {
  if (err.code === "23505") return "slug นี้ถูกใช้แล้ว เลือก slug อื่น";
  if (err.code === "42501") return "ไม่มีสิทธิ์ทำรายการนี้ (ต้องเป็นแอดมิน)";
  if (err.code === "23503") return "ยังมีข้อมูลอื่นอ้างอิงรายการนี้อยู่";
  if (err.code === "23514") return "ค่าที่กรอกไม่ผ่านเงื่อนไขของฐานข้อมูล";
  return err.message;
}
