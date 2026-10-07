import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, Users } from "lucide-react";
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
import { copyName, timeAgo } from "@/features/community/format";
import { applyReaction, type Reaction } from "@/features/community/reactions";
import {
  createDraftCopy,
  DRAFT_NAME_MAX,
  getCommunityDraft,
  listCommunityDrafts,
  reactToDraft,
  type CommunityDraftSummary,
  type CommunitySort,
} from "@/services/draftSeries";
import type { HeroSummary } from "@/types/hero";
import { isGameEmpty, type DraftSeries } from "./series";
import { FORMAT_LABEL } from "./SeriesBar";
import { MiniHero } from "./MiniHero";

const SORTS: { value: CommunitySort; label: string }[] = [
  { value: "new", label: "ล่าสุด" },
  { value: "popular", label: "ยอดนิยม" },
  { value: "liked", label: "ถูกใจมากที่สุด" },
];

export function CommunityDrafts({
  heroes,
  onOpenCopy,
  canReplace,
}: {
  heroes: HeroSummary[];
  /** Called with a brand-new copy for the user; the original snapshot is never modified. */
  onOpenCopy: (c: { series: DraftSeries; name: string; description: string; draftId: string | null }) => void;
  /** Asks the user before unsaved editor work is replaced; resolve false to cancel the load. */
  canReplace: () => Promise<boolean>;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [sort, setSort] = useState<CommunitySort>("new");
  const [query, setQuery] = useState("");
  const q = useDebounced(query, 300);
  const [viewId, setViewId] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const list = useCommunityList((offset, limit) => listCommunityDrafts({ sort, q, offset, limit }), [sort, q]);

  async function setReaction(item: CommunityDraftSummary, next: Reaction) {
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
      await reactToDraft(item.id, user.id, next);
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

  async function loadPreset(item: CommunityDraftSummary) {
    if (!(await canReplace())) return;
    try {
      const full = await getCommunityDraft(item.id);
      const name = copyName(full.title, DRAFT_NAME_MAX);
      if (!user) {
        // Not signed in: open an unsaved copy in the editor (saving it later asks to sign in).
        onOpenCopy({ series: full.series, name, description: full.description, draftId: null });
        toast.info("โหลดเป็นสำเนาในตัวแก้ไขแล้ว เข้าสู่ระบบเพื่อบันทึกไว้ใน Draft ของฉัน");
        return;
      }
      const id = await createDraftCopy(user.id, { name: full.title, description: full.description, series: full.series });
      onOpenCopy({ series: full.series, name, description: full.description, draftId: id });
      toast.success(`เพิ่ม “${name}” ไว้ใน Draft ของฉันแล้ว`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "โหลด Draft ไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อ Draft หรือผู้สร้าง"
            aria-label="ค้นหา Community Draft"
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
      {list.status === "error" && <ErrorState message="ไม่สามารถโหลด Draft ได้" onRetry={list.retry} />}
      {list.status === "ready" && list.items.length === 0 && (
        <EmptyState
          icon={Users}
          title={q.trim() ? "ไม่พบ Draft ที่ตรงกับคำค้น" : "ยังไม่มี Community Draft"}
          description={q.trim() ? "ลองเปลี่ยนคำค้น" : "ลองสร้าง Draft ของคุณเองแล้วแชร์ให้ชุมชน"}
        />
      )}
      {list.status === "ready" && list.items.length > 0 && (
        <ul className="space-y-2">
          {list.items.map((it) => (
            <li key={it.id} className="rounded-card border border-border bg-bg-surface p-3">
              <p className="truncate font-medium">{it.title}</p>
              <p className="text-xs text-text-faint">
                {FORMAT_LABEL[it.format]}
                {it.format !== "single" && it.globalBanPick ? " · Global Ban Pick" : ""} · เผยแพร่ {timeAgo(it.publishedAt)}
                {it.version > 1 ? ` · อัปเดต v${it.version}` : ""}
              </p>
              <p className="text-xs text-text-muted">
                โดย{" "}
                {it.handle ? (
                  <Link to={`/u/${it.handle}`} className="text-accent hover:underline">@{it.handle}</Link>
                ) : (
                  it.authorName || "ผู้ใช้"
                )}
              </p>
              {it.description && <p className="mt-1 line-clamp-2 text-xs text-text-muted">{it.description}</p>}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <ReactionButtons likes={it.likes} dislikes={it.dislikes} value={it.myValue} disabled={pending.has(it.id)} onChange={(n) => void setReaction(it, n)} />
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setViewId(it.id)} className="rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-bg-raised">
                    ดู Draft
                  </button>
                  <button type="button" onClick={() => void loadPreset(it)} className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-accent-fg">
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

      {viewId && <DraftViewModal id={viewId} heroes={heroes} onClose={() => setViewId(null)} onLoad={(it) => { setViewId(null); void loadPreset(it); }} />}
    </div>
  );
}

function DraftViewModal({
  id,
  heroes,
  onClose,
  onLoad,
}: {
  id: string;
  heroes: HeroSummary[];
  onClose: () => void;
  onLoad: (it: CommunityDraftSummary) => void;
}) {
  const state = useAsync(() => getCommunityDraft(id), [id]);
  const bySlug = new Map(heroes.map((h) => [h.slug, h]));
  return (
    <Modal title={state.status === "success" ? state.data.title : "Draft"} onClose={onClose} wide>
      {state.status === "loading" && <Skeleton className="h-40" />}
      {state.status === "error" && <ErrorState message="ไม่สามารถโหลด Draft ได้" onRetry={state.refetch} />}
      {state.status === "success" && (
        <div className="space-y-4">
          {state.data.description && <p className="text-sm text-text-muted">{state.data.description}</p>}
          {state.data.series.games.filter((g) => !isGameEmpty(g)).length === 0 && <p className="text-sm text-text-faint">Draft นี้ยังไม่มีฮีโร่</p>}
          {state.data.series.games.map((g) =>
            isGameEmpty(g) ? null : (
              <section key={g.gameNumber} className="space-y-2 rounded-card border border-border p-3">
                <h3 className="font-display text-sm font-semibold">Game {g.gameNumber}</h3>
                {(["mine", "enemy"] as const).map((t) => (
                  <div key={t} className="space-y-1">
                    <p className="text-xs text-text-faint">{t === "mine" ? "ทีมผู้สร้าง" : "ทีมคู่แข่ง"}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {g[t].picks.map((s, i) => (s ? <MiniHero key={`${s}-${i}`} hero={bySlug.get(s)} fallback={s} /> : null))}
                    </div>
                    {g[t].bans.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-text-faint">แบน</span>
                        {g[t].bans.map((s) => <MiniHero key={s} hero={bySlug.get(s)} fallback={s} className="opacity-70" />)}
                      </div>
                    )}
                  </div>
                ))}
              </section>
            )
          )}
          <div className="flex justify-end">
            <button type="button" onClick={() => onLoad(state.data)} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg">
              Load Preset
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
