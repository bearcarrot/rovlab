/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/toast";
import { explainDbError, verifyState, VERIFY_LABEL } from "@/lib/catalogAdmin";
import { BuildPicker, type BuildRow } from "./BuildPicker";
import { Thumb } from "./ImageSelect";

const db: any = supabase;

type Spell = {
  id: string;
  name: string;
  name_th: string;
  description: string;
  cooldown_seconds: number | null;
  status: string;
  icon_url: string | null;
  verified_at: string | null;
};

// สกิลชาเลนเจอร์ที่เลือกลงบิลด์ได้: เฉพาะที่ใช้งานอยู่ในเกมจริง (active / seasonal) เหมือนพลังแฝง
const PICKABLE = ["active", "seasonal"];

// แท็บ "สกิลชาเลนเจอร์ในบิลด์": 1 บิลด์ตั้งสกิลชาเลนเจอร์ได้ 1 อัน (item_builds.challenger_spell_id) แตะการ์ดเพื่อเลือก / แตะซ้ำที่อันเดิมหรือกด "ล้าง" เพื่อเอาออก
// แก้รายละเอียดของสกิล (ชื่อ ไอคอน คูลดาวน์) ได้ที่ "ฐานข้อมูลเกม" → สกิลชาเลนเจอร์
export function BuildSpellEditor() {
  const toast = useToast();
  const [spells, setSpells] = useState<Spell[]>([]);
  const [build, setBuild] = useState<BuildRow | null>(null);
  const [heroName, setHeroName] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [summary, setSummary] = useState<{ total: number; set: number } | null>(null);

  useEffect(() => {
    let alive = true;
    void db
      .from("challenger_spells")
      .select("id,name,name_th,description,cooldown_seconds,status,icon_url,verified_at")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
      .then(({ data, error }: { data: Spell[] | null; error: { message: string } | null }) => {
        if (!alive) return;
        if (error) toast.error(`โหลดสกิลชาเลนเจอร์ไม่สำเร็จ: ${error.message}`);
        setSpells(data ?? []);
      });
    return () => {
      alive = false;
    };
  }, [toast]);

  // สรุปทั้งระบบ: บิลด์ทั้งหมดกี่อัน ตั้งสกิลแล้วกี่อัน (ช่วยไล่ใส่ให้ครบ)
  useEffect(() => {
    let alive = true;
    void (async () => {
      const [all, withSpell] = await Promise.all([
        db.from("item_builds").select("id", { count: "exact", head: true }),
        db.from("item_builds").select("id", { count: "exact", head: true }).not("challenger_spell_id", "is", null),
      ]);
      if (alive && !all.error && !withSpell.error) setSummary({ total: all.count ?? 0, set: withSpell.count ?? 0 });
    })();
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const onBuild = useCallback((b: BuildRow | null, name: string) => {
    setBuild(b);
    setHeroName(name);
  }, []);

  async function setSpell(spellId: string | null) {
    if (!build || saving) return;
    setSaving(spellId ?? "clear");
    const { error } = await db.from("item_builds").update({ challenger_spell_id: spellId }).eq("id", build.id);
    setSaving(null);
    if (error) {
      toast.error(`บันทึกไม่สำเร็จ: ${explainDbError(error)}`);
      return;
    }
    toast.success(spellId ? "ตั้งสกิลชาเลนเจอร์แล้ว" : "ล้างสกิลชาเลนเจอร์แล้ว");
    setReloadKey((k) => k + 1);
  }

  const current = spells.find((s) => s.id === build?.challenger_spell_id) ?? null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-base font-semibold">สกิลชาเลนเจอร์ในบิลด์</h2>
        {summary && (
          <p className="mt-0.5 text-xs text-text-faint">
            ตั้งสกิลแล้ว {summary.set}/{summary.total} บิลด์
          </p>
        )}
      </div>

      <BuildPicker persistKey="admin:buildSpell" reloadKey={reloadKey} onBuild={onBuild} />

      {build && (
        <section className="space-y-3 rounded-card border border-border bg-bg-surface p-4">
          <p className="text-xs font-medium text-text-muted">
            {heroName} · {build.patchCode} · {build.source}
          </p>

          <div className="flex items-center gap-3 rounded-lg border border-border bg-bg-raised p-3">
            {current ? (
              <>
                <Thumb src={current.icon_url ?? undefined} label={current.name} round className="h-12 w-12" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {current.name} <span className="text-text-muted">· {current.name_th}</span>
                  </p>
                  <p className="text-xs text-text-faint">
                    {current.cooldown_seconds != null ? `คูลดาวน์ ${current.cooldown_seconds} วิ · ` : ""}
                    {VERIFY_LABEL[verifyState(current)]}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={saving !== null}
                  onClick={() => void setSpell(null)}
                  className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-loss/40 bg-loss/10 px-3 text-sm text-loss hover:bg-loss/20 disabled:opacity-50"
                >
                  {saving === "clear" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                  ล้าง
                </button>
              </>
            ) : (
              <p className="text-sm text-text-faint">บิลด์นี้ยังไม่ได้ตั้งสกิลชาเลนเจอร์</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {spells.map((s) => {
              const selected = s.id === build.challenger_spell_id;
              const pickable = PICKABLE.includes(s.status);
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={saving !== null || (!pickable && !selected)}
                  aria-pressed={selected}
                  title={pickable ? s.description : "สกิลนี้ยังไม่เปิดใช้ในเกมจริง (inactive / Test Server)"}
                  onClick={() => void setSpell(selected ? null : s.id)}
                  className={`flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-lg border bg-bg p-2 text-center transition hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-40 ${
                    selected ? "border-accent ring-2 ring-accent" : "border-border"
                  }`}
                >
                  {saving === s.id ? (
                    <Loader2 className="h-10 w-10 animate-spin text-text-faint" />
                  ) : (
                    <Thumb src={s.icon_url ?? undefined} label={s.name} round className="h-10 w-10" />
                  )}
                  <span className="w-full truncate text-xs font-medium leading-tight">{s.name}</span>
                  <span className="w-full truncate text-[10px] leading-tight text-text-faint">{s.name_th}</span>
                </button>
              );
            })}
            {spells.length === 0 && <p className="col-span-full py-4 text-center text-sm text-text-muted">ยังไม่มีสกิลชาเลนเจอร์ในฐานข้อมูล</p>}
          </div>
        </section>
      )}
    </div>
  );
}
