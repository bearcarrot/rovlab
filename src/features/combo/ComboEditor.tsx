import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Modal } from "@/features/community/Modal";
import { Switch } from "@/features/community/Switch";
import { HeroIcon } from "@/components/HeroIcon";
import { HeroFilterBar, useHeroFilters } from "@/features/heroes/HeroFilterBar";
import { useToast } from "@/components/ui/toast";
import { heroMatchesQuery } from "@/lib/heroSearch";
import { cn } from "@/lib/utils";
import { comboError, MAX_HEROES, MIN_HEROES, saveCombo, type Combo } from "@/services/combos";
import type { HeroSummary } from "@/types/hero";

const FIELD = "w-full rounded-lg border border-border bg-bg-surface px-3 py-2.5 text-base outline-none placeholder:text-text-faint focus:border-accent sm:text-sm";

// สร้าง/แก้ไข Combo: เลือกฮีโร่ 2–5 ตัว (ลำดับที่กดคือลำดับที่แสดง) + ชื่อ + โน้ต + เผยแพร่หรือส่วนตัว
// เป็น bottom sheet บนมือถือ (Modal กลาง) ปุ่มและช่องกรอกสูงพอแตะได้ และ text-base กัน iOS ซูมตอนโฟกัส
export function ComboEditor({
  initial,
  heroes,
  userId,
  onClose,
  onSaved,
}: {
  initial: Combo | null;
  heroes: HeroSummary[];
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const filters = useHeroFilters("combo-editor");
  const [query, setQuery] = useState("");
  const [ids, setIds] = useState<string[]>(initial?.heroIds ?? []);
  const [name, setName] = useState(initial?.name ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byId = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);
  const list = useMemo(() => heroes.filter((h) => filters.match(h) && heroMatchesQuery(h, query)), [heroes, filters.match, query]);

  function toggle(id: string) {
    if (ids.includes(id)) {
      setIds(ids.filter((x) => x !== id));
    } else if (ids.length >= MAX_HEROES) {
      toast.info(`เลือกได้สูงสุด ${MAX_HEROES} ตัว`);
    } else {
      setIds([...ids, id]);
    }
  }

  async function submit() {
    if (ids.length < MIN_HEROES) return setError(`เลือกฮีโร่อย่างน้อย ${MIN_HEROES} ตัว`);
    if (name.trim() === "") return setError("ใส่ชื่อ Combo ก่อน");
    setSaving(true);
    setError(null);
    try {
      await saveCombo({ id: initial?.id ?? null, ownerId: userId, name, note, heroIds: ids, isPublic });
      toast.success(initial ? "บันทึกแล้ว" : "สร้าง Combo แล้ว");
      onSaved();
    } catch (e) {
      setError(comboError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={initial ? "แก้ไข Combo" : "สร้าง Combo"} onClose={onClose}>
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-medium text-text-faint">
            ฮีโร่ใน Combo <span className={ids.length >= MIN_HEROES ? "text-accent" : ""}>{ids.length}/{MAX_HEROES}</span> (อย่างน้อย {MIN_HEROES})
          </p>
          <div className="flex gap-2">
            {Array.from({ length: MAX_HEROES }).map((_, i) => {
              const h = byId.get(ids[i]);
              return h ? (
                <button
                  key={h.id}
                  type="button"
                  aria-label={`เอา ${h.nameTh} ออก`}
                  onClick={() => toggle(h.id)}
                  className="relative min-w-0 flex-1 basis-0"
                >
                  <HeroIcon icon={h.icon} name={h.nameTh} fallback={h.name.slice(0, 2).toUpperCase()} className="aspect-square h-auto w-full max-w-16 rounded-xl border border-accent" />
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-bg-raised">
                    <X className="h-3 w-3" />
                  </span>
                </button>
              ) : (
                <div key={`empty-${i}`} className="aspect-square min-w-0 max-w-16 flex-1 basis-0 rounded-xl border border-dashed border-border" />
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-surface px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาฮีโร่..."
              aria-label="ค้นหาฮีโร่"
              className="w-full bg-transparent text-base outline-none placeholder:text-text-faint sm:text-sm"
            />
          </div>
          <HeroFilterBar role={filters.role} lane={filters.lane} onRole={filters.setRole} onLane={filters.setLane} />
          <div className="max-h-56 overflow-y-auto rounded-lg border border-border p-2">
            {list.length === 0 ? (
              <p className="py-4 text-center text-sm text-text-faint">ไม่พบฮีโร่ที่ตรงกับตัวกรอง</p>
            ) : (
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
                {list.map((h) => {
                  const on = ids.includes(h.id);
                  return (
                    <button
                      key={h.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(h.id)}
                      className={cn(
                        "flex min-w-0 flex-col items-center gap-1 rounded-lg border p-1 text-center",
                        on ? "border-accent bg-accent/10" : "border-border bg-bg-surface hover:border-accent/40"
                      )}
                    >
                      <HeroIcon icon={h.icon} name={h.nameTh} fallback={h.name.slice(0, 2).toUpperCase()} className="aspect-square h-auto w-full rounded-md" />
                      <span className="w-full truncate text-[10px] leading-tight">{h.nameTh}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-text-faint">ชื่อ Combo</span>
          <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="เช่น ล็อกเป้าแล้วระเบิดดาเมจ" className={FIELD} />
        </label>

        <label className="block space-y-1">
          <span className="flex justify-between text-xs font-medium text-text-faint">
            <span>อธิบาย (ไม่บังคับ)</span>
            <span>{note.length}/500</span>
          </span>
          <textarea
            value={note}
            maxLength={500}
            rows={4}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ใครเปิดไฟต์ ใครต่อ ใช้สกิลไหนก่อนหลัง และต้องระวังอะไร"
            className={cn(FIELD, "resize-none")}
          />
        </label>

        <Switch checked={isPublic} onChange={setIsPublic} label={isPublic ? "เผยแพร่ให้ทุกคนเห็นใน Community" : "ส่วนตัว (เห็นเฉพาะฉัน)"} />

        {error && <p role="alert" className="text-sm text-loss">{error}</p>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="h-11 rounded-lg border border-border px-4 text-sm text-text-muted hover:text-text">
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="h-11 rounded-lg bg-accent px-6 text-sm font-semibold text-accent-fg hover:brightness-110 disabled:opacity-60"
          >
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
