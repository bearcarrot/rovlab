import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { BuildSpellEditor } from "@/features/admin/BuildSpellEditor";
import { fetchBuildRows, type BuildRow } from "@/features/admin/BuildPicker";
import { ImageSelect } from "@/features/admin/ImageSelect";
import { BuildEnchantmentEditor } from "@/features/admin/BuildEnchantmentEditor";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useToast } from "@/components/ui/toast";
import { Row, RefOpt, heroName, CFG } from "@/features/admin/adminConfig";
import { summary, Editor } from "@/features/admin/AdminEditor";

// หน้า "บิลด์" (Build Management): เลือกฮีโร่ + บิลด์ครั้งเดียว แล้วแก้ข้อมูลบิลด์ ไอเทม รูน สกิลชาเลนเจอร์ พลังแฝงได้ในหน้าเดียว
// ตัวแก้ไขแต่ละส่วนยังเป็นตัวเดิม (ตารางและกติกาเดิม) แค่รับฮีโร่/บิลด์จากตัวเลือกด้านบนแทนการเลือกซ้ำในแต่ละแท็บ
function Section({ title, hint, open, children }: { title: string; hint?: string; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="group rounded-card border border-border bg-bg-surface">
      <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-semibold sm:px-4 [&::-webkit-details-marker]:hidden">
        <ChevronDown className="h-4 w-4 shrink-0 text-text-faint transition group-open:rotate-180" />
        {title}
        {hint && <span className="hidden text-xs font-normal text-text-faint sm:inline">{hint}</span>}
      </summary>
      <div className="border-t border-border p-2 sm:p-4">{children}</div>
    </details>
  );
}

export function BuildManagementView({ refs }: { refs: Record<string, RefOpt[]> }) {
  const toast = useToast();
  const [heroId, setHeroId] = usePersistedState<string>("admin:bm:hero", "");
  const [buildSaved, setBuildId] = usePersistedState<string>("admin:bm:build", "");
  const [builds, setBuilds] = useState<BuildRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    void fetchBuildRows().then(({ rows, error }) => {
      if (!alive) return;
      if (error) toast.error(`โหลดบิลด์ไม่สำเร็จ: ${error.message}`);
      setBuilds(rows);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [tick, toast]);

  const heroBuilds = useMemo(() => builds.filter((b) => b.hero_id === heroId), [builds, heroId]);
  // บิลด์ที่เลือก = ค่าที่จำไว้ถ้ายังเป็นของฮีโร่นี้ ไม่งั้นใช้บิลด์แพตช์ล่าสุด
  const current = heroBuilds.find((b) => b.id === buildSaved) ?? heroBuilds[0] ?? null;
  const heroLabel = (refs.hero ?? []).find((h) => h.id === heroId)?.label ?? "";
  // สร้าง/ลบบิลด์ในส่วน "ข้อมูลบิลด์" แล้วรายการบิลด์ด้านบนต้องตามทัน
  const onBuildRows = useCallback(
    (rows: Row[]) => {
      if (rows.length !== heroBuilds.length || rows.some((r) => !heroBuilds.some((b) => b.id === r.id))) reload();
    },
    [heroBuilds, reload]
  );

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <span className="block text-xs font-medium text-text-muted">ฮีโร่</span>
        <ImageSelect
          value={heroId}
          options={refs.hero ?? []}
          onChange={setHeroId}
          placeholder={loading ? "กำลังโหลด..." : "— เลือกฮีโร่ —"}
          clearable={false}
        />
        {heroBuilds.length > 0 && (
          <div role="group" aria-label="บิลด์" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:flex-wrap [&::-webkit-scrollbar]:hidden">
            {heroBuilds.map((b) => (
              <button
                key={b.id}
                type="button"
                aria-pressed={current?.id === b.id}
                onClick={() => setBuildId(b.id)}
                className={`h-11 shrink-0 whitespace-nowrap rounded-full border px-4 text-xs transition sm:h-9 sm:px-3 ${
                  current?.id === b.id ? "border-accent bg-accent font-medium text-accent-fg" : "border-border bg-bg-surface text-text-muted hover:border-text-faint"
                }`}
              >
                แพตช์ {b.patchCode} · {b.source}
              </button>
            ))}
          </div>
        )}
        {heroId && !loading && heroBuilds.length === 0 && <p className="text-xs text-text-faint">ฮีโร่นี้ยังไม่มีบิลด์ เพิ่มได้ที่ "ข้อมูลบิลด์" ด้านล่าง</p>}
      </section>

      {!heroId ? (
        <p className="rounded-card border border-dashed border-border p-6 text-center text-sm text-text-muted">เลือกฮีโร่ก่อน แล้วแก้ทุกอย่างของบิลด์ได้ในหน้านี้</p>
      ) : (
        <>
          <Section title="ข้อมูลบิลด์" hint="เพิ่ม/ลบ/แก้แพตช์และที่มา" open={!loading && heroBuilds.length === 0}>
            <Editor key={`builds:${heroId}`} id="builds" cfg={CFG.builds} refs={refs} fixedFv={heroId} onLoaded={onBuildRows} />
          </Section>
          {current && (
            <>
              <Section title="ไอเทมในบิลด์" open>
                <Editor key={`items:${current.id}`} id="buildItems" cfg={CFG.buildItems} refs={refs} fixedFv={current.id} />
              </Section>
              <Section title="รูนในบิลด์" open>
                <Editor key={`rune:${current.id}`} id="buildRune" cfg={CFG.buildRune} refs={refs} fixedFv={current.id} />
              </Section>
              <Section title="สกิลชาเลนเจอร์ในบิลด์" open>
                <BuildSpellEditor build={current} heroName={heroLabel} onChanged={reload} />
              </Section>
              <Section title="พลังแฝงในบิลด์" open>
                <BuildEnchantmentEditor build={current} heroName={heroLabel} />
              </Section>
            </>
          )}
        </>
      )}
    </div>
  );
}
