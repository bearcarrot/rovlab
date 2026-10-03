/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Check, ChevronDown, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { useIsAdmin } from "@/features/auth/useIsAdmin";
import { supabase } from "@/lib/supabase";
import { clearFilterIconsCache } from "@/services/filterIcons";

// ใช้ client แบบ untyped เพราะตารางถูกกำหนดแบบ config ด้านล่าง
const db: any = supabase;

type Row = Record<string, any>;
type RefType = "hero" | "item" | "arcana" | "patch";
type RefOpt = { id: string; label: string; color?: string };
// text | num | date | sel(เลือกจาก opts) | hero/item/arcana/patch(เลือกจากตารางอื่น)
// | area(ข้อความยาว) | arr(หลายค่าคั่นด้วย ,) | img(รูป: วาง URL หรืออัปโหลดไฟล์)
// | multi(เลือกได้หลายค่าจาก opts แบบปุ่ม ค่าแรก = ตัวหลัก)
type Col = {
  k: string;
  label?: string;
  type?: "text" | "num" | "date" | "sel" | "area" | "arr" | "img" | "multi" | RefType;
  opts?: string[];
  // แสดงอย่างเดียว แก้ไม่ได้ (เช่น รหัสตำแหน่งที่ผูกกับ CHECK ใน DB)
  ro?: boolean;
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
  cols: Col[];
  // แสดงสรุปจำนวนช่องรูนต่อสี (แดง/ม่วง/เขียว สีละไม่เกิน 10) ใช้กับแท็บรูนในบิลด์
  slots?: boolean;
  // ตัวกรองด้านบน (เช่น เลือกฮีโร่/แพตช์/บิลด์) และตอนเพิ่มแถวจะใส่ค่านี้ให้อัตโนมัติ
  filter?: { col: string; table: string; sel: string; order?: string; label: (r: Row) => string };
};
type Toast = { text: string; kind: "ok" | "err" } | null;

const TIERS = ["S+", "S", "A", "B", "C"];
const SOURCES = ["curated", "heuristic"];
const REF_TYPES: string[] = ["hero", "item", "arcana", "patch"];
const BUCKET = "hero-icons";
// หน้ารูนในเกมมี 30 ช่อง = แดง 10 + ม่วง 10 + เขียว 10
const MAX_SLOTS = 10;
const SLOT_COLORS = [
  { k: "red", label: "แดง", hex: "#ef4444" },
  { k: "purple", label: "ม่วง", hex: "#a855f7" },
  { k: "green", label: "เขียว", hex: "#22c55e" },
] as const;
// แอดมินเลือกฮีโร่ด้วยชื่ออังกฤษ (ตรงกับเกม) ใช้ชื่อไทยเป็นตัวสำรองเท่านั้น
const heroName = (r?: Row) => r?.name || r?.name_th || "?";
const heroFilter = (col: string): NonNullable<Cfg["filter"]> => ({
  col,
  table: "heroes",
  sel: "id,name,name_th",
  order: "name",
  label: heroName,
});
// ตัวเลือกบิลด์ (ใช้กับแท็บไอเทมในบิลด์และรูนในบิลด์)
const buildFilter: NonNullable<Cfg["filter"]> = {
  col: "build_id",
  table: "item_builds",
  sel: "id,source,heroes(name,name_th),patches(code),arcana(name)",
  label: (r) => `${heroName(r.heroes)} · ${r.patches?.code ?? "?"} · ${r.source}`,
};

const CFG: Record<string, Cfg> = {
  heroes: {
    label: "ฮีโร่",
    table: "heroes",
    order: "name",
    add: true,
    search: "name",
    cols: [
      { k: "slug" },
      { k: "name" },
      { k: "name_th" },
      // แตะเลือกได้หลายตัว ตัวแรกที่เลือก (★) = ตำแหน่ง/เลนหลัก ระบบซิงค์ไปที่คอลัมน์ role / lane ให้เอง
      { k: "roles", label: "ตำแหน่ง (เลือกได้หลายตัว · ★ = ตัวหลัก)", type: "multi", opts: ["assassin", "fighter", "mage", "marksman", "support", "tank"] },
      { k: "lanes", label: "เลน (เลือกได้หลายตัว · ★ = ตัวหลัก)", type: "multi", opts: ["slayer", "jungle", "mid", "abyssal", "support"] },
      { k: "difficulty", type: "sel", opts: ["easy", "medium", "hard"] },
      { k: "icon_url", label: "ไอคอน", type: "img" },
      { k: "description", type: "area" },
      { k: "strengths", type: "arr" },
      { k: "weaknesses", type: "arr" },
    ],
  },
  // ไอคอนของปุ่มตัวกรองตำแหน่ง/เลน (ทุกหน้าใช้ชุดเดียวกัน) ว่าง = แสดงเฉพาะข้อความ
  roleIcons: {
    label: "ไอคอนตำแหน่ง",
    table: "hero_roles",
    order: "sort_order",
    noDelete: true,
    cols: [
      { k: "label", label: "ตำแหน่ง", ro: true },
      { k: "code", label: "รหัส", ro: true },
      { k: "icon_url", label: "ไอคอน (เว้นว่าง = แสดงเฉพาะข้อความ)", type: "img" },
    ],
  },
  laneIcons: {
    label: "ไอคอนเลน",
    table: "hero_lanes",
    order: "sort_order",
    noDelete: true,
    cols: [
      { k: "label", label: "เลน", ro: true },
      { k: "code", label: "รหัส", ro: true },
      { k: "icon_url", label: "ไอคอน (เว้นว่าง = แสดงเฉพาะข้อความ)", type: "img" },
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
      { k: "icon_url", label: "ไอคอน", type: "img" },
      { k: "description", type: "area" },
      { k: "sort_order", type: "num" },
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
      { k: "stats", type: "arr" },
      { k: "passive", type: "area" },
      { k: "role_tags", type: "arr" },
      { k: "icon_url", label: "ไอคอน", type: "img" },
    ],
  },
  arcana: {
    label: "รูน",
    table: "arcana",
    order: "name",
    add: true,
    cols: [
      { k: "name" },
      { k: "color", label: "สี", type: "sel", opts: ["", "red", "purple", "green"] },
      { k: "icon_url", label: "ไอคอน", type: "img" },
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
      { k: "arcana_id", label: "รูนชุดเดียว (แบบเดิม)", type: "arcana" },
    ],
  },
  buildItems: {
    label: "ไอเทมในบิลด์",
    table: "item_build_items",
    order: "sort_order",
    add: true,
    filter: buildFilter,
    cols: [
      { k: "item_id", label: "ไอเทม", type: "item" },
      { k: "phase", type: "sel", opts: ["early", "core", "situational"] },
      { k: "reason", type: "area" },
      { k: "sort_order", type: "num" },
    ],
  },
  buildArcana: {
    label: "รูนในบิลด์",
    table: "item_build_arcana",
    order: "sort_order",
    add: true,
    slots: true,
    filter: buildFilter,
    cols: [
      { k: "arcana_id", label: "รูน", type: "arcana" },
      { k: "quantity", label: "จำนวน (x)", type: "num" },
      { k: "reason", type: "area" },
      { k: "sort_order", type: "num" },
    ],
  },
  stats: {
    label: "สถิติ",
    table: "hero_stats",
    add: true,
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
    cols: [
      { k: "hero_id", label: "ฮีโร่", type: "hero" },
      { k: "tier", type: "sel", opts: TIERS },
      { k: "reason", type: "area" },
    ],
    filter: {
      col: "tier_list_id",
      table: "tier_lists",
      sel: "id,rank_tier,lane,patches(code)",
      label: (r) => `${r.patches?.code ?? "?"} · ${r.rank_tier} · ${r.lane ?? "all"}`,
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
    order: "created_at",
    asc: false,
    add: true,
    cols: [
      { k: "slug" },
      { k: "title" },
      { k: "cover_url", label: "รูปปก", type: "img" },
      { k: "difficulty", type: "sel", opts: ["", "easy", "medium", "hard"] },
      { k: "reading_minutes", type: "num" },
      { k: "content", type: "area" },
    ],
  },
  guideCats: {
    label: "หมวดคู่มือ",
    table: "guide_categories",
    add: true,
    cols: [{ k: "slug" }, { k: "name_th" }],
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-text-muted">{label}</span>
      {children}
    </div>
  );
}

// ---------- helpers ----------

const toArr = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.map(String)
    : String(v ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
const isArrCol = (c: Col) => c.type === "arr" || c.type === "multi";
const norm = (c: Col, v: unknown) => (isArrCol(c) ? toArr(v).join("|") : String(v ?? ""));
const clean = (c: Col, v: unknown) =>
  isArrCol(c) ? toArr(v) : v === "" || v == null ? null : c.type === "num" ? Number(v) : v;

const show = (c: Col, v: any, refs: Record<string, RefOpt[]>) => {
  if (v == null || v === "" || c.type === "img") return "";
  if (c.type && REF_TYPES.includes(c.type)) return refs[c.type]?.find((o) => o.id === v)?.label ?? "";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
};
// หัวข้อ + คำอธิบายย่อ + รูป (ถ้ามี) ของแถว ตอนพับการ์ด
const summary = (cfg: Cfg, row: Row, refs: Record<string, RefOpt[]>) => {
  const parts = cfg.cols.map((c) => show(c, row[c.k], refs)).filter(Boolean);
  const imgCol = cfg.cols.find((c) => c.type === "img");
  return {
    title: parts[0] ?? "(ว่าง)",
    sub: parts.slice(1, 3).join(" · "),
    img: imgCol ? (row[imgCol.k] as string | null) : null,
  };
};

// รวมจำนวนช่องรูนต่อสีจากแถวของบิลด์ที่เลือก (อ่านจาก state จึงอัปเดตทันทีที่แก้จำนวน/เปลี่ยนรูน)
function summarizeSlots(rows: Row[], arcana: RefOpt[]) {
  const colorById = new Map(arcana.map((a) => [a.id, a.color]));
  const used: Record<string, number> = { red: 0, purple: 0, green: 0 };
  let uncolored = 0;
  for (const r of rows) {
    const n = Number(r.quantity) || 0;
    const color = colorById.get(r.arcana_id);
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
  if (c.type === "multi") {
    // ปุ่มสลับเลือก/ไม่เลือก เก็บลำดับตามที่กด ตัวแรก (★) = ตัวหลัก
    const sel = toArr(v);
    const toggle = (o: string) => change((sel.includes(o) ? sel.filter((x) => x !== o) : [...sel, o]).join(","));
    return (
      <div className="flex flex-wrap gap-2">
        {c.opts?.map((o) => {
          const idx = sel.indexOf(o);
          const on = idx >= 0;
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o)}
              className={`h-11 rounded-full border px-4 text-sm transition ${
                on
                  ? "border-accent bg-accent/15 font-medium text-accent"
                  : "border-border bg-bg-raised text-text-muted hover:border-text-faint"
              }`}
            >
              {o}
              {on && idx === 0 ? " ★" : ""}
            </button>
          );
        })}
      </div>
    );
  }
  if (c.type && REF_TYPES.includes(c.type))
    return (
      <select className={inp} value={v ?? ""} onChange={(e) => change(e.target.value)}>
        <option value="">— เลือก —</option>
        {(refs[c.type] ?? []).map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    );
  if (c.type === "img")
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {v ? (
            <img src={v} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-border object-cover" />
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

function Editor({ cfg, refs }: { cfg: Cfg; refs: Record<string, RefOpt[]> }) {
  const blank = () => Object.fromEntries(cfg.cols.filter((c) => c.type === "sel").map((c) => [c.k, c.opts?.[0]]));
  const [rows, setRows] = useState<Row[]>([]);
  const [opts, setOpts] = useState<Row[]>([]);
  const [fv, setFv] = useState("");
  const [q, setQ] = useState("");
  const [toast, setToast] = useState<Toast>(null);
  const [draft, setDraft] = useState<Row>(blank);
  const [showAdd, setShowAdd] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  // ค่าที่บันทึกลง DB ล่าสุด ใช้เทียบว่ามีการแก้จริงหรือไม่
  const orig = useRef<Record<string, Row>>({});

  const ok = (text: string) => setToast({ text, kind: "ok" });
  const err = (text: string) => setToast({ text, kind: "err" });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.kind === "err" ? 6000 : 2200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!cfg.filter) return;
    let r = db.from(cfg.filter.table).select(cfg.filter.sel);
    if (cfg.filter.order) r = r.order(cfg.filter.order);
    r.then(({ data }: { data: Row[] | null }) => {
      setOpts(data ?? []);
      setFv(data?.[0]?.id ?? "");
    });
  }, [cfg]);

  const load = useCallback(async () => {
    if (cfg.filter && !fv) return;
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
    const val = clean(c, v);
    const body: Row = { [c.k]: val };
    if (cfg.table === "heroes") body.updated_at = new Date().toISOString();
    const { error } = await db.from(cfg.table).update(body).eq("id", row.id);
    if (error) {
      err(`บันทึกไม่สำเร็จ (${c.k}): ${error.message}`);
    } else {
      orig.current[row.id] = { ...orig.current[row.id], [c.k]: val };
      // ไอคอนตัวกรองตำแหน่ง/เลนถูกแคชไว้ในแอป ล้างเพื่อให้หน้าถัดไปเห็นไอคอนใหม่
      if (cfg.table === "hero_roles" || cfg.table === "hero_lanes") clearFilterIconsCache();
      ok(`บันทึก ${c.label ?? c.k} แล้ว`);
    }
  }

  async function remove(row: Row) {
    const { error } = await db.from(cfg.table).delete().eq("id", row.id);
    setConfirmId(null);
    if (error) err(error.message);
    else {
      ok("ลบแล้ว");
      void load();
    }
  }

  async function add() {
    // ข้ามช่องที่ว่าง (รวมถึงลิสต์ว่าง) เพื่อให้ค่า default ของ DB ทำงาน (เช่น quantity = 10)
    const body: Row = {};
    for (const c of cfg.cols) {
      const val = clean(c, draft[c.k]);
      if (val !== null && !(Array.isArray(val) && val.length === 0)) body[c.k] = val;
    }
    if (cfg.filter) body[cfg.filter.col] = fv;
    const { error } = await db.from(cfg.table).insert(body);
    if (error) err(error.message);
    else {
      setDraft(blank());
      setShowAdd(false);
      ok("เพิ่มแล้ว");
      void load();
    }
  }

  // รอให้โหลดรายชื่อรูนก่อนค่อยคำนวณ ไม่งั้นจะขึ้นเตือนว่าไม่มีสีชั่วครู่
  const slotInfo = cfg.slots && (refs.arcana?.length ?? 0) > 0 ? summarizeSlots(rows, refs.arcana) : null;

  return (
    <div className="space-y-4 pb-24">
      {/* ตัวกรอง / ค้นหา: มือถือเรียงลง เดสก์ท็อปเรียงข้าง */}
      {(cfg.filter || cfg.search) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {cfg.filter && (
            <select className={`${inp} sm:w-auto sm:min-w-[18rem]`} value={fv} onChange={(e) => setFv(e.target.value)}>
              {opts.map((o) => (
                <option key={o.id} value={o.id}>
                  {cfg.filter!.label(o)}
                </option>
              ))}
            </select>
          )}
          {cfg.search && (
            <input
              className={`${inp} sm:w-64`}
              type="search"
              placeholder="ค้นหาชื่อ..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          )}
        </div>
      )}

      {/* จำนวนช่องรูนต่อสี (สีละ 10 ช่อง) — เตือนเท่านั้น ไม่ขวางการบันทึก */}
      {slotInfo && (
        <section aria-label="จำนวนช่องรูน" className="space-y-2 rounded-card border border-border bg-bg-surface p-3 shadow-card">
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

      {/* เพิ่มรายการ */}
      {cfg.add &&
        (showAdd ? (
          <section className="space-y-4 rounded-card border border-accent/40 bg-bg-surface p-4 shadow-card">
            <h2 className="font-display text-base font-semibold">เพิ่ม{cfg.label}</h2>
            <div className="space-y-3">
              {cfg.cols.map((c) => (
                <Field key={c.k} label={c.label ?? c.k}>
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

      <p className="text-xs text-text-muted">{rows.length} รายการ · แก้ไขแล้วบันทึกอัตโนมัติ</p>

      {/* รายการ: การ์ดพับได้ แตะเพื่อแก้ไข */}
      <div className="space-y-2">
        {rows.length === 0 && (
          <p className="rounded-card border border-dashed border-border p-6 text-center text-sm text-text-muted">
            ยังไม่มีข้อมูล
          </p>
        )}
        {rows.map((row, i) => {
          const open = openId === row.id;
          const { title, sub, img } = summary(cfg, row, refs);
          return (
            <article key={row.id} className="overflow-hidden rounded-card border border-border bg-bg-surface shadow-card">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => {
                  setOpenId(open ? null : row.id);
                  setConfirmId(null);
                }}
                className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-bg-raised"
              >
                {img ? (
                  <img src={img} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-border object-cover" />
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{title}</span>
                  {sub && <span className="block truncate text-xs text-text-muted">{sub}</span>}
                </span>
                <ChevronDown className={`h-5 w-5 shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
              </button>

              {open && (
                <div className="space-y-4 border-t border-border p-4">
                  <div className="space-y-3">
                    {cfg.cols.map((c) => (
                      <Field key={c.k} label={c.label ?? c.k}>
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

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className={`fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-card sm:inset-x-auto sm:right-6 sm:w-96 ${
            toast.kind === "ok"
              ? "border-win/40 bg-bg-raised text-win"
              : "border-loss/50 bg-bg-raised text-loss"
          }`}
        >
          {toast.kind === "ok" ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span className="min-w-0 break-words">{toast.text}</span>
        </div>
      )}
    </div>
  );
}

export function Admin() {
  const { user, loading } = useAuth();
  const { isAdmin, checking, error } = useIsAdmin();
  const [tab, setTab] = useState("heroes");
  const [refs, setRefs] = useState<Record<string, RefOpt[]>>({});

  // โหลดตัวเลือกสำหรับช่องที่อ้างอิงตารางอื่น (ฮีโร่/ไอเทม/รูน/แพตช์)
  useEffect(() => {
    if (!isAdmin) return;
    const opt = (table: string, sel: string, order: string, asc: boolean, label: (r: Row) => string) =>
      db
        .from(table)
        .select(sel)
        .order(order, { ascending: asc })
        .then(({ data }: { data: Row[] | null }) => (data ?? []).map((r) => ({ id: r.id as string, label: label(r) })));
    // รูนเก็บสีไว้ด้วย เพื่อใช้คำนวณจำนวนช่องต่อสีในแท็บ "รูนในบิลด์"
    const arcanaOpts = db
      .from("arcana")
      .select("id,name,color")
      .order("name", { ascending: true })
      .then(({ data }: { data: Row[] | null }) =>
        (data ?? []).map((r) => ({ id: r.id as string, label: r.name as string, color: (r.color ?? undefined) as string | undefined }))
      );
    void Promise.all([
      opt("heroes", "id,name,name_th", "name", true, heroName),
      // ไอเทมในบิลด์แสดงชื่ออังกฤษ (ตรงกับเกม/เว็บทางการ) ชื่อไทยใน DB เป็นการแปลเครื่อง
      opt("items", "id,name", "name", true, (r) => r.name ?? "?"),
      arcanaOpts,
      opt("patches", "id,code", "released_at", false, (r) => r.code),
    ]).then(([hero, item, arcana, patch]) => setRefs({ hero, item, arcana, patch }));
  }, [isAdmin]);

  if (loading || checking) return <p className="text-text-muted">กำลังตรวจสิทธิ์...</p>;
  if (!user)
    return (
      <p>
        ต้อง <Link to="/login" className="text-accent underline">เข้าสู่ระบบ</Link> ก่อน แล้วกลับมาที่ /admin
      </p>
    );
  if (!isAdmin) return <p className="text-loss">บัญชีนี้ไม่มีสิทธิ์แอดมิน {error && `(${error})`}</p>;

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-semibold">RoVLab Admin</h1>

      {/* แท็บ: มือถือเลื่อนแนวนอน เดสก์ท็อปขึ้นบรรทัดใหม่ */}
      <nav aria-label="ตาราง" className="overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max gap-2 md:w-auto md:flex-wrap">
          {Object.entries(CFG).map(([k, c]) => (
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
              {c.label}
            </button>
          ))}
        </div>
      </nav>

      <Editor key={tab} cfg={CFG[tab]} refs={refs} />
    </div>
  );
}
