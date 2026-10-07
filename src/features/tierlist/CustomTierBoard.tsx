import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, RotateCcw, Search, X } from "lucide-react";
import { HeroIcon } from "@/components/HeroIcon";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { HeroFilterBar, useHeroFilters } from "@/features/heroes/HeroFilterBar";
import { ShareImageButtons } from "@/features/share/ShareImageButtons";
import { useShareImage } from "@/features/share/useShareImage";
import {
  formatGeneratedDate,
  makeFilename,
  preloadImages,
  tierListTemplate,
  type TierListImageData,
} from "@/lib/share-image";
import { cn } from "@/lib/utils";
import type { HeroSummary, Tier } from "@/types/hero";
import {
  CUSTOM_TIERS,
  DEFAULT_CUSTOM_NAME,
  NAME_MAX,
  clearCustom,
  createDefault,
  findTier,
  loadCustom,
  moveHero,
  saveCustom,
  shiftHero,
  type CustomTierList,
} from "./customTierList";

const DRAG_TYPE = "text/rovlab-hero";

export function CustomTierBoard({
  heroes,
  patch,
  initial,
  onChange,
  onReset,
}: {
  heroes: HeroSummary[];
  patch: string;
  /** เริ่มจาก Tier List นี้แทนค่าที่ค้างในเครื่อง (ใช้ตอนโหลดจาก "รายการของฉัน" / Community) */
  initial?: CustomTierList | null;
  /** แจ้ง Tier List ปัจจุบันทุกครั้งที่แก้ (ให้ปุ่ม "บันทึก" ด้านบนเอาไปเก็บบนบัญชี) */
  onChange?: (list: CustomTierList) => void;
  /** ผู้ใช้กดรีเซ็ต: ตัวห่อจะเลิกผูกกับรายการที่บันทึกไว้ เพื่อไม่ให้บันทึกทับด้วยลิสต์ว่าง */
  onReset?: () => void;
}) {
  const toast = useToast();
  const [list, setList] = useState<CustomTierList>(() => initial ?? loadCustom() ?? createDefault(patch));
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [dragOver, setDragOver] = useState<Tier | null>(null);
  const filters = useHeroFilters("custom");
  const resetTimer = useRef<ReturnType<typeof setTimeout>>();

  const byId = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);

  // เก็บร่างลง localStorage ทุกครั้งที่แก้ (การเก็บบนบัญชีทำเมื่อกด "บันทึก" เท่านั้น)
  useEffect(() => {
    saveCustom(list);
    onChange?.(list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);
  useEffect(() => () => clearTimeout(resetTimer.current), []);

  // Patch ที่แสดงบนรูป: ค่าล่าสุดจากข้อมูลเสมอ (ไม่ใช้ค่าที่ค้างใน storage)
  const patchLabel = patch || list.patch || "—";

  const placed = useMemo(() => new Set(CUSTOM_TIERS.flatMap((t) => list.tiers[t])), [list.tiers]);
  const match = filters.match;
  const pool = useMemo(() => {
    const q = query.trim().toLowerCase();
    return heroes.filter((h) => !placed.has(h.id) && match(h) && (q === "" || h.name.toLowerCase().includes(q)));
  }, [heroes, placed, match, query]);

  const update = useCallback((fn: (l: CustomTierList) => CustomTierList) => setList((l) => fn(l)), []);

  function place(id: string, tier: Tier | null, index?: number) {
    update((l) => ({ ...l, tiers: moveHero(l.tiers, id, tier, index) }));
    if (tier === null) setSelected(null);
  }

  function reset() {
    if (!confirmReset) {
      setConfirmReset(true);
      resetTimer.current = setTimeout(() => setConfirmReset(false), 4000);
      return;
    }
    clearTimeout(resetTimer.current);
    clearCustom();
    setList(createDefault(patch));
    setSelected(null);
    setConfirmReset(false);
    onReset?.();
    toast.success("รีเซ็ต Tier List ของฉันแล้ว");
  }

  // รูปที่ใช้แชร์: ข้ามฮีโร่ที่ไม่มีในข้อมูลแล้ว (เช่นถูกลบออกจากระบบ)
  const buildShare = useCallback(() => {
    const data: TierListImageData = {
      title: list.name.trim() || DEFAULT_CUSTOM_NAME,
      patch: patchLabel,
      filterLabel: "จัดเอง",
      tiers: CUSTOM_TIERS.map((t) => ({
        tier: t,
        heroes: list.tiers[t].flatMap((id) => {
          const h = byId.get(id);
          return h ? [{ id: h.id, name: h.name, icon: h.icon }] : [];
        }),
      })),
      generatedDate: formatGeneratedDate(),
    };
    return { data, filename: makeFilename("rovlab-my-tier-list"), title: data.title };
  }, [list, patchLabel, byId]);
  const share = useShareImage(tierListTemplate, buildShare);

  const totalPlaced = CUSTOM_TIERS.reduce((n, t) => n + list.tiers[t].filter((id) => byId.has(id)).length, 0);

  // โหลดไอคอนที่จัดแล้วล่วงหน้า ให้การกดแชร์ครั้งแรกเร็ว
  useEffect(() => {
    preloadImages(CUSTOM_TIERS.flatMap((t) => list.tiers[t].map((id) => byId.get(id)?.icon ?? "")));
  }, [list.tiers, byId]);

  const selectedTier = selected ? findTier(list.tiers, selected) : null;
  const selectedHero = selected ? byId.get(selected) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-xs text-text-faint">ชื่อ Tier List (แสดงบนรูปที่แชร์)</span>
          <input
            value={list.name}
            maxLength={NAME_MAX}
            onChange={(e) => update((l) => ({ ...l, name: e.target.value }))}
            placeholder={DEFAULT_CUSTOM_NAME}
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent/60"
          />
        </label>
        <button
          type="button"
          onClick={reset}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm",
            confirmReset ? "border-red-400 text-red-400" : "border-border text-text-muted hover:text-text"
          )}
        >
          <RotateCcw className="h-4 w-4" />
          {confirmReset ? "ยืนยันรีเซ็ต?" : "รีเซ็ต"}
        </button>
      </div>

      <p className="text-xs text-text-faint">
        แตะฮีโร่เพื่อเลือก แล้วเลือก Tier ที่ต้องการ (บนคอมลากวางลงแถว Tier ได้) · ร่างเก็บไว้ในเครื่องนี้อัตโนมัติ กด “บันทึก” ด้านบนเพื่อเก็บไว้ในบัญชีของคุณ
      </p>

      <div className="space-y-2">
        {CUSTOM_TIERS.map((t) => {
          const ids = list.tiers[t].filter((id) => byId.has(id));
          return (
            <div
              key={t}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes(DRAG_TYPE)) {
                  e.preventDefault();
                  setDragOver(t);
                }
              }}
              onDragLeave={() => setDragOver((d) => (d === t ? null : d))}
              onDrop={(e) => {
                const id = e.dataTransfer.getData(DRAG_TYPE);
                setDragOver(null);
                if (id) place(id, t);
              }}
              className={cn(
                "flex min-h-[3.5rem] items-stretch gap-2 rounded-card border bg-bg-surface p-2",
                dragOver === t ? "border-accent" : "border-border"
              )}
            >
              <Badge tier={t} className="w-10 shrink-0 self-stretch text-base">{t}</Badge>
              <div className="flex flex-1 flex-wrap content-start gap-1.5">
                {ids.length === 0 && <span className="self-center text-xs text-text-faint">ยังไม่มีฮีโร่</span>}
                {ids.map((id) => {
                  const h = byId.get(id)!;
                  return (
                    <HeroTile
                      key={id}
                      hero={h}
                      active={selected === id}
                      onSelect={() => setSelected(selected === id ? null : id)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {selectedHero && (
        <div className="sticky bottom-20 z-10 space-y-2 rounded-card border border-accent/50 bg-bg-surface p-3 shadow-card md:bottom-4">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium">{selectedHero.name}</p>
            <button type="button" aria-label="ยกเลิกการเลือก" onClick={() => setSelected(null)} className="text-text-faint hover:text-text">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {CUSTOM_TIERS.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={selectedTier === t}
                onClick={() => place(selectedHero.id, t)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm font-semibold",
                  selectedTier === t ? "border-accent bg-accent text-accent-fg" : "border-border text-text hover:bg-bg-raised"
                )}
              >
                {t}
              </button>
            ))}
            {selectedTier && (
              <>
                <button type="button" aria-label="เลื่อนไปซ้าย" onClick={() => update((l) => ({ ...l, tiers: shiftHero(l.tiers, selectedHero.id, -1) }))} className="rounded-md border border-border p-1.5 text-text hover:bg-bg-raised">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <button type="button" aria-label="เลื่อนไปขวา" onClick={() => update((l) => ({ ...l, tiers: shiftHero(l.tiers, selectedHero.id, 1) }))} className="rounded-md border border-border p-1.5 text-text hover:bg-bg-raised">
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => place(selectedHero.id, null)} className="rounded-md border border-border px-3 py-1.5 text-sm text-red-400 hover:bg-bg-raised">
                  เอาออก
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <ShareImageButtons
        busy={share.busy}
        pending={share.pending}
        disabled={totalPlaced === 0}
        onShare={share.share}
        onDownload={share.download}
      />
      {totalPlaced === 0 && <p className="-mt-2 text-xs text-text-faint">เลือกฮีโร่เข้า Tier อย่างน้อย 1 ตัวก่อนแชร์</p>}

      <section className="space-y-2 rounded-card border border-border bg-bg-surface p-3">
        <h2 className="font-display text-sm font-semibold">ฮีโร่ที่ยังไม่ได้จัด ({pool.length})</h2>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อฮีโร่"
            className="w-full bg-transparent text-sm outline-none placeholder:text-text-faint"
          />
        </div>
        <HeroFilterBar role={filters.role} lane={filters.lane} onRole={filters.setRole} onLane={filters.setLane} />
        {pool.length === 0 ? (
          <p className="text-sm text-text-faint">ไม่พบฮีโร่ที่ตรงกับตัวกรอง</p>
        ) : (
          <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8 lg:grid-cols-10">
            {pool.map((h) => (
              <HeroTile key={h.id} hero={h} active={selected === h.id} onSelect={() => setSelected(selected === h.id ? null : h.id)} block />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function HeroTile({ hero, active, onSelect, block }: { hero: HeroSummary; active: boolean; onSelect: () => void; block?: boolean }) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, hero.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onSelect}
      aria-pressed={active}
      aria-label={hero.name}
      title={hero.name}
      className={cn("rounded-lg", block ? "aspect-square w-full" : "h-11 w-11", active ? "ring-2 ring-accent" : "hover:ring-2 hover:ring-accent/40")}
    >
      <HeroIcon icon={hero.icon} name={hero.name} className="h-full w-full" />
    </button>
  );
}
