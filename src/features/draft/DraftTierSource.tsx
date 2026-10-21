import { useMemo } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { usePersistedState } from "@/hooks/usePersistedState";
import { listMyTierLists, type MyTierList } from "@/services/userTierLists";
import { buildCustomTierMap, type CustomTierMap } from "./customTier";

const KEY = "rovlab:draft:tierList";

export interface DraftTierSource {
  lists: MyTierList[];
  selected: MyTierList | null;
  /** null = ใช้เทียร์จากสถิติเหมือนเดิม */
  customTiers: CustomTierMap | null;
  select: (id: string | null) => void;
}

// แหล่งเทียร์ที่หน้า Draft แสดง: สถิติ (ค่าเริ่มต้น) หรือหนึ่งใน "Tier List ของฉัน" ที่บันทึกไว้บนบัญชี
// ไม่ล็อกอิน / ไม่มีลิสต์ / ลิสต์ที่เลือกไว้ถูกลบ = ไม่มีลิสต์ที่เลือก → กลับไปใช้สถิติเงียบๆ
export function useDraftTierSource(): DraftTierSource {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const q = useAsync(() => (userId ? listMyTierLists() : Promise.resolve([] as MyTierList[])), [userId]);
  const [id, select] = usePersistedState<string | null>(KEY, null);
  const data = q.status === "success" ? q.data : undefined;
  const lists = useMemo(() => data ?? [], [data]);
  const selected = useMemo(() => (id ? lists.find((l) => l.id === id) ?? null : null), [lists, id]);
  const customTiers = useMemo(() => (selected ? buildCustomTierMap(selected.data) : null), [selected]);
  return { lists, selected, customTiers, select };
}

export function CustomTierPicker({ source }: { source: DraftTierSource }) {
  if (source.lists.length === 0) return null;
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
          {source.lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      {source.selected && (
        <span className="text-xs text-text-faint">
          แสดงเทียร์จากลิสต์ของทีม “{source.selected.name}” · ฮีโร่ที่ไม่อยู่ในลิสต์แสดงเป็น —
        </span>
      )}
    </div>
  );
}
