/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useIsAdmin } from "@/features/auth/useIsAdmin";
import { supabase } from "@/lib/supabase";

// ใช้ client แบบ untyped เพราะตารางถูกกำหนดแบบ config ด้านล่าง
const db: any = supabase;

type Row = Record<string, any>;
type RefType = "hero" | "item" | "arcana" | "patch";
type RefOpt = { id: string; label: string };
// text | num | date | sel(เลือกจาก opts) | hero/item/arcana/patch(เลือกจากตารางอื่น)
// | area(ข้อความยาว) | arr(หลายค่าคั่นด้วย ,) | img(รูป: วาง URL หรืออัปโหลดไฟล์)
type Col = {
  k: string;
  label?: string;
  type?: "text" | "num" | "date" | "sel" | "area" | "arr" | "img" | RefType;
  opts?: string[];
};
type Cfg = {
  label: string;
  table: string;
  order?: string;
  asc?: boolean;
  add?: boolean;
  search?: string;
  cols: Col[];
  // ตัวกรองด้านบน (เช่น เลือกฮีโร่/แพตช์/บิลด์) และตอนเพิ่มแถวจะใส่ค่านี้ให้อัตโนมัติ
  filter?: { col: string; table: string; sel: string; order?: string; label: (r: Row) => string };
};

const TIERS = ["S+", "S", "A", "B", "C"];
const SOURCES = ["curated", "heuristic"];
const REF_TYPES: string[] = ["hero", "item", "arcana", "patch"];
const BUCKET = "hero-icons";
const heroName = (r?: Row) => r?.name_th || r?.name || "?";
const heroFilter = (col: string): NonNullable<Cfg["filter"]> => ({
  col,
  table: "heroes",
  sel: "id,name,name_th",
  order: "name",
  label: heroName,
});

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
      { k: "role", type: "sel", opts: ["assassin", "fighter", "mage", "marksman", "support", "tank"] },
      { k: "lane", type: "sel", opts: ["slayer", "jungle", "mid", "abyssal", "support"] },
      { k: "difficulty", type: "sel", opts: ["easy", "medium", "hard"] },
      { k: "icon_url", label: "ไอคอน", type: "img" },
      { k: "description", type: "area" },
      { k: "strengths", type: "arr" },
      { k: "weaknesses", type: "arr" },
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
    cols: [{ k: "name" }, { k: "icon_url", label: "ไอคอน", type: "img" }, { k: "description", type: "area" }],
  },
  builds: {
    label: "บิลด์",
    table: "item_builds",
    add: true,
    filter: heroFilter("hero_id"),
    cols: [
      { k: "patch_id", label: "แพตช์", type: "patch" },
      { k: "source", type: "sel", opts: SOURCES },
      { k: "arcana_id", label: "ชุดรูน", type: "arcana" },
    ],
  },
  buildItems: {
    label: "ไอเทมในบิลด์",
    table: "item_build_items",
    order: "sort_order",
    add: true,
    filter: {
      col: "build_id",
      table: "item_builds",
      sel: "id,source,heroes(name,name_th),patches(code),arcana(name)",
      label: (r) => `${heroName(r.heroes)} · ${r.patches?.code ?? "?"} · ${r.source} · ${r.arcana?.name ?? "ไม่มีรูน"}`,
    },
    cols: [
      { k: "item_id", label: "ไอเทม", type: "item" },
      { k: "phase", type: "sel", opts: ["early", "core", "situational"] },
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

const inp =
  "w-full min-w-[80px] rounded-md border border-border bg-bg-surface px-2 py-1 text-sm outline-none focus:border-accent";

const toArr = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.map(String)
    : String(v ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
const norm = (c: Col, v: unknown) => (c.type === "arr" ? toArr(v).join("|") : String(v ?? ""));
const clean = (c: Col, v: unknown) =>
  c.type === "arr" ? toArr(v) : v === "" || v == null ? null : c.type === "num" ? Number(v) : v;

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
  if (c.type === "sel")
    return (
      <select className={inp} value={v ?? c.opts?.[0] ?? ""} onChange={(e) => change(e.target.value)}>
        {c.opts?.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
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
      <div className="flex min-w-[220px] items-center gap-1">
        {v ? <img src={v} alt="" className="h-8 w-8 shrink-0 rounded object-cover" /> : null}
        <input
          className={inp}
          placeholder="วาง URL หรือกดอัปโหลด"
          value={v ?? ""}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onCommit?.(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
        <label className="cursor-pointer whitespace-nowrap rounded-md border border-border px-2 py-1 text-xs">
          อัปโหลด
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
        className={inp + " min-w-[200px]"}
        rows={2}
        value={v ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onCommit?.(e.target.value)}
      />
    );
  return (
    <input
      className={inp}
      type={c.type === "num" ? "number" : c.type === "date" ? "date" : "text"}
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
  const [msg, setMsg] = useState("");
  const [draft, setDraft] = useState<Row>(blank);
  // ค่าที่บันทึกลง DB ล่าสุด ใช้เทียบว่ามีการแก้จริงหรือไม่
  const orig = useRef<Record<string, Row>>({});

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
    if (error) setMsg(error.message);
    else {
      const list = data as Row[];
      orig.current = Object.fromEntries(list.map((x) => [x.id, { ...x }]));
      setRows(list);
      setMsg(`${list.length} แถว · แก้แล้วบันทึกลงฐานข้อมูลอัตโนมัติ`);
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
      setMsg(`บันทึกไม่สำเร็จ (${c.k}): ${error.message}`);
    } else {
      orig.current[row.id] = { ...orig.current[row.id], [c.k]: val };
      setMsg(`บันทึก ${c.k} แล้ว ✓`);
    }
  }

  async function remove(row: Row) {
    if (!window.confirm("ลบแถวนี้?")) return;
    const { error } = await db.from(cfg.table).delete().eq("id", row.id);
    if (error) setMsg(error.message);
    else void load();
  }

  async function add() {
    const body: Row = {};
    for (const c of cfg.cols) body[c.k] = clean(c, draft[c.k]);
    if (cfg.filter) body[cfg.filter.col] = fv;
    const { error } = await db.from(cfg.table).insert(body);
    if (error) setMsg(error.message);
    else {
      setDraft(blank());
      setMsg("เพิ่มแล้ว ✓");
      void load();
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {cfg.filter && (
          <select className={inp + " !w-auto"} value={fv} onChange={(e) => setFv(e.target.value)}>
            {opts.map((o) => (
              <option key={o.id} value={o.id}>
                {cfg.filter!.label(o)}
              </option>
            ))}
          </select>
        )}
        {cfg.search && (
          <input className={inp + " !w-56"} placeholder="ค้นหาชื่อ..." value={q} onChange={(e) => setQ(e.target.value)} />
        )}
      </div>

      {cfg.add && (
        <div className="flex flex-wrap items-start gap-2 rounded-lg border border-dashed border-border p-2">
          {cfg.cols.map((c) => (
            <div key={c.k} className={c.type === "img" ? "w-64" : "w-40"}>
              <p className="pb-0.5 text-xs text-text-faint">{c.label ?? c.k}</p>
              <Cell
                c={c}
                v={draft[c.k]}
                refs={refs}
                folder={cfg.table}
                onChange={(v) => setDraft((d) => ({ ...d, [c.k]: v }))}
                onError={setMsg}
              />
            </div>
          ))}
          <button onClick={add} className="mt-4 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg">
            + เพิ่ม
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-text-muted">
              {cfg.cols.map((c) => (
                <th key={c.k} className="px-2 py-2 font-medium">
                  {c.label ?? c.k}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id} className="border-t border-border align-top">
                {cfg.cols.map((c) => (
                  <td key={c.k} className="px-2 py-1">
                    <Cell
                      c={c}
                      v={row[c.k]}
                      refs={refs}
                      folder={cfg.table}
                      onChange={(v) => edit(i, c.k, v)}
                      onCommit={(v) => void commit(row, c, v)}
                      onError={setMsg}
                    />
                  </td>
                ))}
                <td className="whitespace-nowrap px-2 py-1">
                  <button onClick={() => remove(row)} className="text-loss">
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-text-muted">{msg}</p>
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
    void Promise.all([
      opt("heroes", "id,name,name_th", "name", true, heroName),
      opt("items", "id,name,name_th", "name", true, heroName),
      opt("arcana", "id,name", "name", true, (r) => r.name),
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
      <div className="flex flex-wrap gap-2">
        {Object.entries(CFG).map(([k, c]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              k === tab ? "border-accent bg-accent text-accent-fg" : "border-border text-text-muted"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <Editor key={tab} cfg={CFG[tab]} refs={refs} />
    </div>
  );
}
