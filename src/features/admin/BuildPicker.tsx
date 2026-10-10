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

// ตัวเลือก "ฮีโร่ → บิลด์" ที่ใช้ร่วมกันในแท็บสกิลชาเลนเจอร์/พลังแฝงในบิลด์
// จำฮีโร่และบิลด์ที่เลือกไว้ตามแท็บ (รีเฟรชแล้วกลับมาที่เดิม) และโหลดบิลด์ใหม่ทุกครั้งที่ `reloadKey` เปลี่ยน
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
  const [buildId, setBuildId] = usePersistedState<string>(`${persistKey}:build`, "");

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
      // แพตช์ใหม่สุดขึ้นก่อน (code เป็นข้อความ จึงเรียงตามวันที่ปล่อยแพตช์)
      const rows = ((b.data ?? []) as any[])
        .map((r) => ({
          id: r.id as string,
          hero_id: r.hero_id as string,
          source: r.source as string,
          patchCode: (r.patches?.code ?? "?") as string,
          released: (r.patches?.released_at ?? "") as string,
          challenger_spell_id: (r.challenger_spell_id ?? null) as string | null,
        }))
        .sort((x, y) => (y.released || "").localeCompare(x.released || ""));
      setBuilds(rows.map(({ released: _released, ...rest }) => rest));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const heroBuilds = useMemo(() => builds.filter((b) => b.hero_id === heroId), [builds, heroId]);
  const current = heroBuilds.find((b) => b.id === buildId) ?? null;
  const heroName = heroes.find((h) => h.id === heroId)?.label ?? "";

  // ฮีโร่เปลี่ยนแล้วบิลด์ที่จำไว้ไม่ใช่ของฮีโร่นี้ → เลือกบิลด์ล่าสุดของฮีโร่นี้ให้เอง
  useEffect(() => {
    if (loading || !heroId) return;
    if (!heroBuilds.some((b) => b.id === buildId)) setBuildId(heroBuilds[0]?.id ?? "");
  }, [loading, heroId, heroBuilds, buildId, setBuildId]);

  useEffect(() => {
    onBuild(current, heroName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, current?.challenger_spell_id, heroName]);

  return (
    <section className="space-y-3 rounded-card border border-border bg-bg-surface p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <span className="mb-1.5 block text-xs font-medium text-text-muted">ฮีโร่</span>
          <ImageSelect value={heroId} options={heroes} onChange={setHeroId} placeholder={loading ? "กำลังโหลด..." : "— เลือกฮีโร่ —"} clearable={false} />
        </div>
        <div className="min-w-0">
          <span className="mb-1.5 block text-xs font-medium text-text-muted">บิลด์ (แพตช์ · แหล่งที่มา)</span>
          <select
            value={current?.id ?? ""}
            onChange={(e) => setBuildId(e.target.value)}
            disabled={!heroId || heroBuilds.length === 0}
            className="block h-11 w-full rounded-lg border border-border bg-bg-raised px-3 text-base text-text outline-none transition focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50 sm:text-sm"
          >
            {heroBuilds.length === 0 && <option value="">{heroId ? "ฮีโร่นี้ยังไม่มีบิลด์" : "เลือกฮีโร่ก่อน"}</option>}
            {heroBuilds.map((b) => (
              <option key={b.id} value={b.id}>
                {b.patchCode} · {b.source}
              </option>
            ))}
          </select>
        </div>
      </div>
      {heroId && heroBuilds.length === 0 && !loading && (
        <p className="text-xs text-text-faint">สร้างบิลด์ของฮีโร่นี้ได้ที่แท็บ "บิลด์" ก่อน</p>
      )}
    </section>
  );
}
