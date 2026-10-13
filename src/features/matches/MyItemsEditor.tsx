import type { ItemSummary } from "@/types/item";
import { CONFIDENT_MARGIN, type SlotGuess } from "@/features/matches/itemMatch";
import { cn } from "@/lib/utils";

export type ItemSlots = (string | null)[]; // 6 slugs, null = empty slot

interface Props {
  items: ItemSummary[];
  value: ItemSlots;
  /** What the icon matcher guessed for this row (null when it could not read the picture). */
  guesses: SlotGuess[] | null;
  onChange: (next: ItemSlots) => void;
}

export function MyItemsEditor({ items, value, guesses, onChange }: Props) {
  const bySlug = new Map(items.map((i) => [i.slug, i]));
  const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <fieldset className="space-y-2 rounded-lg border border-border bg-bg-surface p-3">
      <legend className="px-1 text-sm font-medium">ไอเทมที่ซื้อในแมตช์นี้</legend>
      <p className="text-xs text-text-muted">
        {guesses
          ? "ระบบเดาจากไอคอนในรูป ช่องที่ขึ้นกรอบสีเด่นควรเช็กอีกครั้ง ถ้าไม่ตรงให้เลือกชื่อที่ถูกจากรายการ"
          : "อ่านไอเทมจากรูปนี้ไม่ได้ (สัดส่วนภาพต่างจากที่รองรับ) เลือกเองได้ หรือเว้นว่างไว้"}
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {value.map((slug, i) => {
          const g = guesses?.[i];
          const unsure = !!g && g.slug !== null && g.slug === slug && g.margin < CONFIDENT_MARGIN;
          const item = slug ? bySlug.get(slug) : undefined;
          return (
            <label key={i} className={cn("flex min-h-11 items-center gap-2 rounded-lg border bg-bg p-2", unsure ? "border-accent" : "border-border")}>
              {item?.icon ? (
                <img src={item.icon} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-8 w-8 shrink-0 rounded object-cover" />
              ) : (
                <span className="h-8 w-8 shrink-0 rounded bg-bg-surface" />
              )}
              <select
                aria-label={`ไอเทมช่องที่ ${i + 1}`}
                value={slug ?? ""}
                onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value || null : v)))}
                className="min-w-0 flex-1 rounded bg-bg-surface px-1 py-1 text-sm text-text"
              >
                <option value="">— ว่าง —</option>
                {sorted.map((it) => (
                  <option key={it.slug} value={it.slug}>
                    {it.name}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
