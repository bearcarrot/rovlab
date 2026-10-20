import { useMemo } from "react";
import type { ItemSummary } from "@/types/item";
import { CONFIDENT_MARGIN, type SlotGuess } from "@/features/matches/itemMatch";
import { ItemPicker } from "@/features/matches/ItemPicker";

export type ItemSlots = (string | null)[]; // 6 slugs, null = empty slot

interface Props {
  items: ItemSummary[];
  value: ItemSlots;
  /** What the icon matcher guessed for this row (null when it could not read the picture). */
  guesses: SlotGuess[] | null;
  /** Slots the user has picked in; a picked slot is no longer flagged as unsure. */
  touched?: boolean[];
  onChange: (next: ItemSlots, slot: number) => void;
}

export function MyItemsEditor({ items, value, guesses, touched, onChange }: Props) {
  const sorted = useMemo(() => [...items].sort((a, b) => a.name.localeCompare(b.name)), [items]);
  return (
    <fieldset className="space-y-2 rounded-lg border border-border bg-bg-surface p-3">
      <legend className="px-1 text-sm font-medium">ไอเทมที่ซื้อในแมตช์นี้</legend>
      <p className="text-xs text-text-muted">
        {guesses
          ? "ระบบเดาจากไอคอนในรูป ช่องที่ขึ้นกรอบสีเด่นควรเช็กอีกครั้ง ถ้าไม่ตรงให้เลือกชื่อที่ถูกจากรายการ ถ้าตรงแล้วให้เลือกชื่อเดิมซ้ำเพื่อยืนยัน (ช่องที่ยังไม่ยืนยันจะไม่ถูกนับในสถิติชุมชน)"
          : "อ่านไอเทมจากรูปนี้ไม่ได้ (สัดส่วนภาพต่างจากที่รองรับ) เลือกเองได้ หรือเว้นว่างไว้"}
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {value.map((slug, i) => {
          const g = guesses?.[i];
          const unsure = !!g && g.slug !== null && g.slug === slug && g.margin < CONFIDENT_MARGIN && !touched?.[i];
          return (
            <ItemPicker
              key={i}
              items={sorted}
              value={slug}
              ariaLabel={`ไอเทมช่องที่ ${i + 1}`}
              unsure={unsure}
              onChange={(next) => onChange(value.map((v, j) => (j === i ? next : v)), i)}
            />
          );
        })}
      </div>
    </fieldset>
  );
}
