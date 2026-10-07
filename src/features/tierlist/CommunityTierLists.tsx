import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Users } from "lucide-react";
import { HeroIcon } from "@/components/HeroIcon";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/components/ui/toast";
import { useAsync } from "@/hooks/useAsync";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { Modal } from "@/features/community/Modal";
import { ReactionButtons } from "@/features/community/ReactionButtons";
import { useCommunityList } from "@/features/community/useCommunityList";
import { useDebounced } from "@/features/community/useDebounced";
import { timeAgo } from "@/features/community/format";
import { applyReaction, type Reaction } from "@/features/community/reactions";
import {
  createTierListCopy,
  getCommunityTierList,
  listCommunityTierLists,
  reactToTierList,
  type CommunitySort,
  type CommunityTierListSummary,
} from "@/services/userTierLists";
import type { HeroSummary } from "@/types/hero";
import type { TierData } from "./tierData";
import { TierRows } from "./TierRows";

const SORTS: { value: CommunitySort; label: string }[] = [
  { value: "new", label: "ล่าสุด" },
  { value: "popular", label: "ยอดนิยม" },
  { value: "liked", label: "ถูกใจมากที่สุด" },
];

export interface PresetLoad {
  name: string;
  description: string;
  patch: string;
  data: TierData;
  cloudId: string | null; // id of the new copy in My Tier Lists (null when not signed in)
}

export function CommunityTierLists({
  heroes,
  canReplace,
  onLoadPreset,
}: {
  heroes: HeroSummary[];
  /** Asks the user before unsaved editor work is replaced; return false to cancel the load. */
  canReplace: () => boolean;
  /** Receives a brand-new copy for the user; the published original is never modified. */
  onLoadPreset: (p: PresetLoad) => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [sort, setSort] = useState<CommunitySort>("new");
  const [query, setQuery] = useState("");
  const q = useDebounced(query, 300);
  const [viewId, setViewId] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const list = useCommunityList((offset, limit) => listCommunityTierLists({ sort, q, offset, limit }), [sort, q]);
  const byId = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);

  async function setReaction(item: CommunityTierListSummary, next: Reaction) {
    if (!user) {
      toast.info("เข้าสู่ระบบเพื่อกด ถูกใจ / ไม่ถูกใจ");
      return;
    }
    const prev = item.myValue;
    const apply = (value: Reaction, counts: { likes: number; dislikes: number }) =>
      list.setItems((cur) => cur.map((x) => (x.id === item.id ? { ...x, myValue: value, ...counts } : x)));
    apply(next, applyReaction({ likes: item.likes, dislikes: item.dislikes }, prev, next));
    setPending((s) => new Set(s).add(item.id));
    try {
      await reactToTierList(item.id, user.id, next);
    } catch {
      apply(prev, { likes: item.likes, dislikes: item.dislikes }); // revert
      toast.error("บันทึกการกดไม่สำเร็จ");
    } finally {
      setPending((s) => {
        const n = new Set(s);
        n.delete(item.id);
        return n;
      });
    }
  }

  async function loadPreset(id: string) {
    if (!canReplace()) return;
    try {
      const full = await getCommunityTierList(id);
      if (!user) {
        // Not signed in: open an unsaved copy in the editor (saving it later asks to sign in).
        onLoadPreset({ name: full.title, description: full.description, patch: full.patch, data: full.data, cloudId: null });
        toast.info("โหลดเป็นสำเนาในตัวจัดอันดับแล้ว เข้าสู่ระบบเพื่อบันทึกไว้ใน Tier List ของฉัน");
        return;
      }
      const cloudId = await createTierListCopy(user.id, { name: full.title, description: full.description, patch: full.patch, data: full.data });
      onLoadPreset({ name: full.title, description: full.description, patch: full.patch, data: full.data, cloudId });
      toast.success("เพิ่มสำเนาไว้ใน Tier List ของฉันแล้ว");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "โหลด Tier List ไม่สำเร็จ");
    }
  }

  const viewItem = viewId ? list.items.find((i) => i.id === viewId) : undefined;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อ Tier List, Patch หรือผู้สร้าง"
            aria-label="ค้นหา Community Tier List"
            className="w-full bg-transparent text-sm outline-none placeholder:text-text-faint"
          />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as CommunitySort)} aria-label="เรียงตาม" className="rounded-lg border border-border bg-bg px-2.5 py-2 text-sm">
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {list.status === "loading" && <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>}
      {list.status === "error" && <ErrorState message="ไม่สามารถโหลด Tier List ได้" onRetry={list.retry} />}
      {list.status === "ready" && list.items.length === 0 && (
        <EmptyState
          icon={Users}
          title={q.trim() ? "ไม่พบ Tier List ที่ตรงกับคำค้น" : "ยังไม่มี Community Tier List"}
          description={q.trim() ? "ลองเปลี่ยนคำค้น" : "ลองจัด Tier List ของคุณเองแล้วเผยแพร่ให้ชุมชน"}
        />
      )}
      {list.status === "ready" && list.items.length > 0 && (
        <ul className="space-y-2">
          {list.items.map((it) => (
            <li key={it.id} className="rounded-card border border-border bg-bg-surface p-3">
              <p className="truncate font-medium">{it.title}</p>
              <p className="text-xs text-text-faint">
                {it.patch ? `Patch ${it.patch} · ` : ""}
                {it.heroCount} ฮีโร่ · เผยแพร่ {timeAgo(it.publishedAt)}
                {it.version > 1 ? ` · อัปเดต v${it.version}` : ""}
              </p>
              <p className="text-xs text-text-muted">
                โดย{" "}
                {it.handle ? <Link to={`/u/${it.handle}`} className="text-accent hover:underline">@{it.handle}</Link> : it.authorName || "ผู้ใช้"}
              </p>
              {it.description && <p className="mt-1 line-clamp-2 text-xs text-text-muted">{it.description}</p>}
              {it.preview.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {it.preview.map((id) => {
                    const h = byId.get(id);
                    return h ? <HeroIcon key={id} icon={h.icon} name={h.name} className="h-8 w-8 rounded-md" /> : null;
                  })}
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <ReactionButtons likes={it.likes} dislikes={it.dislikes} value={it.myValue} disabled={pending.has(it.id)} onChange={(n) => void setReaction(it, n)} />
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setViewId(it.id)} className="rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-bg-raised">
                    ดู Tier List
                  </button>
                  <button type="button" onClick={() => void loadPreset(it.id)} className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-accent-fg">
                    Load Preset
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {list.status === "ready" && list.hasMore && (
        <button
          type="button"
          disabled={list.loadingMore}
          onClick={() => list.loadMore().catch(() => toast.error("โหลดเพิ่มไม่สำเร็จ"))}
          className="w-full rounded-lg border border-border py-2 text-sm text-text-muted hover:text-text disabled:opacity-60"
        >
          {list.loadingMore ? "กำลังโหลด…" : "โหลดเพิ่ม"}
        </button>
      )}

      {viewId && (
        <TierViewModal
          id={viewId}
          item={viewItem}
          byId={byId}
          pending={pending.has(viewId)}
          onReact={(n) => viewItem && void setReaction(viewItem, n)}
          onClose={() => setViewId(null)}
          onLoad={() => {
            setViewId(null);
            void loadPreset(viewId);
          }}
        />
      )}
    </div>
  );
}

function TierViewModal({
  id,
  item,
  byId,
  pending,
  onReact,
  onClose,
  onLoad,
}: {
  id: string;
  item?: CommunityTierListSummary;
  byId: Map<string, HeroSummary>;
  pending: boolean;
  onReact: (n: Reaction) => void;
  onClose: () => void;
  onLoad: () => void;
}) {
  const state = useAsync(() => getCommunityTierList(id), [id]);
  return (
    <Modal title={state.status === "success" ? state.data.title : "Tier List"} onClose={onClose} wide>
      {state.status === "loading" && <Skeleton className="h-40" />}
      {state.status === "error" && <ErrorState message="ไม่สามารถโหลด Tier List ได้" onRetry={state.refetch} />}
      {state.status === "success" && (
        <div className="space-y-4">
          {state.data.description && <p className="text-sm text-text-muted">{state.data.description}</p>}
          <TierRows data={state.data.data} byId={byId} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            {item ? (
              <ReactionButtons likes={item.likes} dislikes={item.dislikes} value={item.myValue} disabled={pending} onChange={onReact} />
            ) : (
              <span />
            )}
            <button type="button" onClick={onLoad} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg">
              Load Preset
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
