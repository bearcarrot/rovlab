import { useState } from "react";
import { Link } from "react-router-dom";
import { FolderOpen } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { withNext } from "@/features/auth/nav";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { useAsync } from "@/hooks/useAsync";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { timeAgo } from "@/features/community/format";
import {
  deleteDraft,
  duplicateDraft,
  getMyDraft,
  listMyDrafts,
  publishDraft,
  setDraftVisibility,
  type MyDraft,
  type MyDraftSummary,
} from "@/services/draftSeries";
import { FORMAT_LABEL } from "./SeriesBar";

const btn = "rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-bg-raised disabled:opacity-50";

export function MyDrafts({
  currentId,
  onOpen,
  onDeleted,
}: {
  currentId: string | null;
  onOpen: (d: MyDraft) => void; // the page confirms replacing unsaved work and shows the toast
  onDeleted: (id: string) => void;
}) {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const list = useAsync(() => (user ? listMyDrafts() : Promise.resolve([] as MyDraftSummary[])), [user?.id]);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(id: string, ok: string, fn: () => Promise<unknown>) {
    setBusy(id);
    try {
      await fn();
      toast.success(ok);
      list.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  async function open(id: string) {
    setBusy(id);
    try {
      onOpen(await getMyDraft(id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "โหลด Draft ไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  async function askDelete(d: MyDraftSummary, isPublic: boolean) {
    const ok = await confirm({
      title: "ลบ Draft?",
      message: `ลบ “${d.name || "Draft"}” ใช่หรือไม่?${isPublic ? " (จะถูกเอาออกจาก Community ด้วย)" : ""}`,
      confirmLabel: "ลบ",
      danger: true,
    });
    if (!ok) return;
    await run(d.id, "ลบ Draft แล้ว", async () => {
      await deleteDraft(d.id);
      onDeleted(d.id);
    });
  }

  if (authLoading) return <Skeleton className="h-24" />;
  if (!user) {
    return (
      <div className="space-y-3">
        <EmptyState
          icon={FolderOpen}
          title="เข้าสู่ระบบเพื่อดู Draft ของคุณ"
          description="Draft ที่กำลังทำอยู่จะยังอยู่ในหน้านี้ ไม่หายเมื่อเข้าสู่ระบบ"
        />
        <div className="text-center">
          <Link to={withNext("/login", "/draft?tab=my")} className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg">
            เข้าสู่ระบบ
          </Link>
        </div>
      </div>
    );
  }
  if (list.status === "loading") return <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>;
  if (list.status === "error") return <ErrorState message="ไม่สามารถโหลด Draft ได้" onRetry={list.refetch} />;
  if (list.data.length === 0) {
    return <EmptyState icon={FolderOpen} title="ยังไม่มี Draft ที่บันทึกไว้" description="สร้าง Draft แล้วกด “บันทึก” เพื่อเก็บไว้ที่นี่" />;
  }

  return (
    <ul className="space-y-2">
      {list.data.map((d) => {
        const isPublic = d.visibility === "public";
        const disabled = busy !== null;
        return (
          <li key={d.id} className="rounded-card border border-border bg-bg-surface p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {d.name || "ไม่มีชื่อ"}
                  {d.id === currentId && <span className="ml-2 text-xs text-accent">กำลังแก้ไข</span>}
                </p>
                <p className="text-xs text-text-faint">
                  {FORMAT_LABEL[d.format]}
                  {d.format !== "single" && d.globalBanPick ? " · Global Ban Pick" : ""} · {isPublic ? "Public" : "Private"} · แก้ไขล่าสุด {timeAgo(d.updatedAt)}
                </p>
                {d.description && <p className="mt-1 line-clamp-2 text-xs text-text-muted">{d.description}</p>}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button type="button" disabled={disabled} className={btn} onClick={() => void open(d.id)}>
                เปิดแก้ไข
              </button>
              <button type="button" disabled={disabled} className={btn} onClick={() => run(d.id, "ทำสำเนา Draft แล้ว", () => duplicateDraft(user.id, d.id))}>
                ทำสำเนา
              </button>
              {isPublic ? (
                <>
                  <button type="button" disabled={disabled} className={btn} onClick={() => run(d.id, "อัปเดต Community เป็นเวอร์ชันล่าสุดแล้ว", () => publishDraft(d.id))}>
                    อัปเดต Community
                  </button>
                  <button type="button" disabled={disabled} className={btn} onClick={() => run(d.id, "เอาออกจาก Community แล้ว", () => setDraftVisibility(d.id, "private"))}>
                    ทำเป็นส่วนตัว
                  </button>
                </>
              ) : (
                <button type="button" disabled={disabled} className={btn} onClick={() => run(d.id, "เผยแพร่ไปยัง Community แล้ว", () => publishDraft(d.id))}>
                  เผยแพร่
                </button>
              )}
              <button type="button" disabled={disabled} className={`${btn} text-loss`} onClick={() => void askDelete(d, isPublic)}>
                ลบ
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
