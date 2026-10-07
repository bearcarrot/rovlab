import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import {
  getMyGameIdentity,
  linkGameIdentity,
  refreshGameIdentity,
  unlinkGameIdentity,
  type GameIdentity,
} from "@/services/gameIdentity";

const INPUT_CLASS =
  "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none placeholder:text-text-faint focus:border-accent/60";

// 1337832383906930 -> 1337•••••••••930 (the OpenID is shown to its owner only)
function maskId(id: string): string {
  return id.length <= 7 ? id : `${id.slice(0, 4)}${"•".repeat(id.length - 7)}${id.slice(-3)}`;
}

function whenText(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

export function GameIdentityCard({ userId }: { userId: string }) {
  const toast = useToast();
  const [identity, setIdentity] = useState<GameIdentity | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [busy, setBusy] = useState<"link" | "refresh" | "unlink" | null>(null);

  const load = useCallback(async () => {
    try {
      setIdentity(await getMyGameIdentity(userId));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(kind: "link" | "refresh" | "unlink", fn: () => Promise<void>, okMsg: string) {
    setBusy(kind);
    try {
      await fn();
      toast.success(okMsg);
      setPlayerId("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-bg p-3">
      <div className="flex items-center gap-1.5">
        <p className="text-sm font-medium">ชื่อในเกม (RoV)</p>
        {identity && <BadgeCheck className="h-4 w-4 text-accent" aria-label="ดึงจากในเกม" />}
      </div>

      {identity === undefined && !loadError && <Skeleton className="h-16" />}
      {loadError && <ErrorState message={loadError} onRetry={() => void load()} />}

      {identity && (
        <div className="space-y-3">
          <div>
            <p className="break-words font-display text-lg font-semibold">{identity.ign}</p>
            <p className="text-[11px] text-text-faint">
              {identity.server ? `เซิร์ฟเวอร์ ${identity.server} · ` : ""}
              OpenID {maskId(identity.playerId)}
            </p>
            <p className="text-[11px] text-text-faint">อัปเดตชื่อล่าสุด {whenText(identity.refreshedAt)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => run("refresh", refreshGameIdentity, "อัปเดตชื่อจากเกมแล้ว")}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-bg-raised disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${busy === "refresh" ? "animate-spin" : ""}`} />
              รีเฟรชชื่อ
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => {
                if (window.confirm("ยกเลิกการผูกไอดีเกม? ชื่อในเกมจะหายจากโปรไฟล์")) {
                  void run("unlink", unlinkGameIdentity, "ยกเลิกการผูกแล้ว");
                }
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-loss hover:bg-bg-raised disabled:opacity-50"
            >
              ยกเลิกการผูก
            </button>
          </div>
          <p className="text-[11px] text-text-faint">
            ชื่อดึงจากในเกม แก้ไขเองไม่ได้ ถ้าเปลี่ยนชื่อในเกมแล้ว กดรีเฟรชได้วันละ 1 ครั้ง คนอื่นจะเห็นแค่ชื่อ ไม่เห็น OpenID
          </p>
        </div>
      )}

      {identity === null && (
        <div className="space-y-2">
          <input
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
            maxLength={24}
            placeholder="OpenID ของเกม RoV (ตัวเลข)"
            className={INPUT_CLASS}
          />
          <button
            type="button"
            disabled={busy !== null || playerId.replace(/\D/g, "").length < 8}
            onClick={() => run("link", () => linkGameIdentity(playerId), "ผูกไอดีเกมแล้ว")}
            className="w-full rounded-lg bg-accent py-2 text-sm font-medium text-accent-fg disabled:opacity-50"
          >
            {busy === "link" ? "กำลังตรวจสอบ..." : "ตรวจสอบและผูกไอดี"}
          </button>
          <p className="text-[11px] text-text-faint">
            คัดลอก OpenID จากในเกม RoV ระบบจะดึงชื่อในเกมมาแสดงให้ (แก้ไขเองไม่ได้) และจะไม่แสดง OpenID ให้คนอื่นเห็น
            การผูกนี้พิสูจน์ไม่ได้ว่าคุณเป็นเจ้าของไอดีนั้น อย่าใช้ไอดีของคนอื่น
          </p>
        </div>
      )}
    </div>
  );
}
