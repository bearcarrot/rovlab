import { useMemo, useState } from "react";
import { ExternalLink, ShieldCheck, Search, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import {
  deleteCommunityContent,
  listCommunityContent,
  listPublishedBuilds,
  MODERATION_LIMIT,
  setCommunityHidden,
  type ModerationKind,
} from "@/services/adminModeration";
import { buildError, deleteBuild, setBuildHidden } from "@/services/userBuilds";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { Chip } from "@/features/heroes/HeroFilters";
import { Switch } from "@/features/community/Switch";
import { ConfirmHost, confirmDialog } from "@/features/community/confirm";
import { useDebounced } from "@/features/community/useDebounced";
import { timeAgo } from "@/features/community/format";

type Tab = ModerationKind | "build";
const TABS: [Tab, string][] = [
  ["draft", "Draft"],
  ["tier_list", "Tier List"],
  ["build", "Item Build"],
];
const NOUN: Record<Tab, string> = { draft: "Draft", tier_list: "Tier List", build: "บิลด์" };
const HREF: Record<Tab, string> = { draft: "/draft/", tier_list: "/tier-list/", build: "/build/view/" };
const DELETE_NOTE: Record<Tab, string> = {
  draft: "จะถูกลบออกจาก Community ถาวร (รวมถึงคะแนนถูกใจ/ไม่ถูกใจ) เจ้าของยังมีต้นฉบับส่วนตัวอยู่",
  tier_list: "จะถูกลบออกจาก Community ถาวร (รวมถึงคะแนนถูกใจ/ไม่ถูกใจ) เจ้าของยังมีต้นฉบับส่วนตัวอยู่",
  build: "จะถูกลบถาวรจากบัญชีของเจ้าของด้วย (รวมถึงคะแนนถูกใจ/ไม่ถูกใจ) กู้คืนไม่ได้",
};

const ICON_BTN = "flex h-10 w-10 items-center justify-center rounded-lg border border-border text-text-muted hover:text-text disabled:opacity-60";

interface Row {
  id: string;
  title: string;
  sub: string;
  hidden: boolean;
  /** แสดงเฉพาะเมื่อมีคนโหวตอย่างน้อย 1 ครั้ง (draft / tier list เท่านั้น) */
  votes?: { likes: number; dislikes: number };
}

const KIND_DETAIL: Record<string, string> = { single: "เกมเดียว", bo3: "BO3", bo5: "BO5", bo7: "BO7" };

async function loadRows(tab: Tab, search: string): Promise<{ rows: Row[]; capped: boolean }> {
  if (tab === "build") {
    const needle = search.trim().toLowerCase();
    const list = await listPublishedBuilds();
    const rows = list
      .filter((b) => needle === "" || b.name.toLowerCase().includes(needle) || b.heroName.toLowerCase().includes(needle))
      .map((b) => ({
        id: b.id,
        title: b.name,
        sub: [b.heroName, b.publishedAt ? `เผยแพร่ ${timeAgo(b.publishedAt)}` : ""].filter(Boolean).join(" · "),
        hidden: b.hidden,
      }));
    return { rows, capped: list.length >= 200 };
  }
  const list = await listCommunityContent(tab, search);
  const rows = list.map((it) => {
    const author = it.authorName || (it.handle ? `@${it.handle}` : "ผู้ใช้");
    const detail =
      tab === "draft"
        ? (it.detail ? (KIND_DETAIL[it.detail] ?? it.detail) : "")
        : [it.detail, it.heroCount != null ? `${it.heroCount} ฮีโร่` : ""].filter(Boolean).join(" · ");
    return {
      id: it.id,
      title: it.title,
      sub: [`โดย ${author}`, detail, `เผยแพร่ ${timeAgo(it.publishedAt)}`].filter(Boolean).join(" · "),
      hidden: it.hidden,
      votes: it.likes + it.dislikes > 0 ? { likes: it.likes, dislikes: it.dislikes } : undefined,
    };
  });
  return { rows, capped: list.length >= MODERATION_LIMIT };
}

// แท็บ Community ในหน้าแอดมิน: ซ่อน / ลบถาวร Community Draft, Community Tier List และ Item Build ที่ผู้ใช้เผยแพร่
// (Combo อยู่ที่แท็บ Combo) — สิทธิ์บังคับที่ DB: RPC ตรวจ is_admin() / RLS + trigger ของ user_builds
export function AdminCommunity() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("draft");
  const [query, setQuery] = useState("");
  const search = useDebounced(query, 300);
  const [onlyHidden, setOnlyHidden] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const q = useAsync(() => loadRows(tab, search), [tab, search]);

  const shown = useMemo(() => {
    if (q.status !== "success") return [];
    return onlyHidden ? q.data.rows.filter((r) => r.hidden) : q.data.rows;
  }, [q, onlyHidden]);

  async function fail(e: unknown, fallback: string) {
    toast.error(tab === "build" ? buildError(e, fallback) : e instanceof Error ? e.message : fallback);
  }

  async function toggleHidden(r: Row, hidden: boolean) {
    setBusyId(r.id);
    try {
      if (tab === "build") await setBuildHidden(r.id, hidden);
      else await setCommunityHidden(tab, r.id, hidden);
      toast.success(hidden ? "ซ่อนแล้ว" : "เลิกซ่อนแล้ว");
      q.refetch();
    } catch (e) {
      await fail(e, "ทำรายการไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(r: Row) {
    const ok = await confirmDialog({ title: `ลบ ${NOUN[tab]} นี้?`, message: `“${r.title}” ${DELETE_NOTE[tab]}`, confirmLabel: "ลบถาวร", danger: true });
    if (!ok) return;
    setBusyId(r.id);
    try {
      if (tab === "build") await deleteBuild(r.id);
      else await deleteCommunityContent(tab, r.id);
      toast.success("ลบแล้ว");
      q.refetch();
    } catch (e) {
      await fail(e, "ลบไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4 pb-4">
      <ConfirmHost />
      <div>
        <h2 className="font-display text-lg font-semibold">Community</h2>
        <p className="mt-1 text-sm text-text-muted">
          “ซ่อน” = ไม่แสดงให้ใครนอกจากเจ้าของและแอดมิน (เลิกซ่อนได้) · “ลบถาวร” = กู้คืนไม่ได้ · Combo จัดการที่แท็บ Combo
        </p>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0" role="group" aria-label="ประเภทเนื้อหา">
        {TABS.map(([k, label]) => (
          <Chip key={k} active={tab === k} onClick={() => setTab(k)} label={label} />
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-bg-surface px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === "build" ? "ค้นหาชื่อบิลด์หรือฮีโร่..." : "ค้นหาชื่อหรือผู้สร้าง..."}
            aria-label="ค้นหา"
            className="w-full min-w-0 bg-transparent text-base outline-none placeholder:text-text-faint sm:text-sm"
          />
        </div>
        <Chip active={onlyHidden} onClick={() => setOnlyHidden((v) => !v)} label="ซ่อนอยู่" />
      </div>

      {q.status === "loading" && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      )}
      {q.status === "error" && <ErrorState message={q.message} onRetry={q.refetch} />}

      {q.status === "success" && (
        <>
          <p className="text-xs text-text-muted">
            {shown.length === q.data.rows.length ? q.data.rows.length : `${shown.length}/${q.data.rows.length}`} รายการ
            {q.data.capped && " (แสดงรายการล่าสุดเท่านั้น ใช้ช่องค้นหาเพื่อหาเพิ่ม)"}
          </p>
          {q.data.rows.length === 0 && (
            <EmptyState icon={ShieldCheck} title={search.trim() ? "ไม่พบรายการที่ตรงกับคำค้น" : `ยังไม่มี ${NOUN[tab]} ที่เผยแพร่`} />
          )}
          {q.data.rows.length > 0 && shown.length === 0 && <p className="text-sm text-text-faint">ไม่มีรายการที่ถูกซ่อน</p>}
          {shown.length > 0 && (
            <ul className="space-y-2">
              {shown.map((r) => (
                <li key={r.id} className="rounded-card border border-border bg-bg-surface p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-medium">{r.title}</p>
                      <p className="mt-0.5 break-words text-xs text-text-muted">{r.sub}</p>
                      {r.votes && (
                        <p className="mt-1 flex items-center gap-3 text-xs text-text-muted">
                          <span className="inline-flex items-center gap-1" aria-label={`ถูกใจ ${r.votes.likes}`}>
                            <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                            {r.votes.likes}
                          </span>
                          <span className="inline-flex items-center gap-1" aria-label={`ไม่ถูกใจ ${r.votes.dislikes}`}>
                            <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
                            {r.votes.dislikes}
                          </span>
                        </p>
                      )}
                    </div>
                    {r.hidden && (
                      <span className="shrink-0 rounded-full border border-loss/40 px-2 py-0.5 text-[11px] text-loss">ซ่อนอยู่</span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-2">
                    <Switch
                      checked={r.hidden}
                      disabled={busyId === r.id}
                      onChange={(v) => void toggleHidden(r, v)}
                      label="ซ่อน"
                    />
                    <div className="ml-auto flex gap-1.5">
                      <a
                        href={`${HREF[tab]}${r.id}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`เปิดดู ${NOUN[tab]} (แท็บใหม่)`}
                        className={ICON_BTN}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <button type="button" aria-label={`ลบ ${NOUN[tab]}`} disabled={busyId === r.id} onClick={() => void remove(r)} className={`${ICON_BTN} hover:text-loss`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
