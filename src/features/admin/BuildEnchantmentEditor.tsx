/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/toast";
import { explainDbError } from "@/lib/catalogAdmin";
import type { EnchOpt, SelectionType } from "@/lib/enchantmentRules";
import { EnchantmentBoard, type BoardRow, type RemoveContext } from "@/features/build/EnchantmentBoard";
import { BuildPicker, type BuildRow } from "./BuildPicker";
import { TreeIconEditor } from "./TreeIconEditor";

const db: any = supabase;

type Tree = { id: string; slug: string; name: string; name_th: string; icon_url: string | null };

// ข้อความ error ของ trigger (23514) เป็นภาษาไทยอธิบายกติกาอยู่แล้ว แสดงตามนั้น; 23505 ในตารางนี้ = ช่องซ้ำหรือเลือกตัวเดิมซ้ำ
const explain = (e: { code?: string; message: string }) =>
  e.code === "23514" ? e.message : e.code === "23505" ? "ช่องนี้ถูกใช้แล้วหรือเลือกพลังแฝงซ้ำ ลองรีเฟรชแล้วทำใหม่" : explainDbError(e);

// แท็บ "พลังแฝงในบิลด์": หน้าตาและกติกาอยู่ที่ features/build/EnchantmentBoard (ใช้ร่วมกับตัวสร้างบิลด์ของผู้ใช้)
// ไฟล์นี้ดูแลเฉพาะส่วนของแอดมิน: โหลดแคตตาล็อก + แถวของบิลด์จาก DB, เขียน item_build_enchantments ทันทีทุกครั้งที่แก้, และอัปโหลดไอคอนสาย
// กติกาอยู่ที่ src/lib/enchantmentRules.ts และ trigger ใน migration 20261011
// ส่ง build/heroName เข้ามา = โหมดควบคุม (หน้า Build Management เลือกฮีโร่/บิลด์ไว้แล้ว ไม่แสดงช่องเลือกฮีโร่ซ้ำ)
export function BuildEnchantmentEditor({ build: buildProp, heroName: heroNameProp }: { build?: BuildRow | null; heroName?: string } = {}) {
  const controlled = buildProp !== undefined;
  const toast = useToast();
  const [trees, setTrees] = useState<Tree[]>([]);
  const [options, setOptions] = useState<EnchOpt[]>([]);
  const [ownBuild, setBuild] = useState<BuildRow | null>(null);
  const [ownHeroName, setHeroName] = useState("");
  const build = controlled ? buildProp : ownBuild;
  const heroName = controlled ? (heroNameProp ?? "") : ownHeroName;
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // แคตตาล็อกพลังแฝงโหลดครั้งเดียว (รวม inactive ไว้ด้วย เพื่อแสดงบิลด์เดิมที่อ้างถึงได้ครบ แต่เลือกใหม่ไม่ได้)
  useEffect(() => {
    let alive = true;
    void Promise.all([
      db.from("enchantment_trees").select("id,slug,name,name_th,icon_url").order("sort_order", { ascending: true }),
      db
        .from("enchantments")
        .select("id,name,name_th,tree_id,tier_level,status,icon_url,verified_at")
        .order("tier_level", { ascending: true })
        .order("sort_order", { ascending: true }),
    ]).then(([t, e]) => {
      if (!alive) return;
      if (t.error || e.error) toast.error(`โหลดพลังแฝงไม่สำเร็จ: ${(t.error ?? e.error).message}`);
      setTrees((t.data ?? []) as Tree[]);
      setOptions(
        ((e.data ?? []) as any[]).map((r) => ({
          id: r.id,
          name: r.name,
          nameTh: r.name_th,
          treeId: r.tree_id,
          tier: r.tier_level ?? null,
          status: r.status,
          icon: r.icon_url ?? undefined,
          verified: !!r.verified_at,
        }))
      );
    });
    return () => {
      alive = false;
    };
  }, [toast]);

  const onBuild = useCallback((b: BuildRow | null, name: string) => {
    setBuild(b);
    setHeroName(name);
  }, []);

  // แถวพลังแฝงของบิลด์ที่เลือก
  useEffect(() => {
    if (!build) {
      setRows([]);
      return;
    }
    let alive = true;
    setLoadingRows(true);
    void db
      .from("item_build_enchantments")
      .select("id,enchantment_id,selection_type,sort_order")
      .eq("build_id", build.id)
      .then(({ data, error }: { data: BoardRow[] | null; error: { message: string } | null }) => {
        if (!alive) return;
        if (error) toast.error(`โหลดพลังแฝงของบิลด์ไม่สำเร็จ: ${error.message}`);
        setRows(data ?? []);
        setLoadingRows(false);
      });
    return () => {
      alive = false;
    };
  }, [build?.id, reloadKey, toast]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(job: () => PromiseLike<{ error: { code?: string; message: string } | null }>, okMsg: string): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    const { error } = await job();
    setBusy(false);
    if (error) {
      toast.error(`บันทึกไม่สำเร็จ: ${explain(error)}`);
      return false;
    }
    toast.success(okMsg);
    setReloadKey((k) => k + 1);
    return true;
  }

  const onPick = (type: SelectionType, slot: number, opt: EnchOpt, existing: BoardRow | undefined) =>
    existing
      ? run(() => db.from("item_build_enchantments").update({ enchantment_id: opt.id }).eq("id", existing.id), "เปลี่ยนพลังแฝงแล้ว")
      : run(
          () => db.from("item_build_enchantments").insert({ build_id: build!.id, enchantment_id: opt.id, selection_type: type, sort_order: slot }),
          "เพิ่มพลังแฝงแล้ว"
        );

  const onRemove = (row: BoardRow, ctx?: RemoveContext) =>
    run(() => db.from("item_build_enchantments").delete().eq("id", row.id), ctx === "tree" ? "เปลี่ยนสีแล้ว" : "เอาพลังแฝงออกแล้ว");

  const onClearType = (type: SelectionType, ctx?: RemoveContext) =>
    run(
      () => db.from("item_build_enchantments").delete().eq("build_id", build!.id).eq("selection_type", type),
      ctx === "tree" ? "เปลี่ยนสีสายหลักแล้ว" : `ล้าง${type === "primary" ? "สายหลัก" : "สายรอง"}แล้ว`
    );

  return (
    <div className="space-y-4">
      {!controlled && <h2 className="font-display text-base font-semibold">พลังแฝงในบิลด์</h2>}

      <TreeIconEditor trees={trees} onSaved={(id, url) => setTrees((ts) => ts.map((t) => (t.id === id ? { ...t, icon_url: url } : t)))} />

      {!controlled && <BuildPicker persistKey="admin:buildEnchant" reloadKey={0} onBuild={onBuild} />}

      {build && (
        <EnchantmentBoard
          trees={trees}
          options={options}
          rows={rows}
          busy={busy}
          resetKey={build.id}
          header={
            <p className="flex items-center gap-2 text-xs font-medium text-text-muted">
              {heroName} · แพตช์ {build.patchCode}
              {(loadingRows || busy) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            </p>
          }
          onPick={onPick}
          onRemove={onRemove}
          onClearType={onClearType}
        />
      )}
    </div>
  );
}
