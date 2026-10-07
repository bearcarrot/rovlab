import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FolderOpen } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { withNext } from "@/features/auth/nav";
import { useToast } from "@/components/ui/toast";
import { useAsync } from "@/hooks/useAsync";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { timeAgo } from "@/features/community/format";
import {
  createTierListCopy,
  deleteTierList,
  listMyTierLists,
  publishTierList,
  setTierListVisibility,
  type MyTierList,
} from "@/services/userTierLists";
import type { HeroSummary } from "@/types/hero";
import { TierRows } from "./TierRows";

const btn = "rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-bg-raised disabled:opacity-50";

export function MyTierLists({
  heroes,
  currentId,
  refreshKey,
  onOpen,
  onDeleted,
}: {
  heroes: HeroSummary[];
  currentId: string | null;
  refreshKey: number; // bump to reload after the editor saved something
  onOpen: (l: MyTierList) => void; // the workspace confirms replacing unsaved work and shows the toast
  onDeleted: (id: string) => void;
}) {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const list = useAsync(() => (user ? listMyTierLists() : Promise.resolve([] as MyTierList[])), [user?.id, refreshKey]);
  const [busy, setBusy] = useState<string | null>(null);
  const byId = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);

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

  if (authLoading) return <Skeleton className="h-24" />;
  if (!user) {
    return (
      <div className="space-y-3">
        <EmptyState icon={FolderOpen} title="เข้าสู่ระบบเพื่อดู Tier List ของคุณ" description="Tier List ที่กำลังจัดอยู่ยังเก็บไว้ในเครื่องนี้ ไม่หายเมื่อเข้าสู่ระบบ" />
        <div className="text-center">
          <Link to={withNext("/login", "/tier-list")} className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg">
            เข้าสู่ระบบ
          </Link>
        </div>
      </div>
    );
  }
  if (list.status === "loading") return <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-32" />)}</div>;
  if (list.status === "error") return <ErrorState message="ไม่สามารถโหลด Tier List ได้" onRetry={list.refetch} />;
  if (list.data.length === 0) {
    return <EmptyState icon={FolderOpen} title="ยังไม่มี Tier List ที่บันทึกไว้" description="จัดอันดับฮีโร่แล้วกด “บันทึก” เพื่อเก็บไว้ที่นี่" />;
  }

  return (
    <ul className="space-y-2">
      {list.data.map((l) => {
        const isPublic = l.visibility === "public";
        const disabled = busy !== null;
        return (
          <li key={l.id} className="space-y-2 rounded-card border border-border bg-bg-surface p-3">
            <div className="min-w-0">
              <p className="truncate font-medium">
                {l.name}
                {l.id === currentId && <span className="ml-2 text-xs text-accent">กำลังแก้ไข</span>}
              </p>
              <p className="text-xs text-text-faint">
                {l.patch ? `Patch ${l.patch} · ` : ""}
                {l.heroCount} ฮีโร่ · {isPublic ? "Public" : "Private"} · แก้ไขล่าสุด {timeAgo(l.updatedAt)}
              </p>
              {l.description && <p className="mt-1 line-clamp-2 text-xs text-text-muted">{l.description}</p>}
            </div>
            <TierRows data={l.data} byId={byId} size="sm" maxPerTier={10} />
            <div className="flex flex-wrap gap-1.5">
              <button type="button" disabled={disabled} className={btn} onClick={() => onOpen(l)}>
                เปิดแก้ไข
              </button>
              <button type="button" disabled={disabled} className={btn} onClick={() => run(l.id, "ทำสำเนา Tier List แล้ว", () => createTierListCopy(user.id, l))}>
                ทำสำเนา
              </button>
              {isPublic ? (
                <>
                  <button type="button" disabled={disabled} className={btn} onClick={() => run(l.id, "อัปเดต Community เป็นเวอร์ชันล่าสุดแล้ว", () => publishTierList(l.id))}>
                    อัปเดต Community
                  </button>
                  <button type="button" disabled={disabled} className={btn} onClick={() => run(l.id, "เอาออกจาก Community แล้ว", () => setTierListVisibility(l.id, "private"))}>
                    ทำเป็นส่วนตัว
                  </button>
                </>
              ) : (
                <button type="button" disabled={disabled} className={btn} onClick={() => run(l.id, "เผยแพร่ไปยัง Community แล้ว", () => publishTierList(l.id))}>
                  เผยแพร่
                </button>
              )}
              <button
                type="button"
                disabled={disabled}
                className={`${btn} text-loss`}
                onClick={() => {
                  if (!window.confirm(`ลบ “${l.name}” ใช่หรือไม่?${isPublic ? " (จะถูกเอาออกจาก Community ด้วย)" : ""}`)) return;
                  void run(l.id, "ลบ Tier List แล้ว", async () => {
                    await deleteTierList(l.id);
                    onDeleted(l.id);
                  });
                }}
              >
                ลบ
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
