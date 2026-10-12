/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/toast";
import { explainDbError, verifyState, VERIFY_LABEL } from "@/lib/catalogAdmin";
import { SpellPicker, type SpellOpt } from "@/features/build/SpellPicker";
import { BuildPicker, type BuildRow } from "./BuildPicker";

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
// หน้าตาของตัวเลือกอยู่ที่ features/build/SpellPicker (ใช้ร่วมกับตัวสร้างบิลด์ของผู้ใช้) ไฟล์นี้ดูแลเฉพาะส่วนแอดมิน: โหลดสกิลและเขียน DB ทันที
// แก้รายละเอียดของสกิล (ชื่อ ไอคอน คูลดาวน์) ได้ที่ "ฐานข้อมูลเกม" → สกิลชาเลนเจอร์
// ส่ง build/heroName เข้ามา = โหมดควบคุม (ใช้ในหน้า Build Management ที่เลือกฮีโร่/บิลด์ไว้แล้ว ไม่แสดงช่องเลือกฮีโร่ซ้ำ)
// onChanged = แจ้งหน้าแม่ให้โหลดบิลด์ใหม่หลังบันทึก (challenger_spell_id เปลี่ยน)
export function BuildSpellEditor({ build: buildProp, heroName: heroNameProp, onChanged }: { build?: BuildRow | null; heroName?: string; onChanged?: () => void } = {}) {
  const controlled = buildProp !== undefined;
  const toast = useToast();
  const [spells, setSpells] = useState<Spell[]>([]);
  const [ownBuild, setBuild] = useState<BuildRow | null>(null);
  const [ownHeroName, setHeroName] = useState("");
  const build = controlled ? buildProp : ownBuild;
  const heroName = controlled ? (heroNameProp ?? "") : ownHeroName;
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
    onChanged?.();
  }

  const opts: SpellOpt[] = useMemo(
    () =>
      spells.map((s) => ({
        id: s.id,
        name: s.name,
        nameTh: s.name_th,
        description: s.description,
        cooldownSeconds: s.cooldown_seconds,
        icon: s.icon_url ?? undefined,
        pickable: PICKABLE.includes(s.status),
        note: VERIFY_LABEL[verifyState(s)],
      })),
    [spells]
  );

  return (
    <div className="space-y-4">
      <div>
        {!controlled && <h2 className="font-display text-base font-semibold">สกิลชาเลนเจอร์ในบิลด์</h2>}
        {summary && (
          <p className="mt-0.5 text-xs text-text-faint">
            ตั้งสกิลแล้ว {summary.set}/{summary.total} บิลด์
          </p>
        )}
      </div>

      {!controlled && <BuildPicker persistKey="admin:buildSpell" reloadKey={reloadKey} onBuild={onBuild} />}

      {build && (
        <section className="space-y-3 rounded-card border border-border bg-bg-surface p-3 sm:p-4">
          <p className="text-xs font-medium text-text-muted">
            {heroName} · {build.patchCode} · {build.source}
          </p>
          <SpellPicker
            spells={opts}
            value={build.challenger_spell_id ?? null}
            onChange={(id) => void setSpell(id)}
            busyId={saving}
            disabled={saving !== null}
            emptyCurrentText="บิลด์นี้ยังไม่ได้ตั้งสกิลชาเลนเจอร์"
          />
        </section>
      )}
    </div>
  );
}
