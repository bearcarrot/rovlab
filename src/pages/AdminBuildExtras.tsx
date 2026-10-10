/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/toast";
import { explainDbError } from "@/lib/catalogAdmin";

// แท็บแอดมิน "ผูกบิลด์": เลือกสกิลชาเลนเจอร์ + พลังแฝง ให้บิลด์ที่มีอยู่ (ไม่แก้ไอเทม/รูนของบิลด์)
// บันทึกผ่าน RPC set_build_extras (ทำใน transaction เดียว และตรวจ is_admin() ที่ฐานข้อมูล)
const db: any = supabase;
type Row = Record<string, any>;
type Slot = { enchantment_id: string; selection_type: "primary" | "secondary" };

const ctl =
  "block w-full rounded-lg border border-border bg-bg-raised px-3 text-base text-text outline-none transition focus:border-accent focus:ring-1 focus:ring-accent sm:text-sm";
const inp = `${ctl} h-11`;
const btn =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

function EnchantSelect({ value, onChange, enchantments, trees, taken }: { value: string; onChange: (v: string) => void; enchantments: Row[]; trees: Row[]; taken: Set<string> }) {
  return (
    <select className={inp} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— เลือกพลังแฝง —</option>
      {trees.map((t) => (
        <optgroup key={t.id} label={t.name_th}>
          {enchantments
            .filter((e) => e.tree_id === t.id && (e.status !== "inactive" || e.id === value))
            .map((e) => (
              <option key={e.id} value={e.id} disabled={taken.has(e.id) && e.id !== value}>
                {e.name_th} · Tier {e.tier_level ?? "?"}{e.status !== "active" ? ` [${e.status}]` : ""}{e.verified_at ? "" : " (ยังไม่ยืนยัน)"}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

function BuildCard({ build, spells, enchantments, trees, onSaved }: { build: Row; spells: Row[]; enchantments: Row[]; trees: Row[]; onSaved: () => void }) {
  const toast = useToast();
  const initialSlots: Slot[] = useMemo(
    () =>
      [...(build.item_build_enchantments ?? [])]
        .sort((a: Row, b: Row) => (a.selection_type === b.selection_type ? a.sort_order - b.sort_order : a.selection_type === "primary" ? -1 : 1))
        .map((e: Row) => ({ enchantment_id: e.enchantment_id, selection_type: e.selection_type })),
    [build]
  );
  const [spellId, setSpellId] = useState<string>(build.challenger_spell_id ?? "");
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [busy, setBusy] = useState(false);
  const taken = useMemo(() => new Set(slots.map((s) => s.enchantment_id).filter(Boolean)), [slots]);
  const dirty = spellId !== (build.challenger_spell_id ?? "") || JSON.stringify(slots) !== JSON.stringify(initialSlots);

  const setSlot = (i: number, patch: Partial<Slot>) => setSlots((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  async function save() {
    if (slots.some((s) => !s.enchantment_id)) {
      toast.error("มีช่องพลังแฝงที่ยังไม่ได้เลือก — เลือกหรือลบช่องนั้น");
      return;
    }
    setBusy(true);
    const { error } = await db.rpc("set_build_extras", { p_build_id: build.id, p_spell_id: spellId || null, p_enchantments: slots });
    setBusy(false);
    if (error) {
      toast.error(`บันทึกไม่สำเร็จ: ${explainDbError(error)}`);
      return;
    }
    toast.success("บันทึกแล้ว");
    onSaved();
  }

  const group = (type: "primary" | "secondary", label: string) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-muted">{label}</span>
        <button type="button" className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-xs hover:border-text-faint" onClick={() => setSlots((xs) => [...xs, { enchantment_id: "", selection_type: type }])}>
          <Plus className="h-3.5 w-3.5" />เพิ่ม
        </button>
      </div>
      {slots.map((s, i) =>
        s.selection_type !== type ? null : (
          <div key={i} className="flex gap-2">
            <EnchantSelect value={s.enchantment_id} onChange={(v) => setSlot(i, { enchantment_id: v })} enchantments={enchantments} trees={trees} taken={taken} />
            <button type="button" aria-label="ลบช่อง" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-loss/40 text-loss hover:bg-loss/10" onClick={() => setSlots((xs) => xs.filter((_, j) => j !== i))}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )
      )}
    </div>
  );

  return (
    <div className="space-y-4 rounded-card border border-border bg-bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">Patch {build.patches?.code ?? "N/A"}</span>
        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted">{build.source}</span>
        <span className="text-xs text-text-faint">ไอเทม {build.n_items} · รูน {build.n_rune}</span>
      </div>
      <div>
        <span className="mb-1.5 block text-xs font-medium text-text-muted">สกิลชาเลนเจอร์</span>
        <select className={inp} value={spellId} onChange={(e) => setSpellId(e.target.value)}>
          <option value="">— ไม่ระบุ —</option>
          {spells.filter((sp) => sp.status !== "inactive" || sp.id === spellId).map((sp) => (
            <option key={sp.id} value={sp.id}>{sp.name_th} ({sp.name}){sp.status !== "active" ? ` [${sp.status}]` : ""}{sp.verified_at ? "" : " (ยังไม่ยืนยัน)"}</option>
          ))}
        </select>
      </div>
      {group("primary", "พลังแฝง — หลัก")}
      {group("secondary", "พลังแฝง — รอง")}
      <p className="text-xs text-text-faint">สิ่งที่เลือกเป็น Test Server หรือยังไม่ยืนยัน จะไม่ส่งให้ผู้ใช้เห็นในหน้า Item Build</p>
      <div className="flex justify-end">
        <button type="button" disabled={!dirty || busy} onClick={() => void save()} className={`${btn} bg-accent text-accent-fg hover:brightness-110`}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}บันทึก
        </button>
      </div>
    </div>
  );
}

export function AdminBuildExtras() {
  const toast = useToast();
  const [heroes, setHeroes] = useState<Row[]>([]);
  const [spells, setSpells] = useState<Row[]>([]);
  const [enchantments, setEnchantments] = useState<Row[]>([]);
  const [trees, setTrees] = useState<Row[]>([]);
  const [heroId, setHeroId] = useState("");
  const [builds, setBuilds] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    void (async () => {
      const [h, s, e, t] = await Promise.all([
        db.from("heroes").select("id,name,name_th").order("name_th"),
        db.from("challenger_spells").select("id,name,name_th,status,verified_at").order("sort_order"),
        db.from("enchantments").select("id,name_th,tree_id,tier_level,status,verified_at").order("sort_order"),
        db.from("enchantment_trees").select("id,name_th").order("sort_order"),
      ]);
      const err = h.error ?? s.error ?? e.error ?? t.error;
      if (err) toast.error(`โหลดข้อมูลไม่สำเร็จ: ${err.message}`);
      setHeroes(h.data ?? []);
      setSpells(s.data ?? []);
      setEnchantments(e.data ?? []);
      setTrees(t.data ?? []);
    })();
  }, [toast]);

  const load = useCallback(async () => {
    if (!heroId) {
      setBuilds([]);
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: e } = await db
      .from("item_builds")
      .select("id, source, challenger_spell_id, patches(code, released_at), item_build_items(id), item_build_rune(id), item_build_enchantments(enchantment_id, selection_type, sort_order)")
      .eq("hero_id", heroId);
    setLoading(false);
    if (e) {
      setError(e.message);
      return;
    }
    setBuilds(
      (data ?? [])
        .map((b: Row) => ({ ...b, n_items: (b.item_build_items ?? []).length, n_rune: (b.item_build_rune ?? []).length }))
        .sort((a: Row, b: Row) => String(b.patches?.released_at ?? "").localeCompare(String(a.patches?.released_at ?? "")))
    );
  }, [heroId, tick]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h2 className="font-display text-base font-semibold">ผูกสกิลชาเลนเจอร์และพลังแฝงกับบิลด์</h2>
        <p className="mt-1 text-sm text-text-muted">เลือกฮีโร่ แล้วกำหนดสกิล/พลังแฝงในแต่ละบิลด์ การบันทึกจะไม่แตะไอเทมและรูนของบิลด์</p>
      </div>
      <select className={inp} value={heroId} onChange={(e) => setHeroId(e.target.value)} aria-label="เลือกฮีโร่">
        <option value="">— เลือกฮีโร่ —</option>
        {heroes.map((h) => <option key={h.id} value={h.id}>{h.name_th} ({h.name})</option>)}
      </select>

      {error && (
        <div className="flex items-start gap-2 rounded-card border border-loss/40 bg-loss/5 p-4 text-sm text-loss">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">โหลดบิลด์ไม่สำเร็จ: {error}</span>
          <button type="button" className="underline" onClick={() => setTick((n) => n + 1)}>ลองอีกครั้ง</button>
        </div>
      )}
      {loading && <div className="flex items-center gap-2 text-sm text-text-muted"><Loader2 className="h-4 w-4 animate-spin" />กำลังโหลด...</div>}
      {heroId && !loading && !error && builds.length === 0 && (
        <p className="rounded-card border border-dashed border-border p-6 text-center text-sm text-text-muted">ฮีโร่นี้ยังไม่มีบิลด์ (สร้างบิลด์ได้ในแท็บ "แก้ไขข้อมูล")</p>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {builds.map((b) => (
          <BuildCard key={`${b.id}:${tick}`} build={b} spells={spells} enchantments={enchantments} trees={trees} onSaved={() => setTick((n) => n + 1)} />
        ))}
      </div>
    </div>
  );
}
