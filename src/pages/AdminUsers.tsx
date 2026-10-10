import { useEffect, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, RefreshCw, Search, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { Chip } from "@/features/heroes/HeroFilters";
import { UserAvatar } from "@/components/UserAvatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { useToast } from "@/components/ui/toast";
import { CREATOR_CATEGORIES, ROLE_LABEL, SYSTEM_ROLES, creatorLabel, type SystemRole } from "@/lib/creator";
import {
  amISuperAdmin,
  getAudit,
  getUserDetail,
  getUserStats,
  listUsers,
  moderateUser,
  setAccountStatus,
  setUserRole,
  setVerification,
  type AccountStatus,
  type AdminUserDetail,
  type ModerateAction,
  type UserFilter,
  type VerifiedFilter,
} from "@/services/adminUsers";

const PAGE = 20;
const FILTERS: [UserFilter, string][] = [
  ["all", "ทั้งหมด"],
  ["new7", "ใหม่ 7 วัน"],
  ["reported", "ถูกรายงาน"],
];

const AUDIT_LABEL: Record<string, string> = {
  grant_admin: "ให้สิทธิ์แอดมิน",
  revoke_admin: "ถอดสิทธิ์แอดมิน",
  set_role: "เปลี่ยนบทบาท",
  grant_verification: "ให้ป้าย Verified",
  update_verification: "แก้ข้อมูล Verified",
  revoke_verification: "ถอดป้าย Verified",
  suspend_account: "ระงับบัญชี",
  reinstate_account: "คืนสถานะบัญชี",
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
  "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60";
const BTN_SECONDARY = `${BTN} border border-border bg-bg-raised text-text hover:border-text-faint`;
const BTN_DANGER = `${BTN} border border-loss/40 bg-loss/10 text-loss hover:bg-loss/20`;
const BTN_DANGER_SOLID = `${BTN} bg-loss text-white hover:brightness-110`;
const BTN_PRIMARY = `${BTN} bg-accent text-accent-fg hover:brightness-110`;
const CTL =
  "block w-full rounded-lg border border-border bg-bg-raised px-3 text-base text-text outline-none transition " +
  "placeholder:text-text-faint focus:border-accent focus:ring-1 focus:ring-accent sm:text-sm";
const INPUT = `${CTL} h-11`;
const TEXTAREA = `${CTL} min-h-[88px] resize-y py-2.5`;

const nameOf = (u: { displayName: string | null; handle: string | null }) => u.displayName || u.handle || "ผู้ใช้";

function RoleBadge({ role }: { role: SystemRole }) {
  if (role === "member") return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] leading-none text-accent">
      <ShieldCheck className="h-3 w-3" aria-hidden /> {ROLE_LABEL[role]}
    </span>
  );
}

function SuspendedBadge() {
  return (
    <span className="rounded-full border border-loss/40 bg-loss/10 px-2 py-0.5 text-[11px] leading-none text-loss">ระงับบัญชี</span>
  );
}

// ---------- สรุปตัวเลข (ข้อมูลจริงจาก DB) ----------
function StatsStrip() {
  const q = useAsync(() => getUserStats(), []);
  const cells: [string, number | null][] =
    q.status === "success"
      ? [
          ["ผู้ใช้ทั้งหมด", q.data.total],
          ["Verified Creator", q.data.verified],
          ["Moderator", q.data.moderators],
          ["ผู้ดูแล (Admin+)", q.data.admins],
        ]
      : [
          ["ผู้ใช้ทั้งหมด", null],
          ["Verified Creator", null],
          ["Moderator", null],
          ["ผู้ดูแล (Admin+)", null],
        ];
  return (
    <section aria-label="สรุปผู้ใช้" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {cells.map(([label, n]) => (
        <div key={label} className="rounded-card border border-border bg-bg-surface p-3">
          <p className="text-xs text-text-faint">{label}</p>
          <p className="mt-1 font-display text-xl font-semibold">{n == null ? (q.status === "error" ? "—" : "…") : n.toLocaleString()}</p>
        </div>
      ))}
    </section>
  );
}

function UserList({ onOpen }: { onOpen: (id: string) => void }) {
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");
  const [role, setRole] = useState<SystemRole | "">("");
  const [verified, setVerified] = useState<VerifiedFilter>("");
  const [status, setStatus] = useState<AccountStatus | "">("");
  const [page, setPage] = useState(0);

  // ค้นหาหลังหยุดพิมพ์ 350 ms เพื่อไม่ยิง DB ทุกตัวอักษร
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(input.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [input]);

  const listQ = useAsync(
    () => listUsers({ q, filter, role, verified, status, offset: page * PAGE, limit: PAGE }),
    [q, filter, role, verified, status, page]
  );
  const total = listQ.status === "success" ? listQ.data.total : 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const reset = () => setPage(0);

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

      <StatsStrip />

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
              reset();
            }}
            label={label}
          />
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <select
          aria-label="กรองตามบทบาท"
          className={INPUT}
          value={role}
          onChange={(e) => {
            setRole(e.target.value as SystemRole | "");
            reset();
          }}
        >
          <option value="">บทบาท: ทั้งหมด</option>
          {SYSTEM_ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <select
          aria-label="กรองตามสถานะ Verified"
          className={INPUT}
          value={verified}
          onChange={(e) => {
            setVerified(e.target.value as VerifiedFilter);
            reset();
          }}
        >
          <option value="">Verified: ทั้งหมด</option>
          <option value="yes">Verified แล้ว</option>
          <option value="no">ยังไม่ Verified</option>
        </select>
        <select
          aria-label="กรองตามสถานะบัญชี"
          className={INPUT}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as AccountStatus | "");
            reset();
          }}
        >
          <option value="">บัญชี: ทั้งหมด</option>
          <option value="active">ใช้งานปกติ</option>
          <option value="suspended">ถูกระงับ</option>
        </select>
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
                  className="flex w-full items-start gap-3 rounded-card border border-border bg-bg-surface p-3 text-left transition hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  <UserAvatar name={nameOf(u)} url={u.avatarUrl} className="h-11 w-11 shrink-0 text-sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="flex min-w-0 items-center gap-1">
                        <span className="truncate text-sm font-medium">{nameOf(u)}</span>
                        <VerifiedBadge category={u.verifiedCategory} />
                      </span>
                      {u.handle && <span className="truncate text-xs text-text-faint">@{u.handle}</span>}
                      <RoleBadge role={u.role} />
                      {u.accountStatus === "suspended" && <SuspendedBadge />}
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

// run รับเหตุผล (ถ้า reason = true ต้องกรอกก่อนยืนยัน)
type Pending = { title: string; run: (reason: string) => Promise<unknown>; danger?: boolean; reason?: boolean };
type Ask = (p: Pending) => void;
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

const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-3 rounded-card border border-border bg-bg-surface p-4">
    <h2 className="font-display text-base font-semibold">{title}</h2>
    {children}
  </section>
);

// ---------- บทบาทระบบ: เปลี่ยนได้เฉพาะ Super Admin (ฝั่ง DB บังคับซ้ำ) ----------
function RolePanel({ d, self, canEdit, busy, ask }: { d: AdminUserDetail; self: boolean; canEdit: boolean; busy: boolean; ask: Ask }) {
  const [next, setNext] = useState<SystemRole>(d.role);
  return (
    <Panel title="บทบาทในระบบ">
      <p className="text-sm text-text-muted">
        ปัจจุบัน: <span className="font-medium text-text">{ROLE_LABEL[d.role]}</span> · ป้าย Verified ไม่เกี่ยวกับบทบาท
      </p>
      {canEdit ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <select aria-label="บทบาท" className={`${INPUT} sm:max-w-xs`} value={next} disabled={self || busy} onChange={(e) => setNext(e.target.value as SystemRole)}>
            {SYSTEM_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={BTN_DANGER}
            disabled={self || busy || next === d.role}
            title={self ? "เปลี่ยนบทบาทของตัวเองไม่ได้" : undefined}
            onClick={() =>
              ask({
                title: `เปลี่ยนบทบาทของ ${nameOf(d)} จาก ${ROLE_LABEL[d.role]} เป็น ${ROLE_LABEL[next]}?`,
                danger: true,
                run: () => setUserRole(d.id, next),
              })
            }
          >
            <ShieldCheck className="h-4 w-4" /> เปลี่ยนบทบาท
          </button>
        </div>
      ) : (
        <p className="text-xs text-text-faint">การเปลี่ยนบทบาทต้องเป็น Super Admin</p>
      )}
    </Panel>
  );
}

// ---------- Verified Creator: ผู้ดูแลตั้งเอง ไม่มีขั้นตอนสมัคร ----------
function VerificationPanel({ d, busy, ask }: { d: AdminUserDetail; busy: boolean; ask: Ask }) {
  const toast = useToast();
  const v = d.verification && !d.verification.revokedAt ? d.verification : null;
  const [cat, setCat] = useState<string>(d.verifiedCategory ?? "");
  const [links, setLinks] = useState((v?.publicLinks ?? []).join("\n"));
  const [evidence, setEvidence] = useState(v?.evidenceRef ?? "");

  function parseLinks(): string[] | null {
    const list = links.split("\n").map((s) => s.trim()).filter(Boolean);
    if (list.length > 10 || list.some((u) => u.length > 300 || !/^https?:\/\/\S+$/i.test(u))) {
      toast.error("ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https:// (สูงสุด 10 รายการ)");
      return null;
    }
    return list;
  }

  return (
    <Panel title="Verified Creator">
      {d.verifiedCategory ? (
        <p className="flex items-center gap-1.5 text-sm">
          <VerifiedBadge category={d.verifiedCategory} />
          <span>{creatorLabel(d.verifiedCategory)}</span>
        </p>
      ) : (
        <p className="text-sm text-text-muted">ยังไม่ได้รับป้าย Verified</p>
      )}

      {d.verification && (
        <dl className="space-y-2 rounded-lg border border-border bg-bg-raised p-3">
          <InfoRow label="อนุมัติโดย">{d.verification.approvedByName ?? "—"}</InfoRow>
          <InfoRow label="เมื่อ">{fmt(d.verification.verifiedAt)}</InfoRow>
          <InfoRow label="เหตุผล">{d.verification.reason}</InfoRow>
          <InfoRow label="หลักฐาน (ภายใน)">{d.verification.evidenceRef ?? "—"}</InfoRow>
          {d.verification.revokedAt && (
            <InfoRow label="ถอดป้ายเมื่อ">
              {fmt(d.verification.revokedAt)}
              {d.verification.revokeReason ? ` · ${d.verification.revokeReason}` : ""}
            </InfoRow>
          )}
        </dl>
      )}

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-text-muted">หมวดครีเอเตอร์</span>
          <select className={INPUT} value={cat} disabled={busy} onChange={(e) => setCat(e.target.value)}>
            <option value="">— เลือกหมวด —</option>
            {CREATOR_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-text-muted">ลิงก์สาธารณะ (บรรทัดละ 1 ลิงก์)</span>
          <textarea className={TEXTAREA} rows={3} value={links} disabled={busy} placeholder="https://..." onChange={(e) => setLinks(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-text-muted">อ้างอิงหลักฐาน (เห็นเฉพาะแอดมิน)</span>
          <input className={INPUT} value={evidence} maxLength={300} disabled={busy} onChange={(e) => setEvidence(e.target.value)} />
        </label>
        <p className="text-[11px] text-text-faint">การใส่ลิงก์โซเชียลไม่ได้ทำให้ผู้ใช้ Verified เอง ต้องกดอนุมัติที่นี่เท่านั้น</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={busy || !cat}
            onClick={() => {
              const list = parseLinks();
              if (!list) return;
              ask({
                title: `${d.verifiedCategory ? "แก้ข้อมูล Verified" : "ให้ป้าย Verified"} แก่ ${nameOf(d)} (${creatorLabel(cat)})? ระบุเหตุผล`,
                reason: true,
                run: (r) => setVerification(d.id, cat, r, list, evidence.trim() || null),
              });
            }}
          >
            {d.verifiedCategory ? "บันทึกการแก้ไข" : "ให้ป้าย Verified"}
          </button>
          {d.verifiedCategory && (
            <button
              type="button"
              className={BTN_DANGER}
              disabled={busy}
              onClick={() =>
                ask({
                  title: `ถอดป้าย Verified ของ ${nameOf(d)}? ระบุเหตุผล`,
                  danger: true,
                  reason: true,
                  run: (r) => setVerification(d.id, null, r),
                })
              }
            >
              ถอดป้าย Verified
            </button>
          )}
        </div>
      </div>
    </Panel>
  );
}

function StatusPanel({ d, self, busy, ask }: { d: AdminUserDetail; self: boolean; busy: boolean; ask: Ask }) {
  const suspended = d.accountStatus === "suspended";
  return (
    <Panel title="สถานะบัญชี">
      <p className="text-sm text-text-muted">
        ปัจจุบัน: <span className={suspended ? "font-medium text-loss" : "font-medium text-text"}>{suspended ? "ถูกระงับ" : "ใช้งานปกติ"}</span>
      </p>
      <button
        type="button"
        className={suspended ? BTN_SECONDARY : BTN_DANGER}
        disabled={self || busy}
        title={self ? "เปลี่ยนสถานะบัญชีตัวเองไม่ได้" : undefined}
        onClick={() =>
          ask({
            title: suspended ? `คืนสถานะบัญชีของ ${nameOf(d)}? ระบุเหตุผล` : `ระงับบัญชีของ ${nameOf(d)}? ระบุเหตุผล`,
            danger: !suspended,
            reason: true,
            run: (r) => setAccountStatus(d.id, suspended ? "active" : "suspended", r),
          })
        }
      >
        {suspended ? "คืนสถานะบัญชี" : "ระงับบัญชี"}
      </button>
      <p className="text-[11px] text-text-faint">
        ตอนนี้สถานะ "ระงับ" เป็นเครื่องหมายและบันทึกประวัติเท่านั้น ยังไม่ได้บล็อกการคอมเมนต์หรือสร้างเนื้อหา
      </p>
    </Panel>
  );
}

function UserDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const detailQ = useAsync(() => getUserDetail(id), [id]);
  const auditQ = useAsync(() => getAudit(id), [id]);
  const superQ = useAsync(() => amISuperAdmin(), []);
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const canEditRole = superQ.status === "success" && superQ.data === true;

  const ask: Ask = (p) => {
    setReason("");
    setPending(p);
  };

  async function confirm() {
    if (!pending) return;
    const r = reason.trim();
    if (pending.reason && !r) {
      toast.error("ต้องระบุเหตุผล");
      return;
    }
    setBusy(true);
    try {
      await pending.run(r);
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
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-display text-lg font-semibold">{nameOf(d)}</span>
                    <VerifiedBadge category={d.verifiedCategory} />
                  </span>
                  <RoleBadge role={d.role} />
                  {d.accountStatus === "suspended" && <SuspendedBadge />}
                </p>
                {d.handle && <p className="text-xs text-text-faint">@{d.handle}</p>}
                <p className="mt-1 break-all text-sm text-text-muted">{d.email ?? "—"}</p>
              </div>
            </section>

            {pending && (
              <div role="alertdialog" aria-label="ยืนยันการทำรายการ" className="sticky top-2 z-20 space-y-3 rounded-card border border-accent/40 bg-bg-surface p-4 shadow-card">
                <p className="text-sm">{pending.title}</p>
                {pending.reason && (
                  <textarea
                    className={TEXTAREA}
                    rows={2}
                    maxLength={500}
                    autoFocus
                    placeholder="เหตุผล (บันทึกในประวัติ)"
                    value={reason}
                    disabled={busy}
                    onChange={(e) => setReason(e.target.value)}
                  />
                )}
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

            <section className="space-y-2 rounded-card border border-border bg-bg-surface p-4">
              <dl className="space-y-2">
                <InfoRow label="สมัครเมื่อ">{fmt(d.createdAt)}</InfoRow>
                <InfoRow label="ช่องทางล็อกอิน">{d.authProvider ?? "—"}</InfoRow>
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

            <RolePanel key={`role-${d.role}`} d={d} self={self} canEdit={canEditRole} busy={busy} ask={ask} />
            <VerificationPanel key={`ver-${d.verifiedCategory ?? "none"}-${d.verification?.verifiedAt ?? ""}`} d={d} busy={busy} ask={ask} />
            <StatusPanel d={d} self={self} busy={busy} ask={ask} />

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

            <Panel title="จัดการเนื้อหา">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {acts.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    className={a.key === "unhide_comments" ? BTN_SECONDARY : BTN_DANGER}
                    disabled={busy}
                    onClick={() => ask({ title: a.ask, danger: a.key !== "unhide_comments", run: () => moderateUser(d.id, a.key) })}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              {acts.length === 0 && <p className="text-xs text-text-faint">ไม่มีเนื้อหาให้จัดการ (รูป แนะนำตัว ชื่อในเกม ช่องทางติดต่อ คอมเมนต์)</p>}
              <p className="text-[11px] text-text-faint">
                ลบรูปโปรไฟล์จะล้างลิงก์รูปในโปรไฟล์เท่านั้น ไฟล์รูปใน Storage ยังอยู่ · ทุกการกระทำถูกบันทึกในประวัติ
              </p>
            </Panel>

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
                  {a.action === "set_role" && a.to ? ` (${ROLE_LABEL[a.from ?? "member"] ?? a.from} → ${ROLE_LABEL[a.to] ?? a.to})` : ""}
                  {(a.action.endsWith("_verification") && a.to) ? ` (${creatorLabel(a.to)})` : ""}
                  {a.affected != null && a.affected > 0 ? ` (${a.affected})` : ""}
                  <span className="text-text-faint"> · โดย {a.adminName ?? "แอดมิน"}</span>
                  {a.reason && <span className="block break-words text-xs text-text-muted">เหตุผล: {a.reason}</span>}
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
