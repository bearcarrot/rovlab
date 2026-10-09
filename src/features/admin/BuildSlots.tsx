import { useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { Thumb, type ImgOpt } from "./ImageSelect";

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type ColorOpt = ImgOpt & { color?: string };

const squash = (s: string) => s.toLowerCase().replace(/[\s'’`"\-_.]/g, "");

const PHASES: { k: string; label: string }[] = [
  { k: "early", label: "ช่วงต้นเกม" },
  { k: "core", label: "ไอเทมหลัก" },
  { k: "situational", label: "ตามสถานการณ์" },
];

// กริดเลือก (หน้าตาเหมือนช่องเลือกฮีโร่ใน Draft Assistant): ไอคอน + ชื่อ + ค้นหา
function PickerGrid({
  title,
  options,
  round,
  onPick,
  onClose,
}: {
  title: string;
  options: ImgOpt[];
  round?: boolean;
  onPick: (id: string) => void;
  onClose: () => void;
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
        <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-bg-raised" aria-label="ปิด">
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
      <div className="grid max-h-72 grid-cols-5 gap-2 overflow-y-auto sm:grid-cols-8">
        {list.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onPick(o.id)}
            className="flex flex-col items-center gap-1 rounded-lg border border-border bg-bg p-1.5 text-center hover:border-accent/40"
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

// ไอเทมในบิลด์: ช่องแยกตามช่วงเกม (หน้าตาเหมือน TeamSlots ใน Draft Assistant)
// แตะช่องที่มีไอเทม = เปิดการ์ดด้านล่างเพื่อแก้เหตุผล/ลำดับ, X = ลบ, ช่อง + = เปิดกริดเลือกไอเทม
export function ItemSlots({
  rows,
  items,
  onAdd,
  onRemove,
  onOpen,
}: {
  rows: Row[];
  items: ImgOpt[];
  onAdd: (itemId: string, phase: string) => void;
  onRemove: (row: Row) => void;
  onOpen: (row: Row) => void;
}) {
  const [picker, setPicker] = useState<string | null>(null);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  return (
    <section aria-label="ไอเทมในบิลด์" className="space-y-4">
      {PHASES.map(({ k, label }) => {
        const list = rows.filter((r) => r.phase === k);
        return (
          <div key={k}>
            <p className="mb-2 text-xs font-medium text-text-faint">{label}</p>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
              {list.map((r) => {
                const it = byId.get(r.item_id);
                const name = it?.label ?? "?";
                return (
                  <div key={r.id} className="relative">
                    <button
                      type="button"
                      onClick={() => onOpen(r)}
                      className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border border-border bg-bg-surface text-center hover:border-accent/40"
                    >
                      <Thumb src={it?.icon} label={name} className="h-10 w-10" />
                      <span className="max-w-full truncate px-1 text-[10px] font-medium leading-tight">{name}</span>
                    </button>
                    <button
                      type="button"
                      aria-label="ลบไอเทม"
                      onClick={() => onRemove(r)}
                      className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-loss text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                aria-label={`เพิ่มไอเทม${label}`}
                onClick={() => setPicker(picker === k ? null : k)}
                className={`flex aspect-square items-center justify-center rounded-lg border border-dashed ${
                  picker === k ? "border-accent bg-accent/10" : "border-border bg-bg-surface"
                }`}
              >
                <Plus className="h-4 w-4 text-text-faint" />
              </button>
            </div>
          </div>
        );
      })}
      {picker && (
        <PickerGrid
          title={`เลือกไอเทม · ${PHASES.find((p) => p.k === picker)?.label}`}
          options={items}
          onPick={(id) => onAdd(id, picker)}
          onClose={() => setPicker(null)}
        />
      )}
    </section>
  );
}

// รูนในบิลด์: 3 แถวตามสี (แดง/ม่วง/เขียว) แถวละ max ช่อง รูน quantity = n กิน n ช่อง
// แตะช่องว่าง = เปิดกริดเลือกรูนสีนั้น (เพิ่มทีละ 1) / X บนช่อง = ลดทีละ 1 (ถึง 0 = ลบแถว)
export function ArcanaSlots({
  rows,
  arcana,
  colors,
  max,
  onAdd,
  onDec,
}: {
  rows: Row[];
  arcana: ColorOpt[];
  colors: readonly { k: string; label: string; hex: string }[];
  max: number;
  onAdd: (arcanaId: string) => void;
  onDec: (row: Row) => void;
}) {
  const [picker, setPicker] = useState<string | null>(null);
  const byId = useMemo(() => new Map(arcana.map((a) => [a.id, a])), [arcana]);
  return (
    <section aria-label="ช่องรูน" className="space-y-4">
      {colors.map(({ k, label, hex }) => {
        const slots: { row: Row; opt: ColorOpt }[] = [];
        for (const r of rows) {
          const opt = byId.get(r.arcana_id);
          if (opt?.color !== k) continue;
          const n = Number(r.quantity) || 0;
          for (let i = 0; i < n; i++) slots.push({ row: r, opt });
        }
        const total = Math.max(max, slots.length);
        const over = slots.length > max;
        return (
          <div key={k}>
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
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-label={`เพิ่มรูน${label}`}
                      onClick={() => setPicker(picker === k ? null : k)}
                      className={`flex aspect-square items-center justify-center rounded-[50%] border border-dashed ${
                        picker === k ? "border-accent bg-accent/10" : "border-border bg-bg-surface"
                      }`}
                    >
                      <Plus className="h-4 w-4 text-text-faint" />
                    </button>
                  );
                }
                return (
                  <div key={i} className="relative">
                    <span
                      title={s.opt.label}
                      className="flex aspect-square items-center justify-center overflow-hidden rounded-[50%] border-2 bg-bg-surface"
                      style={{ borderColor: i >= max ? "#ef4444" : hex }}
                    >
                      <Thumb src={s.opt.icon} label={s.opt.label} round className="h-full w-full" />
                    </span>
                    <button
                      type="button"
                      aria-label="ลดจำนวนรูน"
                      onClick={() => onDec(s.row)}
                      className="absolute -right-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-loss text-white"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {picker && (
        <PickerGrid
          title={`เลือกรูน · ${colors.find((c) => c.k === picker)?.label}`}
          options={arcana.filter((a) => a.color === picker)}
          round
          onPick={onAdd}
          onClose={() => setPicker(null)}
        />
      )}
    </section>
  );
}
