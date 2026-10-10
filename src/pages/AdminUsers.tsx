import { useEffect, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, RefreshCw, Search, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { Chip } from "@/features/heroes/HeroFilters";
import { UserAvatar } from "@/components/UserAvatar";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { useToast } from "@/components/ui/toast";
import {
  getAudit,
  getUserDetail,
  listUsers,
  moderateUser,
  setUserAdmin,
  type AdminUserDetail,
  type ModerateAction,
  type UserFilter,
} from "@/services/adminUsers";

const PAGE = 20;
const FILTERS: [UserFilter, string][] = [
  ["all", "ทั้งหมด"],
  ["admin", "แอดมิน"],
  ["new7", "ใหม่ 7 วัน"],
  ["reported", "ถูกรายงาน"],
];

const AUDIT_LABEL: Record<string, string> = {
  grant_admin: "ให้สิทธิ์แอดมิน",
  revoke_admin: "ถอดสิทธิ์แอดมิน",
  remove_avatar: "ลบรูปโปรไฟล์",
  clear_bio: "ล้างแนะนำตัว",
  clear_game_name: "ล้างชื่อในเกม",
  clear_contacts: "ล้างช่องทางติดต่อ",
  hide_comments: "ซ่อนคอมเมนต์ทั้งหมด",
  unhide_comments: "เลิกซ่อนคอมเมนต์",
};

const EVENT_LABEL: Record<string, string> = {
  ai_coach_used: "Coach Ai",
  draft_created: "สร้าง Draft",
  draft_loaded: "เปิด Draft",
  draft_shared: "เผยแพร่ Draft",
  tier_list_created: "สร้าง Tier List",
  tier_list_shared: "เผยแพร่ Tier List",
  hero_viewed: "ดูฮีโร่",
  stats_viewed: "ดูสถิติ",
  matchup_viewed: "Matchup",
  counter_pick_used: "Counter Pick",
};

const fmt = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("th-TH", {
        day: "numeric",
        month: "short",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Bangkok",
      })
    : "—";

const BTN =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium transition " +
  "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
const BTN_SECONDARY = `${BTN} border border-border bg-bg-raised text-text hover:border-text-faint`;
const BTN_DANGER = `${BTN} border border-loss/40 bg-loss/10 text-loss hover:bg-loss/20`;
const BTN_DANGER_SOLID = `${BTN} bg-loss text-white hover:brightness-110`;
const BTN_PRIMARY = `${BTN} bg-accent text-accent-fg hover:brightness-110`;

const nameOf = (u: { displayName: string | null; handle: string | null }) => u.displayName || u.handle || "ผู้ใช้";

function UserList({ onOpen }: { onOpen: (id: string) => void }) {
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");
  const [page, setPage] = useState(0);

  // ค้นหาหลังหยุดพิมพ์ 350 ms เพื่อไม่ยิง DB ทุกตัวอักษร
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(input.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [input]);

  const listQ = useAsync(() => listUsers({ q, filter, offset: page * PAGE, limit: PAGE }), [q, filter, page]);
  const total = listQ.status === "success" ? listQ.data.total : 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-xl font-semibold">ผู้ใช้</h1>
          <p className="mt-1 text-xs text-text-faint">แอดมินเห็นอีเมลเต็ม · ทุกการจัดการถูกบันทึกประวัติ</p>
        </div>
        <button type="button" onClick={listQ.refetch} aria-label="รีเฟรช" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-text-muted hover:text-text">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-surface px-3 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-text-faint" />
        <input
          type="search"
          autoComplete="off"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="ค้นหาชื่อ / handle / อีเมล..."
          className="w-full bg-transparent text-base outline-none placeholder:text-text-faint sm:text-sm"
        />
      </div>

      <div role="group" aria-label="ตัวกรองผู้ใช้" className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {FILTERS.map(([k, label]) => (
          <Chip
            key={k}
            active={filter === k}
            onClick={() => {
              setFilter(k);
              setPage(0);
            }}
            label={label}
          />
        ))}
      </div>

      {listQ.status === "loading" && (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      )}
      {listQ.status === "error" && <ErrorState message={listQ.message} onRetry={listQ.refetch} />}
      {listQ.status === "success" && listQ.data.rows.length === 0 && (
        <EmptyState icon={Users} title="ไม่พบผู้ใช้" description="ลองเปลี่ยนคำค้นหาหรือตัวกรอง" />
      )}
      {listQ.status === "success" && listQ.data.rows.length > 0 && (
        <>
          <p className="text-xs text-text-muted">{total.toLocaleString()} คน · หน้า {page + 1}/{pages}</p>
          <ul className="space-y-2">
            {listQ.data.rows.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => onOpen(u.id)}
                  className="flex w-full items-start gap-3 rounded-card border border-border bg-bg-surface p-3 text-left transition hover:border-accent/40"
                >
                  <UserAvatar name={nameOf(u)} url={u.avatarUrl} className="h-11 w-11 shrink-0 text-sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{nameOf(u)}</span>
                      {u.handle && <span className="truncate text-xs text-text-faint">@{u.handle}</span>}
                      {u.isAdmin && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] leading-none text-accent">
                          <ShieldCheck className="h-3 w-3" /> แอดมิน
                        </span>
                      )}
                      {u.reportCount > 0 && (
                        <span className="rounded-full border border-loss/40 bg-loss/10 px-2 py-0.5 text-[11px] leading-none text-loss">
                          ถูกรายงาน {u.reportCount}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-text-muted">{u.email ?? "—"}</span>
                    <span className="mt-1 block text-[11px] text-text-faint">
                      สมัคร {fmt(u.createdAt)} · ใช้งานล่าสุด {fmt(u.lastActiveAt)}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-text-faint">
                      Draft {u.draftCount} · Tier List {u.tierListCount} · คอมเมนต์ {u.commentCount}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-2">
            <button type="button" className={BTN_SECONDARY} disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              <ChevronLeft className="h-4 w-4" /> ก่อนหน้า
            </button>
            <button type="button" className={BTN_SECONDARY} disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
              ถัดไป <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

type Pending = { title: string; run: () => Promise<unknown>; danger?: boolean };
type Act = { key: ModerateAction; label: string; ask: string };

function moderationActions(d: AdminUserDetail): Act[] {
  const list: (Act | false)[] = [
    !!d.avatarUrl && { key: "remove_avatar", label: "ลบรูปโปรไฟล์", ask: "ลบรูปโปรไฟล์ของผู้ใช้นี้?" },
    !!d.bio && { key: "clear_bio", label: "ล้างแนะนำตัว", ask: "ล้างแนะนำตัวของผู้ใช้นี้?" },
    !!d.gameName && { key: "clear_game_name", label: "ล้างชื่อในเกม", ask: "ล้างชื่อในเกมของผู้ใช้นี้?" },
    d.contactLinks.length > 0 && { key: "clear_contacts", label: "ล้างช่องทางติดต่อ", ask: "ล้างช่องทางติดต่อทั้งหมดของผู้ใช้นี้?" },
    d.counts.comments - d.counts.hiddenComments > 0 && {
      key: "hide_comments",
      label: "ซ่อนคอมเมนต์ทั้งหมด",
      ask: "ซ่อนคอมเมนต์ทั้งหมดของผู้ใช้นี้? (เลิกซ่อนได้ภายหลัง)",
    },
    d.counts.hiddenComments > 0 && {
      key: "unhide_comments",
      label: "เลิกซ่อนคอมเมนต์",
      ask: "เลิกซ่อนคอมเมนต์ที่ถูกซ่อนของผู้ใช้นี้?",
    },
  ];
  return list.filter((a): a is Act => !!a);
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-sm">
      <dt className="w-28 shrink-0 text-text-faint">{label}</dt>
      <dd className="min-w-0 flex-1 break-words">{children}</dd>
    </div>
  );
}

function UserDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const detailQ = useAsync(() => getUserDetail(id), [id]);
  const auditQ = useAsync(() => getAudit(id), [id]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    try {
      await pending.run();
      toast.success("ทำรายการแล้ว");
      detailQ.refetch();
      auditQ.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ");
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  return (
    <div className="space-y-4 pb-24">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text">
        <ArrowLeft className="h-4 w-4" /> กลับไปรายชื่อ
      </button>

      {detailQ.status === "loading" && <Skeleton className="h-48" />}
      {detailQ.status === "error" && <ErrorState message={detailQ.message} onRetry={detailQ.refetch} />}
      {detailQ.status === "success" && (() => {
        const d = detailQ.data;
        const self = user?.id === d.id;
        const acts = moderationActions(d);
        const activity = Object.entries(d.activity).sort((a, b) => b[1] - a[1]);
        return (
          <>
            <section className="flex items-start gap-3 rounded-card border border-border bg-bg-surface p-4">
              <UserAvatar name={nameOf(d)} url={d.avatarUrl} className="h-16 w-16 shrink-0 text-xl" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-display text-lg font-semibold">{nameOf(d)}</span>
                  {d.isAdmin && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] leading-none text-accent">
                      <ShieldCheck className="h-3 w-3" /> แอดมิน
                    </span>
                  )}
                </p>
                {d.handle && <p className="text-xs text-text-faint">@{d.handle}</p>}
                <p className="mt-1 break-all text-sm text-text-muted">{d.email ?? "—"}</p>
              </div>
            </section>

            <section className="space-y-2 rounded-card border border-border bg-bg-surface p-4">
              <dl className="space-y-2">
                <InfoRow label="สมัครเมื่อ">{fmt(d.createdAt)}</InfoRow>
                <InfoRow label="ยืนยันอีเมล">{d.emailConfirmedAt ? fmt(d.emailConfirmedAt) : "ยังไม่ได้ยืนยัน"}</InfoRow>
                <InfoRow label="ล็อกอินล่าสุด">{fmt(d.lastSignInAt)}</InfoRow>
                <InfoRow label="ใช้งานล่าสุด">{fmt(d.lastActiveAt)}</InfoRow>
                <InfoRow label="ชื่อในเกม">{d.gameName || "—"}</InfoRow>
                <InfoRow label="แนะนำตัว">{d.bio ? <span className="whitespace-pre-wrap">{d.bio}</span> : "—"}</InfoRow>
                <InfoRow label="ช่องทางติดต่อ">
                  {d.contactLinks.length === 0 ? (
                    "—"
                  ) : (
                    <span className="space-y-0.5">
                      {d.contactLinks.map((l) => (
                        <span key={l.app} className="block">
                          <span className="text-text-faint">{l.app}: </span>
                          {l.url}
                        </span>
                      ))}
                    </span>
                  )}
                </InfoRow>
              </dl>
            </section>

            <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  ["Draft", `${d.counts.drafts} (เผยแพร่ ${d.counts.publicDrafts})`],
                  ["Tier List", `${d.counts.tierLists} (เผยแพร่ ${d.counts.publicTierLists})`],
                  ["คอมเมนต์", `${d.counts.comments} (ซ่อน ${d.counts.hiddenComments})`],
                  ["ถูกรายงาน", String(d.counts.reportsReceived)],
                ] as [string, string][]
              ).map(([label, v]) => (
                <div key={label} className="rounded-card border border-border bg-bg-surface p-3">
                  <p className="text-xs text-text-faint">{label}</p>
                  <p className="mt-1 text-sm font-semibold">{v}</p>
                </div>
              ))}
            </section>

            <section className="space-y-2">
              <h2 className="font-display text-base font-semibold">กิจกรรม 30 วัน</h2>
              {activity.length === 0 ? (
                <p className="text-sm text-text-faint">ยังไม่มีกิจกรรม</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {activity.map(([k, n]) => (
                    <span key={k} className="rounded-full border border-border bg-bg-surface px-3 py-1 text-xs">
                      {EVENT_LABEL[k] ?? k} · {n}
                    </span>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3 rounded-card border border-border bg-bg-surface p-4">
              <h2 className="font-display text-base font-semibold">การจัดการ</h2>

              {pending && (
                <div className="space-y-3 rounded-lg border border-border bg-bg-raised p-3">
                  <p className="text-sm">{pending.title}</p>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={() => setPending(null)}>
                      ยกเลิก
                    </button>
                    <button type="button" className={pending.danger ? BTN_DANGER_SOLID : BTN_PRIMARY} disabled={busy} onClick={() => void confirm()}>
                      {busy ? "กำลังทำรายการ..." : "ยืนยัน"}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {d.isAdmin ? (
                  <button
                    type="button"
                    className={BTN_DANGER}
                    disabled={self || busy}
                    title={self ? "ถอดสิทธิ์ของตัวเองไม่ได้" : undefined}
                    onClick={() =>
                      setPending({
                        title: `ถอดสิทธิ์แอดมินของ ${nameOf(d)}?`,
                        danger: true,
                        run: () => setUserAdmin(d.id, false),
                      })
                    }
                  >
                    <ShieldCheck className="h-4 w-4" /> ถอดสิทธิ์แอดมิน
                  </button>
                ) : (
                  <button
                    type="button"
                    className={BTN_SECONDARY}
                    disabled={busy}
                    onClick={() =>
                      setPending({
                        title: `ให้สิทธิ์แอดมินแก่ ${nameOf(d)}? คนนี้จะแก้ข้อมูลและจัดการผู้ใช้คนอื่นได้`,
                        danger: true,
                        run: () => setUserAdmin(d.id, true),
                      })
                    }
                  >
                    <ShieldCheck className="h-4 w-4" /> ให้สิทธิ์แอดมิน
                  </button>
                )}
                {acts.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    className={a.key === "unhide_comments" ? BTN_SECONDARY : BTN_DANGER}
                    disabled={busy}
                    onClick={() =>
                      setPending({ title: a.ask, danger: a.key !== "unhide_comments", run: () => moderateUser(d.id, a.key) })
                    }
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              {acts.length === 0 && <p className="text-xs text-text-faint">ไม่มีเนื้อหาให้จัดการ (รูป แนะนำตัว ชื่อในเกม ช่องทางติดต่อ คอมเมนต์)</p>}
              <p className="text-[11px] text-text-faint">
                ลบรูปโปรไฟล์จะล้างลิงก์รูปในโปรไฟล์เท่านั้น ไฟล์รูปใน Storage ยังอยู่ · ทุกการกระทำถูกบันทึกในประวัติ
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-display text-base font-semibold">คอมเมนต์ล่าสุด</h2>
              {d.recentComments.length === 0 ? (
                <p className="text-sm text-text-faint">ยังไม่มีคอมเมนต์</p>
              ) : (
                <ul className="divide-y divide-border rounded-card border border-border bg-bg-surface">
                  {d.recentComments.map((c) => (
                    <li key={c.id} className="space-y-1 px-3 py-2.5">
                      <p className="whitespace-pre-wrap break-words text-sm">{c.body}</p>
                      <p className="text-[11px] text-text-faint">
                        {fmt(c.createdAt)}
                        {c.heroSlug ? ` · ${c.heroSlug}` : ""}
                        {c.hidden && <span className="ml-2 rounded-full border border-loss/40 px-1.5 py-0.5 text-loss">ถูกซ่อน</span>}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {d.reports.length > 0 && (
              <section className="space-y-2">
                <h2 className="font-display text-base font-semibold">รายงานที่ได้รับ</h2>
                <ul className="divide-y divide-border rounded-card border border-border bg-bg-surface">
                  {d.reports.map((r, i) => (
                    <li key={`${r.commentId}-${i}`} className="px-3 py-2.5 text-sm">
                      <p>{r.reason}</p>
                      {r.detail && <p className="mt-0.5 text-xs text-text-muted">{r.detail}</p>}
                      <p className="mt-0.5 text-[11px] text-text-faint">{fmt(r.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        );
      })()}

      <section className="space-y-2">
        <h2 className="font-display text-base font-semibold">ประวัติการจัดการ</h2>
        {auditQ.status === "loading" && <Skeleton className="h-12" />}
        {auditQ.status === "error" && <ErrorState message={auditQ.message} onRetry={auditQ.refetch} />}
        {auditQ.status === "success" && auditQ.data.length === 0 && <p className="text-sm text-text-faint">ยังไม่มีประวัติ</p>}
        {auditQ.status === "success" && auditQ.data.length > 0 && (
          <ul className="divide-y divide-border rounded-card border border-border bg-bg-surface">
            {auditQ.data.map((a) => (
              <li key={a.id} className="flex gap-3 px-3 py-2.5 text-sm">
                <span className="w-28 shrink-0 text-xs text-text-faint">{fmt(a.createdAt)}</span>
                <span className="min-w-0 flex-1">
                  {AUDIT_LABEL[a.action] ?? a.action}
                  {a.affected != null && a.affected > 0 ? ` (${a.affected})` : ""}
                  <span className="text-text-faint"> · โดย {a.adminName ?? "แอดมิน"}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function AdminUsers() {
  const [selected, setSelected] = useState<string | null>(null);
  return selected ? <UserDetail key={selected} id={selected} onBack={() => setSelected(null)} /> : <UserList onOpen={setSelected} />;
}
