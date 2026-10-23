import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Plus, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { HeroIcon } from "@/components/HeroIcon";
import { useToast } from "@/components/ui/toast";
import { HeroFilterBar, useHeroFilters } from "@/features/heroes/HeroFilterBar";
import { confirmDialog } from "@/features/community/confirm";
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
import { DEFAULT_CUSTOM_NAME, NAME_MAX, clearCustom, createDefault, loadCustom, type CustomTierList } from "./customTierList";
import {
  MAX_ROWS,
  addLane,
  addRow,
  deleteRow,
  emptyTierData,
  findLane,
  findTier,
  moveHero,
  moveRow,
  removeLane,
  rowsCustomized,
  shiftHero,
  tierHeroCount,
  updateLaneRows,
  updateRow,
  type LaneId,
  type TierData,
} from "./tierData";
import { LaneTabs, useLaneName } from "./LaneTabs";
import { TierLabel } from "./TierRows";
import { TierRowEditor } from "./TierRowEditor";

const DRAG_TYPE = "text/rovlab-hero";

// หนึ่ง Tier List มีหลายเลน (list.lanes) แต่ละเลนมีกระดานของตัวเอง — ตัวจัดอันดับแสดง/แก้ "เลนที่เลือก" ครั้งละเลน
// การสลับเลนเปลี่ยนแค่ activeId (ไม่แตะข้อมูล จึงไม่ทำให้เกิด unsaved changes); ทุกการแก้ไขผ่าน editTiers → updateLaneRows
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
  /** แจ้ง Tier List ปัจจุบัน (ทุกเลน) ทุกครั้งที่แก้ (ให้ปุ่ม "บันทึก" ด้านบนเอาไปเก็บบนบัญชี) */
  onChange?: (list: CustomTierList) => void;
  /** ผู้ใช้กดรีเซ็ตทั้งชุด: ตัวห่อจะเลิกผูกกับรายการที่บันทึกไว้ เพื่อไม่ให้บันทึกทับด้วยลิสต์ว่าง */
  onReset?: () => void;
  /** ปุ่มเสริมในแถวเดียวกับปุ่มแชร์รูป (เช่น ปุ่มแชร์ลิงก์ ซึ่งต้องรู้สถานะบัญชีที่ตัวห่อถืออยู่) */
  shareExtra?: ReactNode;
}) {
  const toast = useToast();
  const laneName = useLaneName();
  const [list, setList] = useState<CustomTierList>(() => initial ?? loadCustom() ?? createDefault(patch));
  const [activeId, setActiveId] = useState<LaneId>(() => list.lanes[0].id);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [editRows, setEditRows] = useState(false);
  const filters = useHeroFilters("custom");
  const resetTimer = useRef<ReturnType<typeof setTimeout>>();

  const byId = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);

  // เลนที่เปิดอยู่ (ถ้า activeId ไม่มีแล้ว เช่นเลนถูกลบ → เลนแรก) และกระดานของเลนนั้น
  const active = findLane(list.lanes, activeId) ?? list.lanes[0];
  const laneId = active.id;
  const tiers: TierData = active.rows;
  const multi = list.lanes.length > 1;

  // เก็บร่างลง localStorage ทุกครั้งที่แก้ (การเก็บบนบัญชีทำเมื่อกด "บันทึก" เท่านั้น) — เก็บทุกเลน
  useEffect(() => {
    saveCustom(list);
    onChange?.(list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);
  useEffect(() => () => clearTimeout(resetTimer.current), []);

  // Patch ที่แสดงบนรูป: ค่าล่าสุดจากข้อมูลเสมอ (ไม่ใช้ค่าที่ค้างใน storage)
  const patchLabel = patch || list.patch || "—";

  // ฮีโร่ที่ "ยังไม่ได้จัด" นับต่อเลน: ฮีโร่ตัวเดียวกันอยู่ได้หลายเลน แต่ไม่ซ้ำในกระดานเดียว
  const placed = useMemo(() => new Set(tiers.flatMap((r) => r.heroes)), [tiers]);
  const match = filters.match;
  const pool = useMemo(
    () => heroes.filter((h) => !placed.has(h.id) && match(h) && heroMatchesQuery(h, query)),
    [heroes, placed, match, query]
  );

  const update = useCallback((fn: (l: CustomTierList) => CustomTierList) => setList((l) => fn(l)), []);
  /** ทุกการแก้กระดาน (ย้ายฮีโร่ เพิ่ม/ลบ/เรียง/ตั้งชื่อ/สีแถว) กระทบเฉพาะเลนที่เลือก */
  const editTiers = useCallback(
    (fn: (rows: TierData) => TierData) => setList((l) => ({ ...l, lanes: updateLaneRows(l.lanes, laneId, fn) })),
    [laneId]
  );

  function place(id: string, rowId: string | null, index?: number) {
    editTiers((rows) => moveHero(rows, id, rowId, index));
    if (rowId === null) setSelected(null);
  }

  async function removeRow(rowId: string) {
    const row = tiers.find((r) => r.id === rowId);
    if (!row) return;
    if (row.heroes.length > 0) {
      const ok = await confirmDialog({
        title: `ลบแถว “${row.label}”?`,
        message: `ฮีโร่ ${row.heroes.length} ตัวในแถวนี้จะกลับไปอยู่ในฮีโร่ที่ยังไม่ได้จัด`,
        confirmLabel: "ลบแถว",
        danger: true,
      });
      if (!ok) return;
    }
    editTiers((rows) => deleteRow(rows, rowId));
  }

  function selectLane(id: LaneId) {
    setActiveId(id);
    setSelected(null);
    setQuery("");
    setConfirmReset(false);
  }

  function onAddLane(id: LaneId) {
    update((l) => ({ ...l, lanes: addLane(l.lanes, id) }));
    selectLane(id);
  }

  async function onRemoveLane(id: LaneId) {
    const lane = findLane(list.lanes, id);
    if (!lane || list.lanes.length <= 1) return;
    if (tierHeroCount(lane.rows) > 0 || rowsCustomized(lane.rows)) {
      const ok = await confirmDialog({
        title: `ลบเลน ${laneName(id)}?`,
        message: `กระดานของเลนนี้ (ฮีโร่ ${tierHeroCount(lane.rows)} ตัว) จะถูกลบ เลนอื่นไม่เปลี่ยนแปลง และกู้คืนไม่ได้`,
        confirmLabel: "ลบเลน",
        danger: true,
      });
      if (!ok) return;
    }
    const idx = list.lanes.findIndex((l) => l.id === id);
    const rest = list.lanes.filter((l) => l.id !== id);
    update((l) => ({ ...l, lanes: removeLane(l.lanes, id) }));
    selectLane(rest[Math.max(0, idx - 1)].id);
  }

  // หลายเลน: รีเซ็ตเฉพาะเลนที่เปิดอยู่ (ไม่ลบเลนอื่น และไม่เลิกผูกกับรายการที่บันทึกไว้ — เป็นการแก้ไขหนึ่งครั้ง)
  // เลนเดียว: รีเซ็ตทั้งชุดเหมือนเดิม
  function reset() {
    if (!confirmReset) {
      setConfirmReset(true);
      resetTimer.current = setTimeout(() => setConfirmReset(false), 4000);
      return;
    }
    clearTimeout(resetTimer.current);
    setSelected(null);
    setConfirmReset(false);
    if (multi) {
      editTiers(() => emptyTierData());
      toast.success(`รีเซ็ตเลน ${laneName(laneId)} แล้ว`);
      return;
    }
    clearCustom();
    setList(createDefault(patch));
    onReset?.();
    toast.success("รีเซ็ต Tier List ของฉันแล้ว");
  }

  // รูปที่ใช้แชร์: เฉพาะเลนที่เปิดอยู่ และระบุชื่อเลนบนรูป · ข้ามฮีโร่ที่ไม่มีในข้อมูลแล้ว (เช่นถูกลบออกจากระบบ)
  const buildShare = useCallback(() => {
    const data: TierListImageData = {
      title: list.name.trim() || DEFAULT_CUSTOM_NAME,
      patch: patchLabel,
      filterLabel: laneId === "all" ? "จัดเอง" : `จัดเอง · ${laneName(laneId)}`,
      tiers: tiers.map((r) => ({
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.name, tiers, laneId, patchLabel, byId]);
  const share = useShareImage(tierListTemplate, buildShare);

  const totalPlaced = tiers.reduce((n, r) => n + r.heroes.filter((id) => byId.has(id)).length, 0);

  // โหลดไอคอนที่จัดแล้วล่วงหน้า ให้การกดแชร์ครั้งแรกเร็ว
  useEffect(() => {
    preloadImages(tiers.flatMap((r) => r.heroes.map((id) => byId.get(id)?.icon ?? "")));
  }, [tiers, byId]);

  const selectedRowId = selected ? findTier(tiers, selected) : null;
  const selectedHero = selected ? byId.get(selected) : undefined;

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
          {confirmReset ? "ยืนยันรีเซ็ต?" : multi ? "รีเซ็ตเลนนี้" : "รีเซ็ต"}
        </button>
      </div>

      <LaneTabs lanes={list.lanes.map((l) => l.id)} active={laneId} onSelect={selectLane} onAdd={onAddLane} onRemove={(id) => void onRemoveLane(id)} />

      <p className="text-xs text-text-faint">
        {multi ? `กำลังจัดเลน ${laneName(laneId)} · ` : ""}
        แตะฮีโร่เพื่อเลือก แล้วเลือก Tier ที่ต้องการ (บนคอมลากวางลงแถว Tier ได้) · ร่างเก็บไว้ในเครื่องนี้อัตโนมัติ กด “บันทึก” ด้านบนเพื่อเก็บไว้ในบัญชีของคุณ
      </p>

      <div data-tour="custom-rows" className="space-y-2">
        {tiers.map((row, i) => {
          const ids = row.heroes.filter((id) => byId.has(id));
          return (
            <div key={row.id} className="space-y-1.5">
              <div
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes(DRAG_TYPE)) {
                    e.preventDefault();
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
              {editRows && (
                <TierRowEditor
                  row={row}
                  index={i}
                  count={tiers.length}
                  onLabel={(label) => editTiers((rows) => updateRow(rows, row.id, { label }))}
                  onColor={(color) => editTiers((rows) => updateRow(rows, row.id, { color }))}
                  onMove={(dir) => editTiers((rows) => moveRow(rows, row.id, dir))}
                  onDelete={() => void removeRow(row.id)}
                />
              )}
            </div>
          );
        })}
        {editRows && (
          <button
            type="button"
            disabled={tiers.length >= MAX_ROWS}
            onClick={() => editTiers((rows) => addRow(rows))}
            className="flex w-full items-center justify-center gap-1.5 rounded-card border border-dashed border-border px-3 py-2 text-sm text-text-muted hover:text-text disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {tiers.length >= MAX_ROWS ? `ครบ ${MAX_ROWS} แถวแล้ว` : "เพิ่มแถว"}
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
            {tiers.map((row, i) => (
              <button
                key={row.id}
                type="button"
                aria-pressed={selectedRowId === row.id}
                aria-label={`ย้ายไปแถว ${row.label} (แถวที่ ${i + 1})`}
                onClick={() => place(selectedHero.id, row.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-semibold",
                  selectedRowId === row.id ? "border-accent bg-accent text-accent-fg" : "border-border text-text hover:bg-bg-raised"
                )}
              >
                <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                <span className="max-w-[6rem] truncate">{row.label}</span>
              </button>
            ))}
            {selectedRowId && (
              <>
                <button type="button" aria-label="เลื่อนไปซ้าย" onClick={() => editTiers((rows) => shiftHero(rows, selectedHero.id, -1))} className="rounded-md border border-border p-1.5 text-text hover:bg-bg-raised">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <button type="button" aria-label="เลื่อนไปขวา" onClick={() => editTiers((rows) => shiftHero(rows, selectedHero.id, 1))} className="rounded-md border border-border p-1.5 text-text hover:bg-bg-raised">
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
      {totalPlaced === 0 && (
        <p className="-mt-2 text-xs text-text-faint">
          {multi ? `เลือกฮีโร่เข้า Tier ในเลน ${laneName(laneId)} อย่างน้อย 1 ตัวก่อนแชร์รูป` : "เลือกฮีโร่เข้า Tier อย่างน้อย 1 ตัวก่อนแชร์"}
        </p>
      )}
      {multi && totalPlaced > 0 && <p className="-mt-2 text-xs text-text-faint">รูปที่แชร์เป็นของเลน {laneName(laneId)} เท่านั้น · ลิงก์แชร์รวมทุกเลน</p>}

      <section data-tour="custom-pool" className="space-y-2 rounded-card border border-border bg-bg-surface p-3">
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
