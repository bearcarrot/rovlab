import { useId, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Megaphone, Plus, RefreshCw, Upload } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { Chip } from "@/features/heroes/HeroFilters";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { removeAnnouncementImage, uploadAnnouncementImage } from "@/services/announcements";
import {
  deleteSponsor,
  listAllSponsors,
  saveSponsor,
  setSponsorStatus,
  type Sponsor,
  type SponsorStatus,
} from "@/services/sponsors";

// แท็บ "ผู้สนับสนุน" ในหน้า /admin: จัดการผู้สนับสนุนที่แสดงในส่วนท้ายของหน้าแรก
// ทุกการเขียนผ่าน RPC ที่เช็ค is_admin() ฝั่งเซิร์ฟเวอร์ — หน้านี้แค่ซ่อน/แสดง ไม่ใช่ตัวคุมสิทธิ์

type Filter = SponsorStatus | "all";
const FILTERS: [Filter, string][] = [
  ["all", "ทั้งหมด"],
  ["draft", "ฉบับร่าง"],
  ["published", "เผยแพร่"],
  ["archived", "เก็บถาวร"],
];
const STATUS_LABEL: Record<SponsorStatus, string> = { draft: "ฉบับร่าง", published: "เผยแพร่", archived: "เก็บถาวร" };
const STATUS_STYLE: Record<SponsorStatus, string> = {
  draft: "border-border bg-bg-raised text-text-muted",
  published: "border-win/40 bg-win/10 text-win",
  archived: "border-border bg-bg-raised text-text-faint",
};

type ActionKind = "publish" | "unpublish" | "archive" | "restore" | "delete";
type Action = { kind: ActionKind; row: Sponsor };
const ACTION_COPY: Record<
  ActionKind,
  { title: string; description: string; confirm: string; done: string; to: SponsorStatus | null; destructive: boolean }
> = {
  publish: {
    title: "เผยแพร่ผู้สนับสนุน?",
    description: "จะแสดงบนหน้าแรกตามช่วงเวลาที่ตั้งไว้ (อาจช้าได้ประมาณ 1 ชั่วโมงจากแคช)",
    confirm: "เผยแพร่",
    done: "เผยแพร่แล้ว",
    to: "published",
    destructive: false,
  },
  unpublish: {
    title: "ยกเลิกเผยแพร่?",
    description: "จะหายจากหน้าแรกและกลับเป็นฉบับร่าง (อาจช้าได้ประมาณ 1 ชั่วโมงจากแคช)",
    confirm: "ยกเลิกเผยแพร่",
    done: "ยกเลิกเผยแพร่แล้ว",
    to: "draft",
    destructive: false,
  },
  archive: {
    title: "เก็บเข้าถาวร?",
    description: "จะหายจากหน้าแรก กู้คืนเป็นฉบับร่างได้ภายหลัง",
    confirm: "เก็บถาวร",
    done: "เก็บถาวรแล้ว",
    to: "archived",
    destructive: false,
  },
  restore: { title: "", description: "", confirm: "", done: "กู้คืนเป็นฉบับร่างแล้ว", to: "draft", destructive: false },
  delete: {
    title: "ลบผู้สนับสนุน?",
    description: "ลบถาวร กู้คืนไม่ได้ รวมถึงโลโก้ที่อัปโหลดไว้",
    confirm: "ลบ",
    done: "ลบแล้ว",
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

// เวลาไทย = UTC+7 คงที่ (ไม่มี DST) จึงแปลงได้ตรง ๆ: "YYYY-MM-DDTHH:mm" (ช่อง datetime-local) <-> ISO UTC
function localToIso(local: string): string | null {
  if (local.trim() === "") return null;
  const t = Date.parse(`${local}:00+07:00`);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}
function isoToLocal(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t + 7 * 3600_000).toISOString().slice(0, 16) : "";
}

function httpsOk(u: string): boolean {
  if (u.length > 2048 || /[\s"'<>\\]/.test(u)) return false;
  try {
    const p = new URL(u);
    return p.protocol === "https:" && p.hostname.includes(".") && p.username === "" && p.password === "";
  } catch {
    return false;
  }
}

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

function SponsorForm({ initial, onClose, onSaved }: { initial: Sponsor | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const uid = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial?.name ?? "");
  const [tagline, setTagline] = useState(initial?.tagline ?? "");
  const [linkUrl, setLinkUrl] = useState(initial?.link_url ?? "");
  const [startsLocal, setStartsLocal] = useState(isoToLocal(initial?.starts_at ?? null));
  const [endsLocal, setEndsLocal] = useState(isoToLocal(initial?.ends_at ?? null));
  const [logoUrl, setLogoUrl] = useState(initial?.logo_url ?? "");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (pendingFile === null) {
      setPendingPreview(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPendingPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const startsIso = localToIso(startsLocal);
  const endsIso = localToIso(endsLocal);
  const errors: Record<string, string> = {};
  if (name.trim() === "" || [...name.trim()].length > 80) errors.name = "ชื่อต้องมี 1-80 ตัวอักษร";
  if ([...tagline.trim()].length > 140) errors.tagline = "ยาวเกิน 140 ตัวอักษร";
  if (!httpsOk(linkUrl.trim())) errors.linkUrl = "ลิงก์ต้องเป็น https:// ที่ถูกต้อง";
  if (startsLocal !== "" && startsIso === null) errors.startsLocal = "รูปแบบเวลาไม่ถูกต้อง";
  if (endsLocal !== "" && endsIso === null) errors.endsLocal = "รูปแบบเวลาไม่ถูกต้อง";
  if (startsIso && endsIso && Date.parse(endsIso) <= Date.parse(startsIso)) errors.endsLocal = "เวลาหยุดต้องอยู่หลังเวลาเริ่ม";
  const err = (k: string) => (submitted ? errors[k] : undefined);

  function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (f !== null) setPendingFile(f);
  }

  async function save() {
    setSubmitted(true);
    if (saving || Object.keys(errors).length > 0) return;
    setSaving(true);
    let uploaded: string | null = null;
    try {
      let logo: string | null = logoUrl || null;
      // ลำดับเหมือนหน้าประกาศ: อัปโหลดโลโก้ใหม่ → บันทึก → ลบโลโก้เก่า / ถ้าบันทึกพลาดลบโลโก้ใหม่ทิ้ง
      if (pendingFile !== null) {
        uploaded = await uploadAnnouncementImage(pendingFile);
        logo = uploaded;
      }
      try {
        await saveSponsor(initial?.id ?? null, {
          name: name.trim(),
          tagline: tagline.trim(),
          logoUrl: logo,
          linkUrl: linkUrl.trim(),
          startsAt: startsIso,
          endsAt: endsIso,
        });
      } catch (e) {
        if (uploaded !== null) await removeAnnouncementImage(uploaded).catch(() => false);
        throw e;
      }
      const old = initial?.logo_url ?? null;
      if (old !== null && old !== logo) await removeAnnouncementImage(old).catch(() => false);
      toast.success("บันทึกแล้ว");
      onSaved();
    } catch (e) {
      toast.error(msg(e, "บันทึกไม่สำเร็จ"));
    } finally {
      setSaving(false);
    }
  }

  const shownLogo = pendingPreview ?? (logoUrl || null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-xl font-semibold">{initial ? "แก้ไขผู้สนับสนุน" : "เพิ่มผู้สนับสนุน"}</h1>
        <button type="button" className={BTN_SECONDARY} onClick={onClose} disabled={saving}>
          กลับไปรายการ
        </button>
      </div>

      <div className="space-y-4 rounded-card border border-border bg-bg-surface p-3">
        <Field id={`${uid}-name`} label={`ชื่อแบรนด์ (${[...name.trim()].length}/80)`} error={err("name")}>
          <input id={`${uid}-name`} value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
        </Field>

        <Field
          id={`${uid}-tag`}
          label={`ข้อความสั้น ๆ (ไม่บังคับ ${[...tagline.trim()].length}/140)`}
          error={err("tagline")}
        >
          <input id={`${uid}-tag`} value={tagline} onChange={(e) => setTagline(e.target.value)} className={INPUT} />
        </Field>

        <Field id={`${uid}-link`} label="ลิงก์ปลายทาง (https://)" error={err("linkUrl")}>
          <input
            id={`${uid}-link`}
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            inputMode="url"
            placeholder="https://"
            className={INPUT}
          />
        </Field>

        <div className="space-y-1">
          <span className="block text-xs text-text-faint">โลโก้ (ไม่บังคับ · อัปโหลด JPG/PNG/WebP ≤ 2 MB · แนะนำรูปสี่เหลี่ยมจัตุรัส)</span>
          <div className="flex flex-wrap items-center gap-2">
            {shownLogo && (
              <img src={shownLogo} alt="ตัวอย่างโลโก้" className="h-10 w-10 rounded-lg bg-bg-raised object-contain" />
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pickFile} />
            <button type="button" className={BTN_SECONDARY} onClick={() => fileRef.current?.click()} disabled={saving}>
              <Upload className="h-4 w-4" aria-hidden="true" /> {shownLogo ? "เปลี่ยนโลโก้" : "อัปโหลดโลโก้"}
            </button>
            {shownLogo && (
              <button
                type="button"
                className={BTN_SECONDARY}
                disabled={saving}
                onClick={() => {
                  setPendingFile(null);
                  setLogoUrl("");
                }}
              >
                เอาโลโก้ออก
              </button>
            )}
          </div>
          {pendingFile && <p className="text-[11px] text-text-faint">ไฟล์จะอัปโหลดตอนกดบันทึก: {pendingFile.name}</p>}
        </div>

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
              value={startsLocal}
              onChange={(e) => setStartsLocal(e.target.value)}
              className={INPUT}
            />
          </Field>
          <Field
            id={`${uid}-ends`}
            label="หยุดแสดง · เวลาไทย (UTC+7)"
            hint="เว้นว่าง = ไม่มีวันหมดอายุ (แนะนำให้ใส่ตามสัญญา)"
            error={err("endsLocal")}
          >
            <input
              id={`${uid}-ends`}
              type="datetime-local"
              value={endsLocal}
              onChange={(e) => setEndsLocal(e.target.value)}
              className={INPUT}
            />
          </Field>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={BTN_PRIMARY} onClick={() => void save()} disabled={saving}>
          {saving ? "กำลังบันทึก…" : "บันทึก"}
        </button>
        <button type="button" className={BTN_SECONDARY} onClick={onClose} disabled={saving}>
          ยกเลิก
        </button>
      </div>
      <p className="text-[11px] text-text-faint">
        บันทึกแล้วจะเป็นฉบับร่าง — ต้องกด “เผยแพร่” จากรายการก่อนผู้เข้าชมจะเห็น หน้าแรกแคชรายการผู้สนับสนุนไว้ประมาณ 1 ชั่วโมง การเปลี่ยนแปลงจึงอาจแสดงช้าได้ช่วงนั้น
      </p>
    </div>
  );
}

function Row({ row, busy, onEdit, onAction }: { row: Sponsor; busy: boolean; onEdit: () => void; onAction: (k: ActionKind) => void }) {
  return (
    <li className="space-y-3 rounded-card border border-border bg-bg-surface p-3">
      <div className="flex items-start gap-3">
        {row.logo_url && <img src={row.logo_url} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-bg-raised object-contain" />}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className={cn("rounded-full border px-2 py-0.5 leading-none", STATUS_STYLE[row.status])}>
              {STATUS_LABEL[row.status]}
            </span>
          </div>
          <p className="break-words font-medium">{row.name}</p>
          {row.tagline !== "" && <p className="line-clamp-2 break-words text-xs text-text-muted">{row.tagline}</p>}
          <p className="break-all text-[11px] text-text-faint">{row.link_url}</p>
          <p className="text-[11px] text-text-faint">
            เริ่ม {fmt(row.starts_at)} · หยุด {fmt(row.ends_at)} · อัปเดต {fmt(row.updated_at)}
          </p>
        </div>
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
        <button
          type="button"
          className={cn(BTN, "border border-loss/40 text-loss hover:bg-loss/10")}
          disabled={busy}
          onClick={() => onAction("delete")}
        >
          ลบ
        </button>
      </div>
    </li>
  );
}

export function AdminSponsors() {
  const toast = useToast();
  const listQ = useAsync(() => listAllSponsors(), []);
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<{ row: Sponsor | null } | null>(null);
  const [pending, setPending] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(a: Action) {
    if (busy) return;
    setBusy(true);
    try {
      const copy = ACTION_COPY[a.kind];
      if (a.kind === "delete") {
        const logo = await deleteSponsor(a.row.id);
        if (logo) await removeAnnouncementImage(logo).catch(() => false);
        toast.success(copy.done);
      } else if (copy.to !== null) {
        await setSponsorStatus(a.row.id, copy.to);
        toast.success(copy.done);
      }
      listQ.refetch();
    } catch (e) {
      toast.error(msg(e, "ทำรายการไม่สำเร็จ"));
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  function onAction(row: Sponsor, kind: ActionKind) {
    const a = { kind, row };
    if (kind === "restore") void run(a);
    else setPending(a);
  }

  if (editing !== null) {
    return (
      <SponsorForm
        key={editing.row?.id ?? "new"}
        initial={editing.row}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          listQ.refetch();
        }}
      />
    );
  }

  const rows = listQ.status === "success" ? listQ.data.filter((s) => filter === "all" || s.status === filter) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-xl font-semibold">ผู้สนับสนุน</h1>
          <p className="mt-1 text-xs text-text-faint">
            {listQ.status === "success"
              ? `ทั้งหมด ${listQ.data.length.toLocaleString()} รายการ · แสดงสูงสุด 6 รายท้ายหน้าแรก (เรียงตามวันที่สร้าง เก่าสุดก่อน)`
              : "ผู้สนับสนุนที่แสดงท้ายหน้าแรก"}
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
            <Plus className="h-4 w-4" aria-hidden="true" /> เพิ่มผู้สนับสนุน
          </button>
        </div>
      </div>

      <div role="group" aria-label="กรองสถานะ" className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {FILTERS.map(([k, label]) => (
          <Chip key={k} active={filter === k} onClick={() => setFilter(k)} label={label} />
        ))}
      </div>

      {listQ.status === "loading" && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      )}
      {listQ.status === "error" && <ErrorState message={listQ.message} onRetry={listQ.refetch} />}
      {listQ.status === "success" && rows.length === 0 && (
        <EmptyState icon={Megaphone} title="ยังไม่มีผู้สนับสนุน" description={"กด “เพิ่มผู้สนับสนุน” เมื่อตกลงกับแบรนด์ได้แล้ว"} />
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
        description={pending ? `${ACTION_COPY[pending.kind].description} — “${pending.row.name}”` : ""}
        confirmLabel={pending ? ACTION_COPY[pending.kind].confirm : "ยืนยัน"}
        destructive={pending ? ACTION_COPY[pending.kind].destructive : false}
        busy={busy}
        onConfirm={() => pending && void run(pending)}
      />
    </div>
  );
}
