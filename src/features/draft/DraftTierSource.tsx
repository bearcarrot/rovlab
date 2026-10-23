import { useMemo } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { usePersistedState } from "@/hooks/usePersistedState";
import { loadCustom } from "@/features/tierlist/customTierList";
import { tierHeroCount, type TierData } from "@/features/tierlist/tierData";
import { listMyTierLists, type MyTierList } from "@/services/userTierLists";
import { buildCustomTierMap, type CustomTierMap } from "./customTier";

const KEY = "rovlab:draft:tierList";
// ร่าง "Tier List ของฉัน" ที่เก็บในเบราว์เซอร์ (localStorage) — ใช้ได้แม้ไม่ล็อกอิน/ยังไม่ได้กดบันทึก
const LOCAL_ID = "local";

export interface TierSourceOption {
  id: string;
  name: string;
}
export interface DraftTierSource {
  options: TierSourceOption[];
  selected: TierSourceOption | null;
  /** null = ใช้เทียร์จากสถิติเหมือนเดิม */
  customTiers: CustomTierMap | null;
  /** ลิสต์ที่เลือกเปิด "อนุญาตให้ฮีโร่อยู่ได้หลาย Tier" — ฮีโร่ที่อยู่หลายแถวใช้แถวบนสุด (ดู buildCustomTierMap) */
  multiTier: boolean;
  select: (id: string | null) => void;
}

// แหล่งเทียร์ที่หน้า Draft แสดง: สถิติ (ค่าเริ่มต้น) / ร่างในเบราว์เซอร์ / หนึ่งใน "Tier List ของฉัน" ที่บันทึกไว้บนบัญชี (ต้องล็อกอิน)
// ตัวเลือกที่ไม่มีอยู่แล้ว (ลิสต์ถูกลบ / ร่างถูกล้าง / ไม่ได้ล็อกอิน) → กลับไปใช้สถิติเงียบๆ
export function useDraftTierSource(): DraftTierSource {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const q = useAsync(() => (userId ? listMyTierLists() : Promise.resolve([] as MyTierList[])), [userId]);
  const [id, select] = usePersistedState<string | null>(KEY, null);
  const data = q.status === "success" ? q.data : undefined;
  const lists = useMemo(() => data ?? [], [data]);
  // อ่านร่างในเบราว์เซอร์ตอนเปิดหน้า (แก้ร่างที่หน้า Tier List แล้วกลับมา = หน้า Draft ถูกสร้างใหม่ จึงได้ค่าล่าสุด)
  // ใช้เฉพาะร่างที่มีฮีโร่อยู่แล้ว
  const local = useMemo(() => {
    const l = loadCustom();
    return l && tierHeroCount(l.tiers) > 0 ? l : null;
  }, []);

  const options = useMemo<TierSourceOption[]>(
    () => [
      ...(local ? [{ id: LOCAL_ID, name: `ร่างในเบราว์เซอร์: ${local.name}` }] : []),
      ...lists.map((l) => ({ id: l.id, name: l.name })),
    ],
    [local, lists]
  );
  const selected = useMemo(() => (id ? options.find((o) => o.id === id) ?? null : null), [options, id]);
  const customTiers = useMemo(() => {
    if (!selected) return null;
    const rows: TierData | undefined = selected.id === LOCAL_ID ? local?.tiers : lists.find((l) => l.id === selected.id)?.data;
    return rows ? buildCustomTierMap(rows) : null;
  }, [selected, local, lists]);
  const multiTier = useMemo(() => {
    if (!selected) return false;
    return selected.id === LOCAL_ID ? local?.allowDuplicates === true : lists.find((l) => l.id === selected.id)?.allowDuplicates === true;
  }, [selected, local, lists]);
  return { options, selected, customTiers, multiTier, select };
}

export function CustomTierPicker({ source }: { source: DraftTierSource }) {
  if (source.options.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <label className="flex items-center gap-2 text-sm">
        <span className="text-text-muted">เทียร์ที่แสดง</span>
        <select
          value={source.selected?.id ?? ""}
          onChange={(e) => source.select(e.target.value || null)}
          className="min-h-10 rounded-lg border border-border bg-bg px-3 py-2 text-base sm:text-sm"
        >
          <option value="">สถิติ (ค่าเริ่มต้น)</option>
          {source.options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      {source.selected && (
        <span className="text-xs text-text-faint">
          แสดงเทียร์จากลิสต์ของทีม “{source.selected.name}” · ฮีโร่ที่ไม่อยู่ในลิสต์แสดงเป็น —
          {source.multiTier ? " · ฮีโร่ที่อยู่หลาย Tier ใช้แถวบนสุดที่ฮีโร่อยู่" : ""}
        </span>
      )}
    </div>
  );
}
