import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, Eye, EyeOff, Hammer, Loader2, Pencil, Trash2, X } from "lucide-react";
import { buildError, deleteBuild, getBuild, setBuildHidden, setBuildPublic } from "@/services/userBuilds";
import { useAuth } from "@/features/auth/AuthContext";
import { useIsAdmin } from "@/features/auth/useIsAdmin";
import { useAsync } from "@/hooks/useAsync";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { HeroIcon } from "@/components/HeroIcon";
import { Switch } from "@/features/community/Switch";
import { ReadOnlyBuild } from "@/features/build/buildView";
import { BuildReactions } from "@/features/build/BuildReactions";

const btn = "inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm transition disabled:opacity-50";

// หน้าดูบิลด์ของผู้ใช้ / Community Build — เจ้าของแก้/เผยแพร่/ลบได้ แอดมินซ่อน/ลบได้ (บังคับที่ RLS + trigger)
export function BuildDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const q = useAsync(() => getBuild(id), [id]);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const b = q.status === "success" ? q.data : null;

  useDocumentMeta({
    title: b ? `${b.name} — บิลด์ ${b.hero.nameTh} | RoV LAB` : "บิลด์ | RoV LAB",
    description: b ? `บิลด์ ${b.hero.nameTh} ของผู้เล่น: ไอเทม รูน สกิลชาเลนเจอร์ พลังแฝงใน RoV` : "บิลด์ของผู้ใช้",
    path: `/build/view/${id}`,
    breadcrumbs: [{ name: "หน้าแรก", path: "/" }, { name: "Item Build", path: "/build" }],
  });

  if (q.status === "loading") return <Skeleton className="h-64" />;
  if (q.status === "error") return <ErrorState message={q.message} onRetry={q.refetch} />;
  if (!b) return <EmptyState icon={Hammer} title="ไม่พบบิลด์นี้" description="อาจถูกลบ ซ่อน หรือเป็นบิลด์ส่วนตัวของคนอื่น" />;

  const mine = user?.id === b.ownerId;

  async function run(fn: () => Promise<void>, ok: string, after?: () => void) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      after ? after() : q.refetch();
    } catch (e) {
      toast.error(buildError(e, "ทำรายการไม่สำเร็จ"));
    } finally {
      setBusy(false);
      setConfirmDel(false);
    }
  }

  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-start gap-3">
        <HeroIcon icon={b.hero.icon} name={b.hero.nameTh} decorative className="h-12 w-12" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-semibold leading-snug">{b.name}</h1>
          <p className="text-sm text-text-muted">
            <Link to={`/build?hero=${b.hero.slug}&tab=community`} className="hover:text-accent">{b.hero.nameTh}</Link>
            {b.author ? <> · โดย {b.author.handle ? <Link to={`/u/${b.author.handle}`} className="hover:text-accent">{b.author.displayName ?? `@${b.author.handle}`}</Link> : (b.author.displayName ?? "")}</> : mine ? " · ของคุณ" : ""}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className={`rounded-full border px-2 py-0.5 text-[11px] ${b.hidden ? "border-loss/40 text-loss" : b.isPublic ? "border-win/40 text-win" : "border-border text-text-faint"}`}>
              {b.hidden ? "ถูกซ่อนโดยแอดมิน" : b.isPublic ? "Community Build" : "ส่วนตัว"}
            </span>
          </div>
        </div>
      </div>

      {b.note && <p className="whitespace-pre-line rounded-lg border border-border bg-bg-surface p-3 text-sm text-text-muted">{b.note}</p>}

      <ReadOnlyBuild build={b.view} />

      {b.isPublic && !b.hidden && <BuildReactions b={b} />}

      {(mine || isAdmin) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {mine && (
            <>
              <Link to={`/build/edit/${b.id}`} className={`${btn} border-border bg-bg-raised text-text hover:border-text-faint`}><Pencil className="h-4 w-4" />แก้ไข</Link>
              <Switch
                checked={b.isPublic}
                disabled={busy}
                onChange={(on) => void run(() => setBuildPublic(b.id, on), on ? "เผยแพร่แล้ว" : "เปลี่ยนเป็นส่วนตัวแล้ว")}
                label="เผยแพร่เป็น Community Build"
                className="h-10 rounded-lg border border-border bg-bg-raised px-3"
              />
            </>
          )}
          {isAdmin && (
            <button type="button" disabled={busy} onClick={() => void run(() => setBuildHidden(b.id, !b.hidden), b.hidden ? "เปิดการแสดงแล้ว" : "ซ่อนบิลด์แล้ว")} className={`${btn} border-border bg-bg-raised text-text hover:border-text-faint`}>
              {b.hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              {b.hidden ? "เปิดการแสดง (แอดมิน)" : "ซ่อนบิลด์ (แอดมิน)"}
            </button>
          )}
          {confirmDel ? (
            <>
              <button type="button" disabled={busy} onClick={() => void run(() => deleteBuild(b.id), "ลบแล้ว", () => navigate("/build?tab=mine"))} className={`${btn} border-loss bg-loss text-white`}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}ยืนยันลบ
              </button>
              <button type="button" onClick={() => setConfirmDel(false)} className={`${btn} border-border bg-bg-raised text-text`}><X className="h-4 w-4" />ยกเลิก</button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmDel(true)} className={`${btn} border-loss/40 bg-loss/10 text-loss`}><Trash2 className="h-4 w-4" />ลบบิลด์</button>
          )}
        </div>
      )}
    </div>
  );
}
