import { useId, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Megaphone, Plus, RefreshCw, Upload } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { Chip } from "@/features/heroes/HeroFilters";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { AnnouncementCard } from "@/features/announcements/AnnouncementCard";
import { invalidateAnnouncements } from "@/features/announcements/store";
import { deleteWithImageCleanup, saveWithImageCleanup, type CleanupDeps } from "@/features/announcements/cleanup";
import { codePointLength, switchMediaType, validateForm, type FormDeps, type FormValues } from "@/features/announcements/form";
import { isOwnBucketUrl, mediaError } from "@/features/announcements/media";
import { bangkokLocalToIso, isoToBangkokLocal } from "@/features/announcements/time";
import type { Announcement, MediaType, Priority, Status } from "@/features/announcements/types";
import {
  countMediaReferences,
  deleteAnnouncement,
  listAllAnnouncements,
  removeAnnouncementImage,
  saveAnnouncement,
  setAnnouncementStatus,
  uploadAnnouncementImage,
} from "@/services/announcements";

// แท็บ "ประกาศ" ในหน้า /admin (spec: docs/superpowers/specs/2026-10-16-announcements-design.md, sections 8 และ 9)
// ทุกการเขียนผ่าน RPC ที่เช็ค is_admin() ฝั่งเซิร์ฟเวอร์ — หน้านี้แค่ซ่อน/แสดง ไม่ใช่ตัวคุมสิทธิ์

const FORM_DEPS: FormDeps = { mediaError, bangkokLocalToIso };
const CLEANUP_DEPS: CleanupDeps = {
  isOwnUrl: isOwnBucketUrl,
  countReferences: countMediaReferences,
  removeImage: removeAnnouncementImage,
};

type Filter = Status | "all";
const FILTERS: [Filter, string][] = [
  ["all", "ทั้งหมด"],
  ["draft", "ฉบับร่าง"],
  ["published", "เผยแพร่"],
  ["archived", "เก็บถาวร"],
];
const STATUS_LABEL: Record<Status, string> = { draft: "ฉบับร่าง", published: "เผยแพร่", archived: "เก็บถาวร" };
const STATUS_STYLE: Record<Status, string> = {
  draft: "border-border bg-bg-raised text-text-muted",
  published: "border-win/40 bg-win/10 text-win",
  archived: "border-border bg-bg-raised text-text-faint",
};
const PRIORITY_LABEL: Record<Priority, string> = { normal: "ปกติ", important: "สำคัญ", urgent: "ด่วน" };
const PRIORITY_STYLE: Record<Priority, string> = {
  normal: "border-border bg-bg-raised text-text-muted",
  important: "border-accent/40 bg-accent/10 text-accent",
  urgent: "border-loss/40 bg-loss/10 text-loss",
};
const MEDIA_OPTIONS: [MediaType, string][] = [
  ["none", "ไม่มีสื่อ"],
  ["image", "รูปภาพ"],
  ["video", "วิดีโอ"],
  ["link", "การ์ดลิงก์"],
];
const PRIORITY_OPTIONS: [Priority, string][] = [
  ["normal", "ปกติ"],
  ["important", "สำคัญ"],
  ["urgent", "ด่วน"],
];

type ActionKind = "publish" | "unpublish" | "archive" | "restore" | "delete";
type Action = { kind: ActionKind; row: Announcement };
const ACTION_COPY: Record<
  ActionKind,
  { title: string; description: string; confirm: string; done: string; to: Status | null; destructive: boolean }
> = {
  publish: {
    title: "เผยแพร่ประกาศ?",
    description: "ประกาศจะแสดงให้ผู้เข้าชมทุกคนเห็นตามช่วงเวลาที่ตั้งไว้",
    confirm: "เผยแพร่",
    done: "เผยแพร่แล้ว",
    to: "published",
    destructive: false,
  },
  unpublish: {
    title: "ยกเลิกเผยแพร่?",
    description: "ประกาศจะหายจากหน้าเว็บและกลับเป็นฉบับร่าง (คนที่กดซ่อนไว้แล้วจะยังไม่เห็นเมื่อเผยแพร่ใหม่)",
    confirm: "ยกเลิกเผยแพร่",
    done: "ยกเลิกเผยแพร่แล้ว",
    to: "draft",
    destructive: false,
  },
  archive: {
    title: "เก็บประกาศเข้าถาวร?",
    description: "ประกาศจะหายจากหน้าเว็บ กู้คืนเป็นฉบับร่างได้ภายหลัง",
    confirm: "เก็บถาวร",
    done: "เก็บถาวรแล้ว",
    to: "archived",
    destructive: false,
  },
  restore: { title: "", description: "", confirm: "", done: "กู้คืนเป็นฉบับร่างแล้ว", to: "draft", destructive: false },
  delete: {
    title: "ลบประกาศ?",
    description: "ลบถาวร กู้คืนไม่ได้ รวมถึงรูปที่อัปโหลดไว้ (ถ้าไม่มีประกาศอื่นใช้ร่วมกัน)",
    confirm: "ลบ",
    done: "ลบประกาศแล้ว",
    to: null,
    destructive: true,
  },
};

const BTN =
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-xs font-medium transition " +
  "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
const BTN_PRIMARY = `${BTN} bg-accent text-accent-fg`;
const BTN_SECONDARY = `${BTN} border border-border bg-bg-raised text-text hover:border-text-faint`;
const INPUT =
  "w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-base outline-none placeholder:text-text-faint focus:border-accent sm:text-sm";

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

const msg = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

function toValues(a: Announcement | null): FormValues {
  if (a === null) {
    return {
      title: "",
      content: "",
      mediaType: "none",
      mediaUrl: "",
      linkUrl: "",
      linkLabel: "",
      priority: "normal",
      isDismissible: true,
      startsLocal: "",
      endsLocal: "",
    };
  }
  return {
    title: a.title,
    content: a.content,
    mediaType: a.media_type,
    mediaUrl: a.media_url ?? "",
    linkUrl: a.link_url ?? "",
    linkLabel: a.link_label ?? "",
    priority: a.priority,
    isDismissible: a.is_dismissible,
    startsLocal: a.starts_at ? isoToBangkokLocal(a.starts_at) : "",
    endsLocal: a.ends_at ? isoToBangkokLocal(a.ends_at) : "",
  };
}

// ใช้แทน URL ตอนตรวจฟอร์มเมื่อเลือกไฟล์รูปไว้แต่ยังไม่อัปโหลด (อัปโหลดจริงตอนกดบันทึก ตามลำดับใน spec §8)
const PENDING_IMAGE_URL = "https://pending.invalid/pending.png";

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs text-text-faint">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-text-faint">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-loss">
          {error}
        </p>
      )}
    </div>
  );
}

function AnnouncementForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Announcement | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const uid = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [v, setV] = useState<FormValues>(() => toValues(initial));
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nowIso] = useState(() => new Date().toISOString());

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setV((cur) => ({ ...cur, [key]: value }));

  const hasPendingImage = pendingFile !== null && v.mediaType === "image";
  const result = validateForm(hasPendingImage ? { ...v, mediaUrl: PENDING_IMAGE_URL } : v, FORM_DEPS);
  const errors: Partial<Record<keyof FormValues, string>> = result.ok ? {} : result.errors;
  const err = (k: keyof FormValues) => (submitted ? errors[k] : undefined);

  // ตัวอย่างใช้ค่าที่ยังไม่บันทึก ผ่านตัวตรวจเดียวกับตอนบันทึก (ถ้ายังไม่ผ่านจะแสดงข้อความแทนการ์ด)
  const preview: Announcement | null = result.ok
    ? {
        id: "preview",
        title: result.input.title,
        content: result.input.content,
        media_type: result.input.mediaType,
        media_url: hasPendingImage ? null : result.input.mediaUrl,
        link_url: result.input.linkUrl,
        link_label: result.input.linkLabel,
        status: "draft",
        priority: result.input.priority,
        is_dismissible: result.input.isDismissible,
        starts_at: result.input.startsAt,
        ends_at: result.input.endsAt,
        created_at: nowIso,
        updated_at: nowIso,
      }
    : null;

  function changeType(next: MediaType) {
    setV((cur) => switchMediaType(cur, next));
    if (next !== "image") setPendingFile(null);
  }

  function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (f === null) return;
    setPendingFile(f);
    set("mediaUrl", "");
  }

  // เอาไฟล์ที่เลือกออก: คืนลิงก์รูปเดิมของประกาศที่กำลังแก้ (ถ้ามี) ไม่ให้ช่องลิงก์ว่างโดยไม่ตั้งใจ
  function clearPendingFile() {
    setPendingFile(null);
    set("mediaUrl", initial?.media_type === "image" ? (initial.media_url ?? "") : "");
  }

  async function save() {
    setSubmitted(true);
    if (saving || !result.ok) return;
    setSaving(true);
    try {
      let input = result.input;
      let uploadedUrl: string | null = null;
      // ลำดับ spec §8: อัปโหลดรูปใหม่ → บันทึก → ลบรูปเก่า (เฉพาะเมื่อไม่มีประกาศอื่นใช้) / ถ้าบันทึกพลาดลบรูปใหม่ทิ้ง
      if (hasPendingImage && pendingFile !== null) {
        uploadedUrl = await uploadAnnouncementImage(pendingFile);
        input = { ...input, mediaUrl: uploadedUrl };
      }
      const { cleanup } = await saveWithImageCleanup(
        {
          oldUrl: initial?.media_url ?? null,
          newUrl: input.mediaUrl,
          uploadedUrl,
          save: () => saveAnnouncement(initial?.id ?? null, input),
        },
        CLEANUP_DEPS,
      );
      toast.success("บันทึกประกาศแล้ว");
      if (cleanup === "failed") toast.error("บันทึกแล้ว แต่ลบรูปเดิมในที่เก็บไม่สำเร็จ (ไฟล์เดิมยังค้างอยู่)");
      onSaved();
    } catch (e) {
      toast.error(msg(e, "บันทึกไม่สำเร็จ"));
    } finally {
      setSaving(false);
    }
  }

  const mediaLabel =
    v.mediaType === "image"
      ? "ลิงก์รูป (https://)"
      : v.mediaType === "video"
        ? "ลิงก์วิดีโอ (YouTube / Vimeo / .mp4 .webm .ogv)"
        : "ลิงก์ปลายทางของการ์ด (https://)";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-xl font-semibold">{initial ? "แก้ไขประกาศ" : "สร้างประกาศ"}</h1>
        <button type="button" className={BTN_SECONDARY} onClick={onClose} disabled={saving}>
          กลับไปรายการ
        </button>
      </div>

      <div className="space-y-4 rounded-card border border-border bg-bg-surface p-3">
        <Field id={`${uid}-title`} label={`หัวข้อ (${codePointLength(v.title.trim())}/120)`} error={err("title")}>
          <input id={`${uid}-title`} value={v.title} onChange={(e) => set("title", e.target.value)} className={INPUT} />
        </Field>

        <Field id={`${uid}-content`} label={`เนื้อหา (${codePointLength(v.content.trim())}/4000)`} error={err("content")}>
          <textarea
            id={`${uid}-content`}
            value={v.content}
            onChange={(e) => set("content", e.target.value)}
            rows={4}
            className={cn(INPUT, "resize-y")}
          />
        </Field>

        <div className="space-y-1">
          <span className="block text-xs text-text-faint">ประเภทสื่อ</span>
          <div role="group" aria-label="ประเภทสื่อ" className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {MEDIA_OPTIONS.map(([k, label]) => (
              <Chip key={k} active={v.mediaType === k} onClick={() => changeType(k)} label={label} />
            ))}
          </div>
        </div>

        {v.mediaType !== "none" && (
          <Field id={`${uid}-media`} label={mediaLabel} error={err("mediaUrl")}>
            <input
              id={`${uid}-media`}
              value={v.mediaUrl}
              onChange={(e) => set("mediaUrl", e.target.value)}
              inputMode="url"
              placeholder="https://"
              disabled={hasPendingImage}
              className={cn(INPUT, "disabled:opacity-50")}
            />
            {v.mediaType === "image" && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={pickFile}
                />
                <button type="button" className={BTN_SECONDARY} onClick={() => fileRef.current?.click()} disabled={saving}>
                  <Upload className="h-4 w-4" aria-hidden="true" /> อัปโหลดรูป (JPG/PNG/WebP ≤ 2 MB)
                </button>
                {pendingFile && (
                  <>
                    <span className="min-w-0 break-all text-xs text-text-muted">{pendingFile.name}</span>
                    <button type="button" className={BTN_SECONDARY} onClick={clearPendingFile} disabled={saving}>
                      เอาไฟล์ออก
                    </button>
                  </>
                )}
              </div>
            )}
            {hasPendingImage && (
              <p className="text-[11px] text-text-faint">ไฟล์จะอัปโหลดตอนกดบันทึก ตัวอย่างด้านล่างจึงยังไม่แสดงรูป</p>
            )}
          </Field>
        )}

        {v.mediaType !== "link" && (
          <Field id={`${uid}-link`} label="ลิงก์ของปุ่ม (ไม่บังคับ)" error={err("linkUrl")}>
            <input
              id={`${uid}-link`}
              value={v.linkUrl}
              onChange={(e) => set("linkUrl", e.target.value)}
              inputMode="url"
              placeholder="https://"
              className={INPUT}
            />
          </Field>
        )}

        <Field id={`${uid}-label`} label="ข้อความบนปุ่ม (ไม่บังคับ ไม่เกิน 40 ตัวอักษร)" error={err("linkLabel")}>
          <input id={`${uid}-label`} value={v.linkLabel} onChange={(e) => set("linkLabel", e.target.value)} className={INPUT} />
        </Field>

        <div className="space-y-1">
          <span className="block text-xs text-text-faint">ความสำคัญ</span>
          <div role="group" aria-label="ความสำคัญ" className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {PRIORITY_OPTIONS.map(([k, label]) => (
              <Chip key={k} active={v.priority === k} onClick={() => set("priority", k)} label={label} />
            ))}
          </div>
        </div>

        <label className="inline-flex min-h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={v.isDismissible}
            onChange={(e) => set("isDismissible", e.target.checked)}
            className="h-4 w-4 accent-[#E8A33D]"
          />
          ให้ผู้เข้าชมกดซ่อนประกาศนี้ได้
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            id={`${uid}-starts`}
            label="เริ่มแสดง · เวลาไทย (UTC+7)"
            hint="เว้นว่าง = แสดงทันทีเมื่อเผยแพร่"
            error={err("startsLocal")}
          >
            <input
              id={`${uid}-starts`}
              type="datetime-local"
              value={v.startsLocal}
              onChange={(e) => set("startsLocal", e.target.value)}
              className={INPUT}
            />
          </Field>
          <Field
            id={`${uid}-ends`}
            label="หยุดแสดง · เวลาไทย (UTC+7)"
            hint="เว้นว่าง = ไม่มีวันหมดอายุ"
            error={err("endsLocal")}
          >
            <input
              id={`${uid}-ends`}
              type="datetime-local"
              value={v.endsLocal}
              onChange={(e) => set("endsLocal", e.target.value)}
              className={INPUT}
            />
          </Field>
        </div>
      </div>

      <section aria-label="ตัวอย่างประกาศ" className="space-y-2">
        <h2 className="text-sm font-medium">ตัวอย่าง</h2>
        {preview ? (
          <AnnouncementCard announcement={preview} mode="preview" />
        ) : (
          <div className="space-y-1 rounded-card border border-border bg-bg-surface p-3 text-sm text-text-muted">
            <p>กรอกข้อมูลให้ถูกต้องเพื่อดูตัวอย่าง</p>
            <ul className="list-disc space-y-0.5 pl-5 text-xs text-loss">
              {Object.entries(errors).map(([k, m]) => (
                <li key={k}>{m}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={BTN_PRIMARY} onClick={() => void save()} disabled={saving}>
          {saving ? "กำลังบันทึก…" : "บันทึก"}
        </button>
        <button type="button" className={BTN_SECONDARY} onClick={onClose} disabled={saving}>
          ยกเลิก
        </button>
      </div>
      <p className="text-[11px] text-text-faint">
        บันทึกแล้วประกาศใหม่จะเป็นฉบับร่าง — ต้องกด “เผยแพร่” จากรายการก่อนผู้เข้าชมจะเห็น
      </p>
    </div>
  );
}

function Row({ row, busy, onEdit, onAction }: { row: Announcement; busy: boolean; onEdit: () => void; onAction: (k: ActionKind) => void }) {
  return (
    <li className="space-y-3 rounded-card border border-border bg-bg-surface p-3">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className={cn("rounded-full border px-2 py-0.5 leading-none", STATUS_STYLE[row.status])}>{STATUS_LABEL[row.status]}</span>
        <span className={cn("rounded-full border px-2 py-0.5 leading-none", PRIORITY_STYLE[row.priority])}>
          {PRIORITY_LABEL[row.priority]}
        </span>
        {row.media_type !== "none" && (
          <span className="rounded-full border border-border bg-bg-raised px-2 py-0.5 leading-none text-text-muted">
            {MEDIA_OPTIONS.find(([k]) => k === row.media_type)?.[1]}
          </span>
        )}
      </div>
      <div className="space-y-1">
        <p className="break-words font-medium">{row.title}</p>
        {row.content !== "" && <p className="line-clamp-2 whitespace-pre-wrap break-words text-xs text-text-muted">{row.content}</p>}
        <p className="text-[11px] text-text-faint">
          เริ่ม {fmt(row.starts_at)} · หยุด {fmt(row.ends_at)} · อัปเดต {fmt(row.updated_at)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={onEdit}>
          แก้ไข
        </button>
        {row.status === "draft" && (
          <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => onAction("publish")}>
            เผยแพร่
          </button>
        )}
        {row.status === "published" && (
          <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={() => onAction("unpublish")}>
            ยกเลิกเผยแพร่
          </button>
        )}
        {row.status !== "archived" && (
          <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={() => onAction("archive")}>
            เก็บถาวร
          </button>
        )}
        {row.status === "archived" && (
          <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={() => onAction("restore")}>
            กู้คืนเป็นฉบับร่าง
          </button>
        )}
        <button type="button" className={cn(BTN, "border border-loss/40 text-loss hover:bg-loss/10")} disabled={busy} onClick={() => onAction("delete")}>
          ลบ
        </button>
      </div>
    </li>
  );
}

export function AdminAnnouncements() {
  const toast = useToast();
  const listQ = useAsync(() => listAllAnnouncements(), []);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ row: Announcement | null } | null>(null);
  const [pending, setPending] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);

  // หลังทุกการเปลี่ยนแปลง: โหลดรายการแอดมินใหม่ + ให้แบนเนอร์สาธารณะโหลดใหม่และตั้งเวลาใหม่
  function refreshAll() {
    listQ.refetch();
    void invalidateAnnouncements();
  }

  async function run(a: Action) {
    if (busy) return;
    setBusy(true);
    try {
      const copy = ACTION_COPY[a.kind];
      if (a.kind === "delete") {
        const { cleanup } = await deleteWithImageCleanup({ remove: () => deleteAnnouncement(a.row.id) }, CLEANUP_DEPS);
        toast.success(copy.done);
        if (cleanup === "failed") toast.error("ลบรูปในที่เก็บไม่สำเร็จ (ประกาศถูกลบแล้ว) ไฟล์รูปอาจค้างอยู่");
      } else if (copy.to !== null) {
        await setAnnouncementStatus(a.row.id, copy.to);
        toast.success(copy.done);
      }
      refreshAll();
    } catch (e) {
      toast.error(msg(e, "ทำรายการไม่สำเร็จ"));
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  function onAction(row: Announcement, kind: ActionKind) {
    const a = { kind, row };
    if (kind === "restore") void run(a); // กู้คืนเป็นฉบับร่างไม่กระทบผู้เข้าชม ไม่ต้องยืนยัน
    else setPending(a);
  }

  if (editing !== null) {
    return (
      <AnnouncementForm
        key={editing.row?.id ?? "new"}
        initial={editing.row}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          refreshAll();
        }}
      />
    );
  }

  const q = query.trim().toLowerCase();
  const rows =
    listQ.status === "success"
      ? listQ.data.filter(
          (a) =>
            (filter === "all" || a.status === filter) &&
            (q === "" || a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q)),
        )
      : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-xl font-semibold">ประกาศ</h1>
          <p className="mt-1 text-xs text-text-faint">
            {listQ.status === "success" ? `ทั้งหมด ${listQ.data.length.toLocaleString()} รายการ` : "ประกาศที่แสดงบนหน้าเว็บให้ผู้เข้าชมทุกคน"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={listQ.refetch}
            aria-label="รีเฟรช"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-text-muted hover:text-text"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button type="button" className={BTN_PRIMARY} onClick={() => setEditing({ row: null })}>
            <Plus className="h-4 w-4" aria-hidden="true" /> สร้างประกาศ
          </button>
        </div>
      </div>

      <div role="group" aria-label="กรองสถานะ" className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {FILTERS.map(([k, label]) => (
          <Chip key={k} active={filter === k} onClick={() => setFilter(k)} label={label} />
        ))}
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นหาจากหัวข้อหรือเนื้อหา"
        aria-label="ค้นหาประกาศ"
        className={INPUT}
      />

      {listQ.status === "loading" && (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      )}
      {listQ.status === "error" && <ErrorState message={listQ.message} onRetry={listQ.refetch} />}
      {listQ.status === "success" && rows.length === 0 && (
        <EmptyState icon={Megaphone} title="ไม่มีประกาศ" description={"ลองเปลี่ยนตัวกรอง หรือกด “สร้างประกาศ”"} />
      )}
      {listQ.status === "success" && rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((r) => (
            <Row key={r.id} row={r} busy={busy} onEdit={() => setEditing({ row: r })} onAction={(k) => onAction(r, k)} />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={pending ? ACTION_COPY[pending.kind].title : ""}
        description={pending ? `${ACTION_COPY[pending.kind].description} — “${pending.row.title}”` : ""}
        confirmLabel={pending ? ACTION_COPY[pending.kind].confirm : "ยืนยัน"}
        destructive={pending ? ACTION_COPY[pending.kind].destructive : false}
        busy={busy}
        onConfirm={() => pending && void run(pending)}
      />
    </div>
  );
}
