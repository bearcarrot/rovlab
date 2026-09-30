/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { supabase } from "@/lib/supabase";

// ใช้ client แบบ untyped เพราะตารางถูกกำหนดแบบ config ด้านล่าง
const db: any = supabase;

type Row = Record<string, any>;
type Col = { k: string; label?: string; type?: "text" | "num" | "date" | "sel" | "ro"; opts?: string[] };
type Cfg = {
  label: string;
  table: string;
  sel: string;
  order?: string;
  asc?: boolean;
  add?: boolean;
  search?: string;
  cols: Col[];
  filter?: { col: string; table: string; sel: string; label: (r: Row) => string };
};

const TIERS = ["S+", "S", "A", "B", "C"];

const CFG: Record<string, Cfg> = {
  heroes: {
    label: "ฮีโร่",
    table: "heroes",
    sel: "*",
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
      { k: "icon_url" },
      { k: "description" },
    ],
  },
  stats: {
    label: "สถิติ",
    table: "hero_stats",
    sel: "*,heroes(name_th)",
    cols: [
      { k: "heroes.name_th", label: "ฮีโร่", type: "ro" },
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
    sel: "*,heroes(name_th)",
    cols: [
      { k: "heroes.name_th", label: "ฮีโร่", type: "ro" },
      { k: "tier", type: "sel", opts: TIERS },
      { k: "reason" },
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
    sel: "*",
    order: "released_at",
    asc: false,
    add: true,
    cols: [{ k: "code" }, { k: "released_at", type: "date" }, { k: "notes" }],
  },
};

const inp =
  "w-full min-w-[80px] rounded-md border border-border bg-bg-surface px-2 py-1 text-sm outline-none focus:border-accent";

const get = (o: Row, path: string) => path.split(".").reduce<any>((a, b) => a?.[b], o);
const clean = (c: Col, v: unknown) => (v === "" || v == null ? null : c.type === "num" ? Number(v) : v);

// onCommit: เรียกเมื่อแก้เสร็จ (select = ทันทีที่เลือก, input = ตอนกดออกจากช่อง) ใช้เพื่อบันทึกลง DB อัตโนมัติ
function Cell({
  c,
  v,
  onChange,
  onCommit,
}: {
  c: Col;
  v: any;
  onChange: (v: string) => void;
  onCommit?: (v: string) => void;
}) {
  if (c.type === "ro") return <span className="whitespace-nowrap">{v ?? ""}</span>;
  if (c.type === "sel")
    return (
      <select
        className={inp}
        value={v ?? c.opts?.[0]}
        onChange={(e) => {
          onChange(e.target.value);
          onCommit?.(e.target.value);
        }}
      >
        {c.opts?.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    );
  return (
    <input
      className={inp}
      type={c.type === "num" ? "number" : c.type === "date" ? "date" : "text"}
      step={c.type === "num" ? "any" : undefined}
      value={v ?? ""}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onCommit?.(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

function Editor({ cfg }: { cfg: Cfg }) {
  const editable = cfg.cols.filter((c) => c.type !== "ro");
  const blank = () => Object.fromEntries(editable.filter((c) => c.type === "sel").map((c) => [c.k, c.opts?.[0]]));
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
    db.from(cfg.filter.table)
      .select(cfg.filter.sel)
      .then(({ data }: { data: Row[] | null }) => {
        setOpts(data ?? []);
        setFv(data?.[0]?.id ?? "");
      });
  }, [cfg]);

  const load = useCallback(async () => {
    if (cfg.filter && !fv) return;
    let r = db.from(cfg.table).select(cfg.sel);
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
    const before = orig.current[row.id]?.[c.k];
    if (String(before ?? "") === v) return; // ไม่มีอะไรเปลี่ยน
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
    for (const c of editable) body[c.k] = clean(c, draft[c.k]);
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
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-2">
          {editable.map((c) => (
            <div key={c.k} className="w-36">
              <Cell c={c} v={draft[c.k]} onChange={(v) => setDraft((d) => ({ ...d, [c.k]: v }))} />
            </div>
          ))}
          <button onClick={add} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg">
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
              <tr key={row.id} className="border-t border-border">
                {cfg.cols.map((c) => (
                  <td key={c.k} className="px-2 py-1">
                    <Cell
                      c={c}
                      v={get(row, c.k)}
                      onChange={(v) => edit(i, c.k, v)}
                      onCommit={(v) => void commit(row, c, v)}
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
  const [ok, setOk] = useState<boolean | null>(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("heroes");

  useEffect(() => {
    if (!user) return;
    db.rpc("is_admin").then(({ data, error }: { data: boolean | null; error: { message: string } | null }) => {
      if (error) setErr(error.message);
      setOk(Boolean(data));
    });
  }, [user]);

  if (loading) return <p className="text-text-muted">กำลังโหลด...</p>;
  if (!user)
    return (
      <p>
        ต้อง <Link to="/login" className="text-accent underline">เข้าสู่ระบบ</Link> ก่อน แล้วกลับมาที่ /admin
      </p>
    );
  if (ok === null) return <p className="text-text-muted">กำลังตรวจสิทธิ์...</p>;
  if (!ok)
    return (
      <p className="text-loss">
        บัญชีนี้ไม่มีสิทธิ์แอดมิน {err && `(${err})`}
      </p>
    );

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
      <Editor key={tab} cfg={CFG[tab]} />
    </div>
  );
}
