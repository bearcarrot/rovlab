import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Inbox, Mail, RefreshCw } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { Chip } from "@/features/heroes/HeroFilters";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { CONTACT_COUNTS_CHANGED } from "@/features/auth/useAdminContactCount";
import {
  CONTACT_TOPICS,
  getContactCounts,
  listContactMessages,
  updateContactMessage,
  type ContactRow,
  type ContactStatus,
} from "@/services/contact";

const PAGE = 20;

const STATUS_FILTERS: [ContactStatus | "all", string][] = [
  ["new", "ใหม่"],
  ["replied", "ตอบแล้ว"],
  ["closed", "ปิดเรื่อง"],
  ["all", "ทั้งหมด"],
];
const STATUS_LABEL: Record<ContactStatus, string> = { new: "ใหม่", replied: "ตอบแล้ว", closed: "ปิดเรื่อง" };
const STATUS_STYLE: Record<ContactStatus, string> = {
  new: "border-loss/40 bg-loss/10 text-loss",
  replied: "border-win/40 bg-win/10 text-win",
  closed: "border-border bg-bg-raised text-text-muted",
};
// ปุ่มเปลี่ยนสถานะ (ตัวที่เป็นสถานะปัจจุบันจะไม่แสดง)
const SET_STATUS: [ContactStatus, string][] = [
  ["replied", "ตอบแล้ว"],
  ["closed", "ปิดเรื่อง"],
  ["new", "กลับไปเป็นใหม่"],
];
const TOPIC_LABEL = Object.fromEntries(CONTACT_TOPICS.map((t) => [t.value, t.label]));

// อีเมลมาจากผู้ใช้ (ส่งตรงเข้า RPC ได้): ทำปุ่มตอบกลับเฉพาะรูปแบบปลอดภัย กันการแทรก header ใน mailto (?bcc=...)
const SAFE_EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

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
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-xs font-medium transition " +
  "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
const BTN_SECONDARY = `${BTN} border border-border bg-bg-raised text-text hover:border-text-faint`;

function ContactCard({ row, onChanged }: { row: ContactRow; onChanged: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState(row.adminNote ?? "");
  const [busy, setBusy] = useState(false);
  const member = row.displayName || row.handle;
  const canReply = SAFE_EMAIL.test(row.email);
  const important = row.topic === "privacy" || row.topic === "copyright";
  const subject = `Re: [RoV LAB] ${TOPIC_LABEL[row.topic] ?? "ติดต่อ"}`;

  useEffect(() => {
    setNote(row.adminNote ?? "");
  }, [row.id, row.adminNote]);

  async function setStatus(status: ContactStatus) {
    setBusy(true);
    try {
      await updateContactMessage(row.id, status, note);
      toast.success("บันทึกแล้ว");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="space-y-3 rounded-card border border-border bg-bg-surface p-3">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className={cn("rounded-full border px-2 py-0.5 leading-none", STATUS_STYLE[row.status])}>
          {STATUS_LABEL[row.status]}
        </span>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 leading-none",
            important ? "border-accent/40 bg-accent/10 text-accent" : "border-border bg-bg-raised text-text-muted"
          )}
        >
          {TOPIC_LABEL[row.topic] ?? row.topic}
        </span>
        <span className="ml-auto text-text-faint">{fmt(row.createdAt)}</span>
      </div>

      <div className="space-y-0.5 text-sm">
        <p className="break-words font-medium">{row.name}</p>
        <p className="break-all text-xs text-text-muted">{row.email}</p>
        {member && (
          <p className="break-words text-[11px] text-text-faint">
            สมาชิก: {member}
            {row.handle && row.displayName ? ` @${row.handle}` : ""}
          </p>
        )}
      </div>

      <p className="whitespace-pre-wrap break-words rounded-lg border border-border bg-bg-raised/50 p-2.5 text-sm">
        {row.message}
      </p>

      <div className="space-y-2">
        <label className="block text-xs text-text-faint" htmlFor={`contact-note-${row.id}`}>
          โน้ตของแอดมิน {row.reviewedAt ? `· อัปเดตเมื่อ ${fmt(row.reviewedAt)}` : ""}
        </label>
        <textarea
          id={`contact-note-${row.id}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          rows={2}
          placeholder="เช่น ตอบทางอีเมลแล้ว / ลบบัญชีแล้ว"
          className="w-full resize-none rounded-lg border border-border bg-bg-surface px-3 py-2 text-base outline-none placeholder:text-text-faint focus:border-accent sm:text-sm"
        />
        <div className="flex flex-wrap gap-2">
          {canReply && (
            <a
              href={`mailto:${row.email}?subject=${encodeURIComponent(subject)}`}
              className={`${BTN} bg-accent text-accent-fg`}
            >
              <Mail className="h-4 w-4" aria-hidden="true" /> ตอบทางอีเมล
            </a>
          )}
          {SET_STATUS.filter(([s]) => s !== row.status).map(([s, label]) => (
            <button key={s} type="button" disabled={busy} onClick={() => void setStatus(s)} className={BTN_SECONDARY}>
              {label}
            </button>
          ))}
          {note.trim() !== (row.adminNote ?? "") && (
            <button type="button" disabled={busy} onClick={() => void setStatus(row.status)} className={BTN_SECONDARY}>
              บันทึกโน้ต
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

// แท็บ "ข้อความติดต่อ" ในหน้า /admin: กล่องจดหมายจากฟอร์ม /contact ให้แอดมินอ่าน ตอบทางอีเมล และเปลี่ยนสถานะ
// ทุกการเรียกผ่าน RPC ที่เช็ค is_admin() ฝั่งเซิร์ฟเวอร์
export function AdminContact() {
  const [status, setStatus] = useState<ContactStatus | "all">("new");
  const [page, setPage] = useState(0);

  const countsQ = useAsync(() => getContactCounts(), []);
  const listQ = useAsync(() => listContactMessages({ status, offset: page * PAGE, limit: PAGE }), [status, page]);
  const total = listQ.status === "success" ? listQ.data.total : 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  function refresh() {
    countsQ.refetch();
    listQ.refetch();
    // ให้ badge ที่เมนู/แท็บรีเฟรชตาม
    window.dispatchEvent(new Event(CONTACT_COUNTS_CHANGED));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-xl font-semibold">ข้อความติดต่อ</h1>
          <p className="mt-1 text-xs text-text-faint">
            {countsQ.status === "success"
              ? `ใหม่ ${countsQ.data.newCount.toLocaleString()} · ทั้งหมด ${countsQ.data.total.toLocaleString()}`
              : "ข้อความที่ผู้ใช้ส่งจากหน้าติดต่อเรา"}
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          aria-label="รีเฟรช"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-text-muted hover:text-text"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div role="group" aria-label="กรองสถานะ" className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {STATUS_FILTERS.map(([k, label]) => (
          <Chip
            key={k}
            active={status === k}
            onClick={() => {
              setStatus(k);
              setPage(0);
            }}
            label={label}
          />
        ))}
      </div>

      {listQ.status === "loading" && (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
      )}
      {listQ.status === "error" && <ErrorState message={listQ.message} onRetry={listQ.refetch} />}
      {listQ.status === "success" && listQ.data.rows.length === 0 && (
        <EmptyState icon={Inbox} title="ไม่มีข้อความ" description="ลองเปลี่ยนตัวกรอง หรือรอผู้ใช้ส่งข้อความ" />
      )}
      {listQ.status === "success" && listQ.data.rows.length > 0 && (
        <>
          <p className="text-xs text-text-muted">
            {total.toLocaleString()} รายการ · หน้า {page + 1}/{pages}
          </p>
          <ul className="space-y-3">
            {listQ.data.rows.map((r) => (
              <ContactCard key={r.id} row={r} onChanged={refresh} />
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
