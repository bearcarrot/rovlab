import { useCallback, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Plus, Search, X } from "lucide-react";
import { Thumb, type ImgOpt } from "./ImageSelect";

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type ColorOpt = ImgOpt & { color?: string };
// ไอเทมสำหรับกริดแบบร้านค้า: tier/cost/role_tags/stats มาจากคอลัมน์เดิมของตาราง items
export type ItemOpt = ImgOpt & { tier?: number; cost?: number; tags?: string[]; stat?: string };
// การเปลี่ยนแปลงที่ต้องบันทึกลงแถว (Admin เป็นคนเขียน DB และอัปเดต state)
export type RowMove = { id: string; patch: Row };

const squash = (s: string) => s.toLowerCase().replace(/[\s'’`"\-_.]/g, "");

const PHASES: { k: string; label: string }[] = [
  { k: "early", label: "ช่วงต้นเกม" },
  { k: "core", label: "ไอเทมหลัก" },
  { k: "situational", label: "ตามสถานการณ์" },
];

// ---------- ลากย้ายช่อง ----------
// ใช้ Pointer Events เพราะ HTML5 drag-and-drop ใช้บนมือถือ (touch) ไม่ได้
// เมาส์: กดค้างแล้วลากเกิน 5px / มือถือ: กดค้าง ~0.3 วินาทีแล้วลาก (ลากนิ้วทันทีก่อนหน้านั้น = เลื่อนหน้าปกติ)
// ปลายทางคือ element ที่มี data-slot-id ใต้นิ้ว/เมาส์ตอนปล่อย
type Drag = { id: string; x: number; y: number; over: string | null };

function useSlotDrag(onDrop: (from: string, to: string) => void) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const suppress = useRef(false);
  const dropRef = useRef(onDrop);
  dropRef.current = onDrop;

  const overAt = (x: number, y: number) =>
    (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>("[data-slot-id]")?.dataset.slotId ?? null;

  const bind = useCallback(
    (id: string) => (e: ReactPointerEvent<HTMLElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const touch = e.pointerType !== "mouse";
      const pid = e.pointerId;
      const sx = e.clientX;
      const sy = e.clientY;
      let active = false;
      let timer = 0;

      const activate = (x: number, y: number) => {
        active = true;
        setDrag({ id, x, y, over: null });
      };
      const finish = (drop: boolean, x: number, y: number) => {
        window.clearTimeout(timer);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("touchmove", onTouch);
        if (!active) return;
        // กัน click ที่ตามหลังการปล่อย (ไม่ให้เปิดการ์ด)
        suppress.current = true;
        window.setTimeout(() => {
          suppress.current = false;
        }, 60);
        const over = drop ? overAt(x, y) : null;
        setDrag(null);
        if (over && over !== id) dropRef.current(id, over);
      };
      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pid) return;
        if (!active) {
          const dist = Math.hypot(ev.clientX - sx, ev.clientY - sy);
          if (touch) {
            if (dist > 10) finish(false, 0, 0); // ขยับก่อนกดค้างครบ = ผู้ใช้กำลังเลื่อนหน้า
          } else if (dist > 5) activate(ev.clientX, ev.clientY);
          return;
        }
        setDrag({ id, x: ev.clientX, y: ev.clientY, over: overAt(ev.clientX, ev.clientY) });
      };
      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId === pid) finish(true, ev.clientX, ev.clientY);
      };
      const onCancel = (ev: PointerEvent) => {
        if (ev.pointerId === pid) finish(false, 0, 0);
      };
      // ระหว่างลาก (หลังกดค้างครบ) ห้ามหน้าเลื่อนตามนิ้ว
      const onTouch = (ev: TouchEvent) => {
        if (active && ev.cancelable) ev.preventDefault();
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      window.addEventListener("touchmove", onTouch, { passive: false });
      if (touch) timer = window.setTimeout(() => activate(sx, sy), 300);
    },
    []
  );

  // เรียกใน onClick: true = คลิกนี้มาจากการลาก ให้ข้าม
  const consumeClick = () => {
    if (!suppress.current) return false;
    suppress.current = false;
    return true;
  };

  return { drag, bind, consumeClick };
}

// ไอคอนที่ลอยตามนิ้ว/เมาส์ระหว่างลาก
function DragGhost({ drag, src, label, round }: { drag: Drag | null; src?: string; label: string; round?: boolean }) {
  if (!drag) return null;
  return (
    <div
      className="pointer-events-none fixed z-50 rounded-lg border border-accent bg-bg-surface p-1 opacity-90 shadow-card"
      style={{ left: drag.x - 24, top: drag.y - 24 }}
    >
      <Thumb src={src} label={label} round={round} className="h-10 w-10" />
    </div>
  );
}

// ---------- คำนวณผลการย้าย ----------

// ไอเทม: ย้ายภายในช่วงเกมเดียวกัน (เรียงใหม่) หรือข้ามช่วงเกม (เปลี่ยน phase) ปล่อยที่ช่อง + = ต่อท้ายช่วงนั้น
// ปล่อยบนไอเทมอื่น: ไปอยู่ตำแหน่งนั้น (ย้ายไปข้างหน้า = มาอยู่หลังตัวนั้น เหมือนการลากเรียงลิสต์ทั่วไป)
// แล้วจัด sort_order ใหม่ 1..N ตามลำดับ early → core → situational (ส่งคืนเฉพาะแถวที่ค่าเปลี่ยน)
export function planItemMove(rows: Row[], fromId: string, toId: string): RowMove[] {
  const src = rows.find((r) => r.id === fromId);
  if (!src) return [];
  const groups: Record<string, Row[]> = { early: [], core: [], situational: [] };
  for (const r of rows) groups[r.phase]?.push(r);
  const sp = src.phase as string;
  const si = groups[sp].findIndex((r) => r.id === fromId);
  let tp: string;
  let ti: number;
  if (toId.startsWith("phase:")) {
    tp = toId.slice(6);
    if (!groups[tp]) return [];
    ti = groups[tp].length;
  } else {
    const t = rows.find((r) => r.id === toId);
    if (!t || !groups[t.phase]) return [];
    tp = t.phase;
    ti = groups[tp].findIndex((r) => r.id === toId);
  }
  if (tp === sp && ti === si) return [];
  groups[sp].splice(si, 1);
  groups[tp].splice(Math.min(ti, groups[tp].length), 0, src);
  const out: RowMove[] = [];
  let n = 0;
  for (const { k } of PHASES) {
    for (const r of groups[k]) {
      n++;
      if (r.phase !== k || Number(r.sort_order) !== n) out.push({ id: r.id, patch: { phase: k, sort_order: n } });
    }
  }
  return out;
}

// รูน: ย้ายได้เฉพาะในสีเดียวกัน (สีเป็นของรูนเอง) รูนที่ quantity > 1 ย้ายทั้งกลุ่ม ปล่อยที่ช่องว่างของสีนั้น = ต่อท้ายสี
export function planRuneMove(rows: Row[], rune: ColorOpt[], fromId: string, toId: string): RowMove[] {
  const colorOf = (r: Row) => rune.find((a) => a.id === r.rune_id)?.color;
  const src = rows.find((r) => r.id === fromId);
  const color = src ? colorOf(src) : undefined;
  if (!src || !color) return [];
  const group = rows.filter((r) => colorOf(r) === color);
  const si = group.findIndex((r) => r.id === fromId);
  let ti: number;
  if (toId.startsWith("empty:")) {
    if (toId.slice(6) !== color) return [];
    ti = group.length;
  } else {
    const t = rows.find((r) => r.id === toId);
    if (!t || colorOf(t) !== color) return [];
    ti = group.findIndex((r) => r.id === toId);
  }
  if (ti === si) return [];
  const g2 = [...group];
  g2.splice(si, 1);
  g2.splice(Math.min(ti, g2.length), 0, src);
  let gi = 0;
  const next = rows.map((r) => (colorOf(r) === color ? g2[gi++] : r));
  return next.flatMap((r, i) => (Number(r.sort_order) !== i + 1 ? [{ id: r.id, patch: { sort_order: i + 1 } }] : []));
}

// ---------- กริดเลือก ----------

// กริดเลือก (หน้าตาเหมือนช่องเลือกฮีโร่ใน Draft Assistant): ไอคอน + ชื่อ + ค้นหา
function PickerGrid({
  title,
  options,
  round,
  onPick,
  onClose,
  header,
  bindDrag,
  consumeClick,
}: {
  title: string;
  options: ImgOpt[];
  round?: boolean;
  onPick: (id: string) => void;
  onClose: () => void;
  header?: ReactNode;
  // ลากไอคอนจากกริดไปวางที่ช่อง (ใช้ pointer events ตัวเดียวกับการลากย้ายช่อง); id ที่ส่งคือ "pick:<id>"
  bindDrag?: (id: string) => (e: ReactPointerEvent<HTMLElement>) => void;
  consumeClick?: () => boolean;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const n = squash(q);
    return n ? options.filter((o) => squash(`${o.label} ${o.alt ?? ""}`).includes(n)) : options;
  }, [options, q]);
  return (
    <div className="space-y-2 rounded-card border border-border bg-bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-text-muted">{title}</p>
        <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-lg text-text-muted hover:bg-bg-raised sm:h-8 sm:w-8" aria-label="ปิด">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหา..."
          className="w-full bg-transparent text-base outline-none placeholder:text-text-faint sm:text-sm"
        />
      </div>
      {header}
      <div className="grid max-h-[50vh] grid-cols-5 gap-2 overflow-y-auto sm:max-h-72 sm:grid-cols-8">
        {list.map((o) => (
          <button
            key={o.id}
            type="button"
            onPointerDown={bindDrag?.(`pick:${o.id}`)}
            onContextMenu={bindDrag ? (e) => e.preventDefault() : undefined}
            onClick={() => {
              if (!consumeClick?.()) onPick(o.id);
            }}
            className="flex select-none flex-col items-center gap-1 rounded-lg border border-border bg-bg p-1.5 text-center hover:border-accent/40 [&_img]:pointer-events-none"
          >
            <Thumb src={o.icon} label={o.label} round={round} className="h-9 w-9" />
            <span className="w-full truncate text-[10px] leading-tight">{o.label}</span>
          </button>
        ))}
        {list.length === 0 && <p className="col-span-full py-4 text-center text-sm text-text-muted">ไม่พบรายการ</p>}
      </div>
    </div>
  );
}

// กริดเลือกไอเทมแบบร้านค้าในเกม: 3 คอลัมน์ Tier 1 (ซ้าย) / Tier 2 (กลาง) / Tier 3 (ขวา) ตามค่า items.tier จริงใน DB
// ค้นหา + กรองประเภท (role_tags) + กรอง Tier ได้ มือถือเลื่อนแนวนอนทีละคอลัมน์ (เดสก์ท็อป/แท็บเล็ตแสดงครบ 3 คอลัมน์)
const TIERS = [1, 2, 3] as const;

function ItemShopPicker({
  title,
  items,
  typeChoices,
  onPick,
  onClose,
}: {
  title: string;
  items: ItemOpt[];
  typeChoices: readonly { value: string; label: string }[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [tier, setTier] = useState<number | null>(null);
  const [type, setType] = useState<string | null>(null);
  const list = useMemo(() => {
    const n = squash(q);
    return items.filter(
      (o) => (!n || squash(`${o.label} ${o.alt ?? ""}`).includes(n)) && (!type || (o.tags ?? []).includes(type))
    );
  }, [items, q, type]);
  const shown = TIERS.filter((t) => tier === null || tier === t);
  const chip = (active: boolean) =>
    `h-9 shrink-0 rounded-full border px-3 text-xs transition sm:h-8 ${
      active ? "border-accent bg-accent font-medium text-accent-fg" : "border-border bg-bg text-text-muted hover:border-text-faint"
    }`;
  return (
    <div className="space-y-2 rounded-card border border-border bg-bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-text-muted">{title}</p>
        <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-lg text-text-muted hover:bg-bg-raised sm:h-8 sm:w-8" aria-label="ปิด">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหา..."
          className="w-full bg-transparent text-base outline-none placeholder:text-text-faint sm:text-sm"
        />
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="กรอง Tier">
        <button type="button" aria-pressed={tier === null} onClick={() => setTier(null)} className={chip(tier === null)}>
          ทุก Tier
        </button>
        {TIERS.map((t) => (
          <button key={t} type="button" aria-pressed={tier === t} onClick={() => setTier(tier === t ? null : t)} className={chip(tier === t)}>
            Tier {t}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="กรองประเภท">
        <button type="button" aria-pressed={type === null} onClick={() => setType(null)} className={chip(type === null)}>
          ทุกประเภท
        </button>
        {typeChoices.map((o) => (
          <button key={o.value} type="button" aria-pressed={type === o.value} onClick={() => setType(type === o.value ? null : o.value)} className={chip(type === o.value)}>
            {o.label}
          </button>
        ))}
      </div>
      <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 md:mx-0 md:grid md:overflow-visible md:px-0 md:pb-0" style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}>
        {shown.map((t) => {
          const col = list.filter((o) => o.tier === t);
          return (
            <section key={t} aria-label={`Tier ${t}`} className="min-w-[82%] shrink-0 snap-start rounded-lg border border-border bg-bg sm:min-w-[60%] md:min-w-0">
              <h4 className="border-b border-border px-2 py-1.5 text-xs font-semibold text-accent">
                Tier {t} <span className="font-normal text-text-faint">({col.length})</span>
              </h4>
              <ul className="max-h-[50vh] space-y-1 overflow-y-auto p-1.5 md:max-h-72">
                {col.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => onPick(o.id)}
                      className="flex min-h-[44px] w-full items-center gap-2 rounded-lg border border-transparent p-1 text-left hover:border-accent/40 hover:bg-bg-surface md:min-h-0"
                    >
                      <Thumb src={o.icon} label={o.label} className="h-9 w-9 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-xs font-medium">{o.label}</span>
                          {o.cost != null && <span className="shrink-0 text-[11px] font-semibold text-accent">{o.cost}</span>}
                        </span>
                        {o.stat && <span className="block truncate text-[10px] text-text-faint">{o.stat}</span>}
                      </span>
                    </button>
                  </li>
                ))}
                {col.length === 0 && <li className="py-4 text-center text-xs text-text-muted">ไม่พบรายการ</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

const DRAG_HINT = "ลากเพื่อย้ายช่อง (มือถือ: กดค้างแล้วลาก)";

// ไอเทมในบิลด์: ช่องแยกตามช่วงเกม (หน้าตาเหมือน TeamSlots ใน Draft Assistant)
// แตะช่องที่มีไอเทม = เปิดการ์ดด้านล่างเพื่อแก้เหตุผล/ลำดับ, X = ลบ, ช่อง + = เปิดกริดเลือกไอเทม
// ลากช่องเพื่อเรียงใหม่ หรือย้ายข้ามช่วงเกม (ปล่อยบนช่องไอเทมอื่น หรือช่อง + ของช่วงนั้น)
export function ItemSlots({
  rows,
  items,
  typeChoices,
  onAdd,
  onRemove,
  onOpen,
  onMoves,
}: {
  rows: Row[];
  items: ItemOpt[];
  typeChoices: readonly { value: string; label: string }[];
  onAdd: (itemId: string, phase: string) => void;
  onRemove: (row: Row) => void;
  onOpen: (row: Row) => void;
  onMoves: (moves: RowMove[]) => void;
}) {
  const [picker, setPicker] = useState<string | null>(null);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const dnd = useSlotDrag((from, to) => {
    const m = planItemMove(rows, from, to);
    if (m.length > 0) onMoves(m);
  });
  const dragRow = dnd.drag ? rows.find((r) => r.id === dnd.drag!.id) : undefined;
  const dragItem = dragRow ? byId.get(dragRow.item_id) : undefined;
  const hot = (id: string) => dnd.drag?.over === id && dnd.drag.id !== id;
  return (
    <section aria-label="ไอเทมในบิลด์" className="space-y-4">
      {PHASES.map(({ k, label }) => {
        const list = rows.filter((r) => r.phase === k);
        return (
          <div key={k}>
            <p className="mb-2 text-xs font-medium text-text-faint">{label}</p>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-[repeat(auto-fill,4.5rem)]">
              {list.map((r) => {
                const it = byId.get(r.item_id);
                const name = it?.label ?? "?";
                return (
                  <div
                    key={r.id}
                    data-slot-id={r.id}
                    className={`relative select-none [&_img]:pointer-events-none ${dnd.drag?.id === r.id ? "opacity-40" : ""}`}
                  >
                    <button
                      type="button"
                      onPointerDown={dnd.bind(r.id)}
                      onContextMenu={(e) => e.preventDefault()}
                      onClick={() => {
                        if (!dnd.consumeClick()) onOpen(r);
                      }}
                      className={`flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border bg-bg-surface text-center hover:border-accent/40 ${
                        hot(r.id) ? "border-accent ring-2 ring-accent" : "border-border"
                      }`}
                    >
                      <Thumb src={it?.icon} label={name} className="h-10 w-10" />
                      <span className="max-w-full truncate px-1 text-[10px] font-medium leading-tight">{name}</span>
                    </button>
                    <button
                      type="button"
                      aria-label="ลบไอเทม"
                      onClick={() => onRemove(r)}
                      className="absolute -right-1.5 -top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-loss text-white sm:-right-1 sm:-top-1 sm:h-5 sm:w-5"
                    >
                      <X className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                data-slot-id={`phase:${k}`}
                aria-label={`เพิ่มไอเทม${label}`}
                onClick={() => setPicker(picker === k ? null : k)}
                className={`flex aspect-square items-center justify-center rounded-lg border border-dashed ${
                  hot(`phase:${k}`) ? "border-accent ring-2 ring-accent" : picker === k ? "border-accent bg-accent/10" : "border-border bg-bg-surface"
                }`}
              >
                <Plus className="h-4 w-4 text-text-faint" />
              </button>
            </div>
          </div>
        );
      })}
      <p className="text-[11px] text-text-faint">{DRAG_HINT}</p>
      {picker && (
        <ItemShopPicker
          title={`เลือกไอเทม · ${PHASES.find((p) => p.k === picker)?.label}`}
          items={items}
          typeChoices={typeChoices}
          onPick={(id) => onAdd(id, picker)}
          onClose={() => setPicker(null)}
        />
      )}
      <DragGhost drag={dnd.drag} src={dragItem?.icon} label={dragItem?.label ?? "?"} />
    </section>
  );
}

// รูนในบิลด์: 3 แถวตามสี (แดง/ม่วง/เขียว) แถวละ max ช่อง รูน quantity = n กิน n ช่อง
// แตะช่องว่าง = เปิดกริดเลือกรูนสีนั้น (เพิ่มทีละ 1) / X บนช่อง = ลดทีละ 1 (ถึง 0 = ลบแถว)
// ลากช่องเพื่อเรียงลำดับในสีเดียวกัน (รูนที่มีหลายช่องย้ายทั้งกลุ่ม) ย้ายข้ามสีไม่ได้
export function RuneSlots({
  rows,
  rune,
  colors,
  max,
  onAdd,
  onFill,
  onDec,
  onMoves,
}: {
  rows: Row[];
  rune: ColorOpt[];
  colors: readonly { k: string; label: string; hex: string }[];
  max: number;
  onAdd: (runeId: string) => void;
  // เติมรูนเดียวกัน count ช่อง (ส่งเฉพาะจำนวนที่เหลือของสีนั้น ไม่เกิน max)
  onFill: (runeId: string, count: number) => void;
  onDec: (row: Row) => void;
  onMoves: (moves: RowMove[]) => void;
}) {
  const [picker, setPicker] = useState<string | null>(null);
  const byId = useMemo(() => new Map(rune.map((a) => [a.id, a])), [rune]);
  // โหมดแตะเติมเต็ม (มือถือ/เมาส์): แตะรูนในกริด = เติมช่องที่เหลือของสีนั้นทีเดียว
  const [fillAll, setFillAll] = useState(false);
  const colorOf = (r: Row) => byId.get(r.rune_id)?.color;
  const used = (k: string) => rows.reduce((n, r) => (colorOf(r) === k ? n + (Number(r.quantity) || 0) : n), 0);
  // สีของปลายทางที่ปล่อย: ช่องว่าง/แถวสี/ช่องที่มีรูนอยู่แล้ว
  const colorAt = (id: string | null | undefined) =>
    !id ? undefined : id.startsWith("empty:") || id.startsWith("zone:") ? id.slice(id.indexOf(":") + 1) : (() => {
      const r = rows.find((x) => x.id === id);
      return r ? colorOf(r) : undefined;
    })();
  // เติมให้เต็ม: เฉพาะรูนที่สีตรงกับแถวนั้น และไม่เกิน max ช่องต่อสี
  const fillColor = (runeId: string, color: string | undefined) => {
    const opt = byId.get(runeId);
    if (!opt?.color || opt.color !== color) return;
    const n = max - used(color);
    if (n > 0) onFill(runeId, n);
  };
  const dnd = useSlotDrag((from, to) => {
    if (from.startsWith("pick:")) {
      fillColor(from.slice(5), colorAt(to));
      return;
    }
    const m = planRuneMove(rows, rune, from, to);
    if (m.length > 0) onMoves(m);
  });
  const picking = dnd.drag?.id.startsWith("pick:") ? byId.get(dnd.drag.id.slice(5)) : undefined;
  const dragRow = dnd.drag && !picking ? rows.find((r) => r.id === dnd.drag!.id) : undefined;
  const dragOpt = picking ?? (dragRow ? byId.get(dragRow.rune_id) : undefined);
  const hot = (id: string) => !picking && dnd.drag?.over === id && dnd.drag.id !== id;
  // ระหว่างลากรูนจากกริด: ไฮไลต์แถวสีที่รับได้เท่านั้น (สีตรงกัน)
  const zoneHot = (k: string) => !!picking && picking.color === k && colorAt(dnd.drag?.over) === k;
  return (
    <section aria-label="ช่องรูน" className="space-y-4">
      {colors.map(({ k, label, hex }) => {
        const slots: { row: Row; opt: ColorOpt }[] = [];
        for (const r of rows) {
          const opt = byId.get(r.rune_id);
          if (opt?.color !== k) continue;
          const n = Number(r.quantity) || 0;
          for (let i = 0; i < n; i++) slots.push({ row: r, opt });
        }
        const total = Math.max(max, slots.length);
        const over = slots.length > max;
        return (
          <div key={k} data-slot-id={`zone:${k}`} className={`rounded-lg ${zoneHot(k) ? "bg-accent/10 ring-2 ring-accent" : ""}`}>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-faint">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: hex }} />
              {label}
              <span className={over ? "text-loss" : ""}>
                {slots.length}/{max}
              </span>
            </p>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
              {Array.from({ length: total }).map((_, i) => {
                const s = slots[i];
                if (!s) {
                  const eid = `empty:${k}`;
                  return (
                    <button
                      key={i}
                      type="button"
                      data-slot-id={eid}
                      aria-label={`เพิ่มรูน${label}`}
                      onClick={() => setPicker(picker === k ? null : k)}
                      className={`flex aspect-square items-center justify-center rounded-[50%] border border-dashed ${
                        hot(eid) ? "border-accent ring-2 ring-accent" : picker === k ? "border-accent bg-accent/10" : "border-border bg-bg-surface"
                      }`}
                    >
                      <Plus className="h-4 w-4 text-text-faint" />
                    </button>
                  );
                }
                return (
                  <div
                    key={i}
                    data-slot-id={s.row.id}
                    className={`relative select-none [&_img]:pointer-events-none ${dnd.drag?.id === s.row.id ? "opacity-40" : ""}`}
                  >
                    <span
                      title={s.opt.label}
                      onPointerDown={dnd.bind(s.row.id)}
                      onContextMenu={(e) => e.preventDefault()}
                      className={`flex aspect-square items-center justify-center overflow-hidden rounded-[50%] border-2 bg-bg-surface ${
                        hot(s.row.id) ? "ring-2 ring-accent" : ""
                      }`}
                      style={{ borderColor: i >= max ? "#ef4444" : hex }}
                    >
                      <Thumb src={s.opt.icon} label={s.opt.label} round className="h-full w-full" />
                    </span>
                    <button
                      type="button"
                      aria-label="ลดจำนวนรูน"
                      onClick={() => onDec(s.row)}
                      className="absolute -right-1.5 -top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-loss text-white sm:-right-1 sm:-top-1 sm:h-4 sm:w-4"
                    >
                      <X className="h-3.5 w-3.5 sm:h-2.5 sm:w-2.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="text-[11px] text-text-faint">
        {DRAG_HINT} · ย้ายได้เฉพาะในสีเดียวกัน · ลากรูนจากกริดเลือกไปวางที่แถวสีเดียวกัน = เติมช่องที่เหลือให้เต็ม {max} ช่อง
      </p>
      {picker && (
        <PickerGrid
          title={`เลือกรูน · ${colors.find((c) => c.k === picker)?.label}`}
          options={rune.filter((a) => a.color === picker)}
          round
          onPick={(id) => (fillAll ? fillColor(id, picker) : onAdd(id))}
          onClose={() => setPicker(null)}
          bindDrag={dnd.bind}
          consumeClick={dnd.consumeClick}
          header={
            <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-xs text-text-muted sm:min-h-[36px]">
              <input type="checkbox" checked={fillAll} onChange={(e) => setFillAll(e.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--accent,#d4a017)] sm:h-4 sm:w-4" />
              แตะรูน = เติมช่องที่เหลือของสีนี้ให้เต็ม {max} ช่อง (ปิด = เพิ่มทีละ 1)
            </label>
          }
        />
      )}
      <DragGhost drag={dnd.drag} src={dragOpt?.icon} label={dragOpt?.label ?? "?"} round />
    </section>
  );
}
