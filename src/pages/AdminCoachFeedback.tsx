import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, MessageSquareWarning, RefreshCw, ThumbsDown, ThumbsUp } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { Chip } from "@/features/heroes/HeroFilters";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  getFeedbackCounts,
  listFeedback,
  updateFeedback,
  type FeedbackRating,
  type FeedbackRow,
  type FeedbackStatus,
} from "@/services/coachFeedback";

const PAGE = 20;

const STATUS_FILTERS: [FeedbackStatus | "all", string][] = [
  ["new", "รอตรวจ"],
  ["reviewed", "ตรวจแล้ว"],
  ["fixed", "แก้แล้ว"],
  ["dismissed", "ไม่ใช่ปัญหา"],
  ["all", "ทั้งหมด"],
];
const RATING_FILTERS: [FeedbackRating | "all", string][] = [
  ["dislike", "ไม่ถูก"],
  ["like", "ถูกต้อง"],
  ["all", "ทั้งหมด"],
];
const STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: "รอตรวจ",
  reviewed: "ตรวจแล้ว",
  fixed: "แก้แล้ว",
  dismissed: "ไม่ใช่ปัญหา",
};
const STATUS_STYLE: Record<FeedbackStatus, string> = {
  new: "border-loss/40 bg-loss/10 text-loss",
  reviewed: "border-accent/40 bg-accent/10 text-accent",
  fixed: "border-win/40 bg-win/10 text-win",
  dismissed: "border-border bg-bg-raised text-text-muted",
};
// ปุ่มเปลี่ยนสถานะ (ตัวที่เป็นสถานะปัจจุบันจะไม่แสดง)
const SET_STATUS: [FeedbackStatus, string][] = [
  ["reviewed", "ตรวจแล้ว"],
  ["fixed", "แก้แล้ว"],
  ["dismissed", "ไม่ใช่ปัญหา"],
  ["new", "กลับไปรอตรวจ"],
];

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

function FeedbackCard({ row, onChanged }: { row: FeedbackRow; onChanged: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState(row.adminNote ?? "");
  const [busy, setBusy] = useState(false);
  const isDislike = row.rating === "dislike";
  const who = row.displayName || row.handle || "ผู้ใช้";
  // page มาจากฝั่งผู้ใช้ (ส่งตรงเข้า RPC ได้): ทำเป็นลิงก์เฉพาะ path ภายในเว็บ กัน javascript: / URL ภายนอก
  const pageHref = row.page && /^\/(?!\/)/.test(row.page) ? row.page : null;

  // รายการเปลี่ยน (เช่น รีเฟรช) → โน้ตตามข้อมูลล่าสุด
  useEffect(() => {
    setNote(row.adminNote ?? "");
  }, [row.id, row.adminNote]);

  async function setStatus(status: FeedbackStatus) {
    setBusy(true);
    try {
      await updateFeedback(row.id, status, note);
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
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 leading-none",
            isDislike ? "border-loss/40 bg-loss/10 text-loss" : "border-win/40 bg-win/10 text-win"
          )}
        >
          {isDislike ? <ThumbsDown className="h-3 w-3" aria-hidden /> : <ThumbsUp className="h-3 w-3" aria-hidden />}
          {isDislike ? "ไม่ถูก" : "ถูกต้อง"}
        </span>
        <span className={cn("rounded-full border px-2 py-0.5 leading-none", STATUS_STYLE[row.status])}>
          {STATUS_LABEL[row.status]}
        </span>
        <span className="min-w-0 truncate text-text-muted">
          {who}
          {row.handle && row.displayName ? ` @${row.handle}` : ""}
        </span>
        <span className="ml-auto text-text-faint">{fmt(row.createdAt)}</span>
      </div>

      <div className="space-y-1 text-sm">
        <p className="text-xs text-text-faint">คำถาม</p>
        <p className="break-words font-medium">{row.question}</p>
        {row.page && (
          <p className="break-all text-[11px] text-text-faint">
            หน้า:{" "}
            {pageHref ? (
              <a href={pageHref} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                {row.page}
              </a>
            ) : (
              row.page
            )}
          </p>
        )}
      </div>

      {isDislike && row.comment && (
        <div className="rounded-lg border border-loss/30 bg-loss/5 p-2.5">
          <p className="text-xs text-loss">ผู้ใช้บอกว่าผิดตรงไหน</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm">{row.comment}</p>
        </div>
      )}

      <details className="rounded-lg border border-border bg-bg-raised/50 px-3 py-2 text-sm">
        <summary className="cursor-pointer select-none text-xs text-text-muted">คำตอบของ Coach Ai</summary>
        <p className="mt-2 whitespace-pre-wrap break-words">{row.answer}</p>
      </details>

      {row.context && (
        <details className="rounded-lg border border-border bg-bg-raised/50 px-3 py-2">
          <summary className="cursor-pointer select-none text-xs text-text-muted">
            ข้อมูลที่ส่งให้ AI (ไว้เทียบว่า AI มั่ว หรือข้อมูลเราผิด)
          </summary>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all text-[11px] leading-relaxed text-text-muted">
            {row.context}
          </pre>
        </details>
      )}

      {isDislike && (
        <div className="space-y-2">
          <label className="block text-xs text-text-faint" htmlFor={`note-${row.id}`}>
            โน้ตของแอดมิน {row.reviewedAt ? `· ตรวจเมื่อ ${fmt(row.reviewedAt)}` : ""}
          </label>
          <textarea
            id={`note-${row.id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="เช่น แก้ข้อมูลสกิลแล้ว / AI เข้าใจผิดจาก description"
            className="w-full resize-none rounded-lg border border-border bg-bg-surface px-3 py-2 text-base outline-none placeholder:text-text-faint focus:border-accent sm:text-sm"
          />
          <div className="flex flex-wrap gap-2">
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
      )}
    </li>
  );
}

// แท็บ "รีวิว Coach Ai" ในหน้า /admin: รายการ 👍/👎 ของคำตอบ Coach Ai ให้แอดมินตรวจและเปลี่ยนสถานะ
// ทุกการเรียกผ่าน RPC ที่เช็ค is_admin() ฝั่งเซิร์ฟเวอร์
export function AdminCoachFeedback() {
  const [status, setStatus] = useState<FeedbackStatus | "all">("new");
  const [rating, setRating] = useState<FeedbackRating | "all">("dislike");
  const [page, setPage] = useState(0);

  const countsQ = useAsync(() => getFeedbackCounts(), []);
  const listQ = useAsync(() => listFeedback({ status, rating, offset: page * PAGE, limit: PAGE }), [status, rating, page]);
  const total = listQ.status === "success" ? listQ.data.total : 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  function refresh() {
    countsQ.refetch();
    listQ.refetch();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-xl font-semibold">รีวิว Coach Ai</h1>
          <p className="mt-1 text-xs text-text-faint">
            {countsQ.status === "success"
              ? `ถูกต้อง ${countsQ.data.likes.toLocaleString()} · ไม่ถูก ${countsQ.data.dislikes.toLocaleString()} · รอตรวจ ${countsQ.data.newReports.toLocaleString()}`
              : "ผู้ใช้กดรีวิวใต้คำตอบ ถ้าไม่ถูกจะมีข้อความบอกว่าผิดตรงไหน"}
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
      <div role="group" aria-label="กรองประเภทรีวิว" className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {RATING_FILTERS.map(([k, label]) => (
          <Chip
            key={k}
            active={rating === k}
            onClick={() => {
              setRating(k);
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
        <EmptyState icon={MessageSquareWarning} title="ไม่มีรายการ" description="ลองเปลี่ยนตัวกรอง หรือรอผู้ใช้ส่งรีวิว" />
      )}
      {listQ.status === "success" && listQ.data.rows.length > 0 && (
        <>
          <p className="text-xs text-text-muted">
            {total.toLocaleString()} รายการ · หน้า {page + 1}/{pages}
          </p>
          <ul className="space-y-3">
            {listQ.data.rows.map((r) => (
              <FeedbackCard key={r.id} row={r} onChanged={refresh} />
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
