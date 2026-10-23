import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Plus, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { HeroIcon } from "@/components/HeroIcon";
import { useToast } from "@/components/ui/toast";
import { HeroFilterBar, useHeroFilters } from "@/features/heroes/HeroFilterBar";
import { confirmDialog } from "@/features/community/confirm";
import { Switch } from "@/features/community/Switch";
import { ShareImageButtons } from "@/features/share/ShareImageButtons";
import { useShareImage } from "@/features/share/useShareImage";
import {
  formatGeneratedDate,
  makeFilename,
  preloadImages,
  tierListTemplate,
  type TierListImageData,
} from "@/lib/share-image";
import { heroMatchesQuery } from "@/lib/heroSearch";
import { cn } from "@/lib/utils";
import type { HeroSummary } from "@/types/hero";
import { DEFAULT_CUSTOM_NAME, NAME_MAX, clearCustom, createDefault, loadCustom, saveCustom, type CustomTierList } from "./customTierList";
import {
  MAX_ROWS,
  addRow,
  collapseDuplicates,
  deleteRow,
  duplicatePlacementCount,
  findTier,
  findTiers,
  moveHero,
  moveRow,
  placeHero,
  poolHeroes,
  removeFromRow,
  shiftHero,
  updateRow,
} from "./tierData";
import { TierLabel } from "./TierRows";
import { TierRowEditor } from "./TierRowEditor";

const DRAG_TYPE = "text/rovlab-hero";

// การเลือก: ฮีโร่ + แถวที่แตะมา (null = แตะจากตารางฮีโร่ด้านล่าง) — จำเป็นเมื่อฮีโร่อยู่ได้หลายแถว เพื่อให้เลื่อน/เอาออกถูกแถว
interface Selection {
  id: string;
  rowId: string | null;
}

export function CustomTierBoard({
  heroes,
  patch,
  initial,
  onChange,
  onReset,
  shareExtra,
}: {
  heroes: HeroSummary[];
  patch: string;
  /** เริ่มจาก Tier List นี้แทนค่าที่ค้างในเครื่อง (ใช้ตอนโหลดจาก "รายการของฉัน" / Community) */
  initial?: CustomTierList | null;
  /** แจ้ง Tier List ปัจจุบันทุกครั้งที่แก้ (ให้ปุ่ม "บันทึก" ด้านบนเอาไปเก็บบนบัญชี) */
  onChange?: (list: CustomTierList) => void;
  /** ผู้ใช้กดรีเซ็ต: ตัวห่อจะเลิกผูกกับรายการที่บันทึกไว้ เพื่อไม่ให้บันทึกทับด้วยลิสต์ว่าง */
  onReset?: () => void;
  /** ปุ่มเสริมในแถวเดียวกับปุ่มแชร์รูป (เช่น ปุ่มแชร์ลิงก์ ซึ่งต้องรู้สถานะบัญชีที่ตัวห่อถืออยู่) */
  shareExtra?: ReactNode;
}) {
  const toast = useToast();
  const [list, setList] = useState<CustomTierList>(() => initial ?? loadCustom() ?? createDefault(patch));
  const [selected, setSelected] = useState<Selection | null>(null);
  const [query, setQuery] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [editRows, setEditRows] = useState(false);
  const filters = useHeroFilters("custom");
  const resetTimer = useRef<ReturnType<typeof setTimeout>>();

  const byId = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);
  const allow = list.allowDuplicates;

  // เก็บร่างลง localStorage ทุกครั้งที่แก้ (การเก็บบนบัญชีทำเมื่อกด "บันทึก" เท่านั้น) — รวมค่า "อนุญาตให้ฮีโร่อยู่ได้หลาย Tier"
  useEffect(() => {
    saveCustom(list);
    onChange?.(list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);
  useEffect(() => () => clearTimeout(resetTimer.current), []);

  // Patch ที่แสดงบนรูป: ค่าล่าสุดจากข้อมูลเสมอ (ไม่ใช้ค่าที่ค้างใน storage)
  const patchLabel = patch || list.patch || "—";

  // OFF: ซ่อนฮีโร่ที่จัดแล้ว (เหมือนเดิม) · ON: ทุกตัวยังเลือกได้
  const available = useMemo(() => poolHeroes(heroes, list.tiers, allow), [heroes, list.tiers, allow]);
  const match = filters.match;
  const pool = useMemo(() => available.filter((h) => match(h) && heroMatchesQuery(h, query)), [available, match, query]);

  const update = useCallback((fn: (l: CustomTierList) => CustomTierList) => setList((l) => fn(l)), []);

  // ใส่ฮีโร่เข้าแถว: OFF = ย้าย (ออกจากแถวเดิม) · ON = เพิ่มจุดวางใหม่ แถวเดิมยังอยู่
  function place(id: string, rowId: string) {
    update((l) => ({ ...l, tiers: placeHero(l.tiers, id, rowId, undefined, l.allowDuplicates) }));
  }

  // เอาออก: OFF = กลับไปอยู่ในตารางด้านล่าง · ON = เอาออกจากแถวนั้นแถวเดียว
  function removePlacement(id: string, rowId: string | null) {
    update((l) => ({
      ...l,
      tiers: l.allowDuplicates && rowId ? removeFromRow(l.tiers, id, rowId) : moveHero(l.tiers, id, null),
    }));
    setSelected(null);
  }

  async function removeRow(rowId: string) {
    const row = list.tiers.find((r) => r.id === rowId);
    if (!row) return;
    if (row.heroes.length > 0) {
      const ok = await confirmDialog({
        title: `ลบแถว “${row.label}”?`,
        message: allow
          ? `ตำแหน่งของฮีโร่ ${row.heroes.length} ตัวในแถวนี้จะถูกเอาออก (แถวอื่นไม่เปลี่ยนแปลง)`
          : `ฮีโร่ ${row.heroes.length} ตัวในแถวนี้จะกลับไปอยู่ในฮีโร่ที่ยังไม่ได้จัด`,
        confirmLabel: "ลบแถว",
        danger: true,
      });
      if (!ok) return;
    }
    setSelected((s) => (s?.rowId === rowId ? null : s));
    update((l) => ({ ...l, tiers: deleteRow(l.tiers, rowId) }));
  }

  // สลับการอนุญาตให้ฮีโร่อยู่ได้หลาย Tier ปิด = กลับมากฎ 1 ฮีโร่ ต่อ 1 Tier: ถามก่อนถ้าจะต้องตัดตำแหน่งซ้ำ
  async function toggleDuplicates(next: boolean) {
    if (next) {
      update((l) => ({ ...l, allowDuplicates: true }));
      return;
    }
    const extra = duplicatePlacementCount(list.tiers);
    if (extra > 0) {
      const ok = await confirmDialog({
        title: "ปิดการอนุญาตให้ฮีโร่อยู่หลาย Tier?",
        message: `มีตำแหน่งซ้ำ ${extra} จุด ฮีโร่แต่ละตัวจะเหลือในแถวบนสุดที่อยู่เท่านั้น และกู้คืนไม่ได้`,
        confirmLabel: "ปิดและเอาตำแหน่งซ้ำออก",
        danger: true,
      });
      if (!ok) return;
    }
    setSelected(null);
    update((l) => ({ ...l, allowDuplicates: false, tiers: collapseDuplicates(l.tiers) }));
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

  // รูปที่ใช้แชร์: ข้ามฮีโร่ที่ไม่มีในข้อมูลแล้ว (เช่นถูกลบออกจากระบบ) · ฮีโร่ที่อยู่หลายแถววาดทุกแถว (ไม่ dedupe)
  const buildShare = useCallback(() => {
    const data: TierListImageData = {
      title: list.name.trim() || DEFAULT_CUSTOM_NAME,
      patch: patchLabel,
      filterLabel: "จัดเอง",
      tiers: list.tiers.map((r) => ({
        tier: r.label,
        color: r.color,
        heroes: r.heroes.flatMap((id) => {
          const h = byId.get(id);
          return h ? [{ id: h.id, name: h.name, icon: h.icon }] : [];
        }),
      })),
      generatedDate: formatGeneratedDate(),
    };
    return { data, filename: makeFilename("rovlab-my-tier-list"), title: data.title };
  }, [list, patchLabel, byId]);
  const share = useShareImage(tierListTemplate, buildShare);

  const totalPlaced = list.tiers.reduce((n, r) => n + r.heroes.filter((id) => byId.has(id)).length, 0);

  // โหลดไอคอนที่จัดแล้วล่วงหน้า ให้การกดแชร์ครั้งแรกเร็ว
  useEffect(() => {
    preloadImages(list.tiers.flatMap((r) => r.heroes.map((id) => byId.get(id)?.icon ?? "")));
  }, [list.tiers, byId]);

  const selId = selected?.id ?? null;
  const selectedHero = selId ? byId.get(selId) : undefined;
  const placedRows = selId ? findTiers(list.tiers, selId) : [];
  // แถวที่ใช้กับปุ่มเลื่อน/เอาออก: OFF = แถวที่ฮีโร่อยู่ · ON = แถวที่ผู้ใช้แตะเลือก (ถ้ายังอยู่ในแถวนั้น)
  const activeRowId = allow
    ? selected?.rowId && placedRows.includes(selected.rowId)
      ? selected.rowId
      : null
    : selId
      ? findTier(list.tiers, selId)
      : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label data-tour="custom-name" className="min-w-[10rem] flex-1">
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
          data-tour="custom-edit"
          aria-pressed={editRows}
          onClick={() => setEditRows((e) => !e)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm",
            editRows ? "border-accent text-accent" : "border-border text-text-muted hover:text-text"
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          แก้ไขแถว
        </button>
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

      <div data-tour="custom-dup" className="space-y-1 rounded-card border border-border bg-bg-surface px-3 py-2">
        <Switch checked={allow} onChange={(next) => void toggleDuplicates(next)} label="อนุญาตให้ฮีโร่อยู่ได้หลาย Tier" />
        <p className="text-xs text-text-faint">
          เปิดแล้วฮีโร่ตัวเดียวกันอยู่ได้หลายแถว Tier พร้อมกัน (เช่น S และ A) · ในแถวเดียวกันใส่ซ้ำไม่ได้ · ปิด = 1 ฮีโร่ต่อ 1 Tier เหมือนเดิม
        </p>
      </div>

      <p className="text-xs text-text-faint">
        แตะฮีโร่เพื่อเลือก แล้วเลือก Tier ที่ต้องการ (บนคอมลากวางลงแถว Tier ได้) · ร่างเก็บไว้ในเครื่องนี้อัตโนมัติ กด “บันทึก” ด้านบนเพื่อเก็บไว้ในบัญชีของคุณ
        {allow ? " · โหมดหลาย Tier: ลากวาง = เพิ่มใหม่ (ไม่ย้ายจากแถวเดิม) แตะชื่อ Tier ซ้ำเพื่อเอาออกจากแถวนั้น" : ""}
      </p>

      <div data-tour="custom-rows" className="space-y-2">
        {list.tiers.map((row, i) => {
          const ids = row.heroes.filter((id) => byId.has(id));
          return (
            <div key={row.id} className="space-y-1.5">
              <div
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes(DRAG_TYPE)) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = allow ? "copy" : "move";
                    setDragOver(row.id);
                  }
                }}
                onDragLeave={() => setDragOver((d) => (d === row.id ? null : d))}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData(DRAG_TYPE);
                  setDragOver(null);
                  if (id) place(id, row.id);
                }}
                className={cn(
                  "flex min-h-[3.5rem] items-stretch gap-2 rounded-card border bg-bg-surface p-2",
                  dragOver === row.id ? "border-accent" : "border-border"
                )}
              >
                <TierLabel row={row} className="w-12 shrink-0 self-stretch sm:w-14" />
                <div className="flex flex-1 flex-wrap content-start gap-1.5">
                  {ids.length === 0 && <span className="self-center text-xs text-text-faint">ยังไม่มีฮีโร่</span>}
                  {ids.map((id) => {
                    const h = byId.get(id)!;
                    const isSel = selected?.id === id && (!allow || selected.rowId === row.id);
                    return (
                      <HeroTile
                        key={id}
                        hero={h}
                        active={isSel}
                        allowCopy={allow}
                        onSelect={() => setSelected(isSel ? null : { id, rowId: row.id })}
                      />
                    );
                  })}
                  {allow && dragOver === row.id && <span aria-hidden className="self-center text-xs font-medium text-accent">+ เพิ่มที่นี่</span>}
                </div>
              </div>
              {editRows && (
                <TierRowEditor
                  row={row}
                  index={i}
                  count={list.tiers.length}
                  onLabel={(label) => update((l) => ({ ...l, tiers: updateRow(l.tiers, row.id, { label }) }))}
                  onColor={(color) => update((l) => ({ ...l, tiers: updateRow(l.tiers, row.id, { color }) }))}
                  onMove={(dir) => update((l) => ({ ...l, tiers: moveRow(l.tiers, row.id, dir) }))}
                  onDelete={() => void removeRow(row.id)}
                />
              )}
            </div>
          );
        })}
        {editRows && (
          <button
            type="button"
            disabled={list.tiers.length >= MAX_ROWS}
            onClick={() => update((l) => ({ ...l, tiers: addRow(l.tiers) }))}
            className="flex w-full items-center justify-center gap-1.5 rounded-card border border-dashed border-border px-3 py-2 text-sm text-text-muted hover:text-text disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {list.tiers.length >= MAX_ROWS ? `ครบ ${MAX_ROWS} แถวแล้ว` : "เพิ่มแถว"}
          </button>
        )}
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
            {list.tiers.map((row, i) => {
              const isIn = placedRows.includes(row.id);
              return (
                <button
                  key={row.id}
                  type="button"
                  aria-pressed={isIn}
                  aria-label={allow ? `${isIn ? "เอาออกจาก" : "เพิ่มใน"}แถว ${row.label} (แถวที่ ${i + 1})` : `ย้ายไปแถว ${row.label} (แถวที่ ${i + 1})`}
                  onClick={() => {
                    if (allow && isIn) update((l) => ({ ...l, tiers: removeFromRow(l.tiers, selectedHero.id, row.id) }));
                    else place(selectedHero.id, row.id);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-semibold",
                    isIn ? "border-accent bg-accent text-accent-fg" : "border-border text-text hover:bg-bg-raised"
                  )}
                >
                  <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                  <span className="max-w-[6rem] truncate">{row.label}</span>
                </button>
              );
            })}
            {activeRowId && (
              <>
                <button type="button" aria-label="เลื่อนไปซ้าย" onClick={() => update((l) => ({ ...l, tiers: shiftHero(l.tiers, selectedHero.id, -1, activeRowId) }))} className="rounded-md border border-border p-1.5 text-text hover:bg-bg-raised">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <button type="button" aria-label="เลื่อนไปขวา" onClick={() => update((l) => ({ ...l, tiers: shiftHero(l.tiers, selectedHero.id, 1, activeRowId) }))} className="rounded-md border border-border p-1.5 text-text hover:bg-bg-raised">
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => removePlacement(selectedHero.id, activeRowId)} className="rounded-md border border-border px-3 py-1.5 text-sm text-red-400 hover:bg-bg-raised">
                  {allow ? "เอาออกจากแถวนี้" : "เอาออก"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div data-tour="custom-share">
        <ShareImageButtons
          busy={share.busy}
          pending={share.pending}
          disabled={totalPlaced === 0}
          onShare={share.share}
          onDownload={share.download}
          extra={shareExtra}
        />
      </div>
      {totalPlaced === 0 && <p className="-mt-2 text-xs text-text-faint">เลือกฮีโร่เข้า Tier อย่างน้อย 1 ตัวก่อนแชร์</p>}

      <section data-tour="custom-pool" className="space-y-2 rounded-card border border-border bg-bg-surface p-3">
        <h2 className="font-display text-sm font-semibold">{allow ? `ฮีโร่ทั้งหมด (ใส่ได้หลาย Tier) (${pool.length})` : `ฮีโร่ที่ยังไม่ได้จัด (${pool.length})`}</h2>
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
            {pool.map((h) => {
              const isSel = selected?.id === h.id && (!allow || selected.rowId === null);
              return (
                <HeroTile
                  key={h.id}
                  hero={h}
                  active={isSel}
                  allowCopy={allow}
                  onSelect={() => setSelected(isSel ? null : { id: h.id, rowId: null })}
                  block
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function HeroTile({
  hero,
  active,
  onSelect,
  block,
  allowCopy,
}: {
  hero: HeroSummary;
  active: boolean;
  onSelect: () => void;
  block?: boolean;
  /** โหมดหลาย Tier: การลากคือ "คัดลอกไปเพิ่ม" (เคอร์เซอร์ copy) ไม่ใช่ย้าย */
  allowCopy?: boolean;
}) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, hero.id);
        e.dataTransfer.effectAllowed = allowCopy ? "copy" : "move";
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
