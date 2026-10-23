import { useCallback, useMemo } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { usePersistedState } from "@/hooks/usePersistedState";
import { loadCustom } from "@/features/tierlist/customTierList";
import { useLaneName } from "@/features/tierlist/LaneTabs";
import { lanesHeroCount, type LaneId, type TierLanes } from "@/features/tierlist/tierData";
import { listMyTierLists, type MyTierList } from "@/services/userTierLists";
import { resolveCustomTiers, type CustomTierMap } from "./customTier";

const KEY = "rovlab:draft:tierList";
const LANE_KEY = "rovlab:draft:tierLane";
// ร่าง "Tier List ของฉัน" ที่เก็บในเบราว์เซอร์ (localStorage) — ใช้ได้แม้ไม่ล็อกอิน/ยังไม่ได้กดบันทึก
const LOCAL_ID = "local";

export interface TierSourceOption {
  id: string;
  name: string;
}
export interface DraftTierSource {
  options: TierSourceOption[];
  selected: TierSourceOption | null;
  /** null = ใช้เทียร์จากสถิติเหมือนเดิม (รวมกรณี Tier List หลายเลนที่ยังไม่ได้เลือกเลน) */
  customTiers: CustomTierMap | null;
  select: (id: string | null) => void;
  /** เลนของลิสต์ที่เลือก เมื่อมีมากกว่า 1 เลน (ลิสต์เลนเดียวเป็น [] = ไม่ต้องเลือก) */
  lanes: LaneId[];
  lane: LaneId | null;
  selectLane: (id: LaneId | null) => void;
  /** ลิสต์ที่เลือกมีหลายเลนแต่ยังไม่ได้เลือกเลน */
  needsLane: boolean;
}

// แหล่งเทียร์ที่หน้า Draft แสดง: สถิติ (ค่าเริ่มต้น) / ร่างในเบราว์เซอร์ / หนึ่งใน "Tier List ของฉัน" ที่บันทึกไว้บนบัญชี (ต้องล็อกอิน)
// ตัวเลือกที่ไม่มีอยู่แล้ว (ลิสต์ถูกลบ / ร่างถูกล้าง / ไม่ได้ล็อกอิน) → กลับไปใช้สถิติเงียบๆ
// Tier List หลายเลน: ใช้เฉพาะกระดานของเลนที่ผู้ใช้เลือก (ไม่รวมเลน ไม่เดาเลนแรก) — เปลี่ยนลิสต์/เลน = สร้างแผนที่ใหม่
export function useDraftTierSource(): DraftTierSource {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const q = useAsync(() => (userId ? listMyTierLists() : Promise.resolve([] as MyTierList[])), [userId]);
  const [id, setId] = usePersistedState<string | null>(KEY, null);
  const [laneChoice, setLaneChoice] = usePersistedState<LaneId | null>(LANE_KEY, null);
  const data = q.status === "success" ? q.data : undefined;
  const lists = useMemo(() => data ?? [], [data]);
  // อ่านร่างในเบราว์เซอร์ตอนเปิดหน้า (แก้ร่างที่หน้า Tier List แล้วกลับมา = หน้า Draft ถูกสร้างใหม่ จึงได้ค่าล่าสุด)
  // ใช้เฉพาะร่างที่มีฮีโร่อยู่แล้ว
  const local = useMemo(() => {
    const l = loadCustom();
    return l && lanesHeroCount(l.lanes) > 0 ? l : null;
  }, []);

  const options = useMemo<TierSourceOption[]>(
    () => [
      ...(local ? [{ id: LOCAL_ID, name: `ร่างในเบราว์เซอร์: ${local.name}` }] : []),
      ...lists.map((l) => ({ id: l.id, name: l.name })),
    ],
    [local, lists]
  );
  const selected = useMemo(() => (id ? options.find((o) => o.id === id) ?? null : null), [options, id]);

  const selectedLanes = useMemo<TierLanes | null>(() => {
    if (!selected) return null;
    return selected.id === LOCAL_ID ? local?.lanes ?? null : lists.find((l) => l.id === selected.id)?.lanes ?? null;
  }, [selected, local, lists]);

  const resolved = useMemo(() => (selectedLanes ? resolveCustomTiers(selectedLanes, laneChoice) : null), [selectedLanes, laneChoice]);
  const lanes = useMemo<LaneId[]>(() => (selectedLanes && selectedLanes.length > 1 ? selectedLanes.map((l) => l.id) : []), [selectedLanes]);
  const lane = laneChoice !== null && lanes.includes(laneChoice) ? laneChoice : null;

  // เปลี่ยนลิสต์ = ล้างเลนที่เลือกไว้ (ไม่เอาเลนของลิสต์อื่นมาใช้ต่อโดยผู้ใช้ไม่รู้ตัว)
  const select = useCallback(
    (next: string | null) => {
      setId(next);
      setLaneChoice(null);
    },
    [setId, setLaneChoice]
  );

  return {
    options,
    selected,
    customTiers: resolved?.map ?? null,
    select,
    lanes,
    lane,
    selectLane: setLaneChoice,
    needsLane: resolved?.needsLane ?? false,
  };
}

export function CustomTierPicker({ source }: { source: DraftTierSource }) {
  const laneName = useLaneName();
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
      {source.lanes.length > 0 && (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-text-muted">เลน</span>
          <select
            value={source.lane ?? ""}
            onChange={(e) => source.selectLane((e.target.value || null) as LaneId | null)}
            className="min-h-10 rounded-lg border border-border bg-bg px-3 py-2 text-base sm:text-sm"
          >
            <option value="">เลือกเลน</option>
            {source.lanes.map((l) => (
              <option key={l} value={l}>
                {laneName(l)}
              </option>
            ))}
          </select>
        </label>
      )}
      {source.selected && source.needsLane && (
        <span className="text-xs text-amber-400">ลิสต์นี้มีหลายเลน เลือกเลนเพื่อแสดงเทียร์ของลิสต์ (ตอนนี้ใช้เทียร์จากสถิติ)</span>
      )}
      {source.selected && !source.needsLane && (
        <span className="text-xs text-text-faint">
          แสดงเทียร์จากลิสต์ของทีม “{source.selected.name}”
          {source.lane ? ` · เลน ${laneName(source.lane)}` : ""} · ฮีโร่ที่ไม่อยู่ในลิสต์แสดงเป็น —
        </span>
      )}
    </div>
  );
}
