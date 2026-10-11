/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/toast";
import { usePersistedState } from "@/hooks/usePersistedState";
import { ImageSelect, type ImgOpt } from "./ImageSelect";

// ใช้ client แบบ untyped เหมือน Admin.tsx เพราะเลือกคอลัมน์แบบ config
const db: any = supabase;

export type BuildRow = {
  id: string;
  hero_id: string;
  source: string;
  patchCode: string;
  challenger_spell_id: string | null;
};

// ตัวเลือกฮีโร่ของแท็บสกิลชาเลนเจอร์/พลังแฝงในบิลด์ — เลือกฮีโร่แล้วใช้ "บิลด์ล่าสุดของฮีโร่นั้น" ให้อัตโนมัติ (ไม่มีช่องเลือกบิลด์)
// จำฮีโร่ที่เลือกไว้ตามแท็บ (รีเฟรชแล้วกลับมาที่เดิม) และโหลดบิลด์ใหม่ทุกครั้งที่ `reloadKey` เปลี่ยน
// บิลด์ล่าสุด = บิลด์ของแพตช์ที่ปล่อยล่าสุด (ถ้าแพตช์เดียวกันมีหลายบิลด์ ใช้อันที่ source = curated ก่อน)
export function BuildPicker({
  persistKey,
  reloadKey,
  onBuild,
}: {
  persistKey: string;
  reloadKey: number;
  onBuild: (build: BuildRow | null, heroName: string) => void;
}) {
  const toast = useToast();
  const [heroes, setHeroes] = useState<ImgOpt[]>([]);
  const [builds, setBuilds] = useState<BuildRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroId, setHeroId] = usePersistedState<string>(`${persistKey}:hero`, "");

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [h, b] = await Promise.all([
        db.from("heroes").select("id,name,name_th,icon_url").order("name", { ascending: true }),
        db.from("item_builds").select("id,hero_id,source,challenger_spell_id,patches(code,released_at)"),
      ]);
      if (!alive) return;
      if (h.error || b.error) toast.error(`โหลดบิลด์ไม่สำเร็จ: ${(h.error ?? b.error).message}`);
      setHeroes(
        ((h.data ?? []) as any[]).map((r) => ({ id: r.id, label: r.name || r.name_th || "?", icon: r.icon_url ?? undefined, alt: r.name_th ?? undefined }))
      );
      // ใหม่สุดขึ้นก่อน (code ของแพตช์เป็นข้อความ จึงเรียงตามวันที่ปล่อยแพตช์) แพตช์เดียวกัน curated ขึ้นก่อน
      const rows = ((b.data ?? []) as any[])
        .map((r) => ({
          id: r.id as string,
          hero_id: r.hero_id as string,
          source: r.source as string,
          patchCode: (r.patches?.code ?? "?") as string,
          released: (r.patches?.released_at ?? "") as string,
          challenger_spell_id: (r.challenger_spell_id ?? null) as string | null,
        }))
        .sort((x, y) => (y.released || "").localeCompare(x.released || "") || Number(y.source === "curated") - Number(x.source === "curated"));
      setBuilds(rows.map(({ released: _released, ...rest }) => rest));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const heroBuilds = useMemo(() => builds.filter((b) => b.hero_id === heroId), [builds, heroId]);
  const current = heroBuilds[0] ?? null;
  const heroName = heroes.find((h) => h.id === heroId)?.label ?? "";

  useEffect(() => {
    onBuild(current, heroName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, current?.challenger_spell_id, heroName]);

  return (
    <section className="space-y-2">
      <span className="block text-xs font-medium text-text-muted">ฮีโร่</span>
      <ImageSelect value={heroId} options={heroes} onChange={setHeroId} placeholder={loading ? "กำลังโหลด..." : "— เลือกฮีโร่ —"} clearable={false} />
      {heroId && !loading && heroBuilds.length === 0 && <p className="text-xs text-text-faint">ฮีโร่นี้ยังไม่มีบิลด์ สร้างได้ที่แท็บ "บิลด์" ก่อน</p>}
      {heroBuilds.length > 1 && (
        <p className="text-xs text-text-faint">ฮีโร่นี้มี {heroBuilds.length} บิลด์ กำลังแก้บิลด์แพตช์ล่าสุด ({current?.patchCode})</p>
      )}
    </section>
  );
}
