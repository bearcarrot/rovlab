import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MaintenanceConfig } from "./schedule";

// Shown instead of the app while a maintenance window is active (see MaintenanceGate) and inside the admin tab as a preview.
// The announcement text comes from the admin; DEFAULT_MESSAGE is only a fallback for an empty field.
const DEFAULT_MESSAGE =
  "RoV LAB กำลังปรับปรุงเพื่อให้เครื่องมือของคุณทำงานได้ดียิ่งขึ้น ขออภัยในความไม่สะดวก แล้วพบกันอีกครั้งเร็ว ๆ นี้";

const pad = (n: number) => String(n).padStart(2, "0");

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${d > 0 ? `${d} วัน ` : ""}${pad(h)}:${pad(m)}:${pad(s)}`;
}

const fmtEnd = (ms: number) =>
  new Date(ms).toLocaleString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });

// Local 1 s tick, only while a valid future end is known. No network involved: the store flips the page when the window ends.
function useRemaining(endMs: number | null, offsetMs: number): number | null {
  const [now, setNow] = useState(() => Date.now() + offsetMs);
  useEffect(() => {
    if (endMs === null) return;
    setNow(Date.now() + offsetMs);
    const id = window.setInterval(() => setNow(Date.now() + offsetMs), 1000);
    return () => window.clearInterval(id);
  }, [endMs, offsetMs]);
  if (endMs === null) return null;
  const left = endMs - now;
  return left > 0 ? left : null;
}

export function MaintenancePage({
  config,
  offsetMs = 0,
  preview = false,
}: {
  config: MaintenanceConfig;
  offsetMs?: number;
  preview?: boolean;
}) {
  const parsedEnd = config.endsAt === null ? Number.NaN : Date.parse(config.endsAt);
  const endMs = Number.isNaN(parsedEnd) ? null : parsedEnd;
  const remaining = useRemaining(endMs, offsetMs);
  const message = config.message.trim() === "" ? DEFAULT_MESSAGE : config.message;

  return (
    <div
      className={cn(
        "relative flex w-full flex-col items-center justify-center overflow-hidden bg-bg text-text",
        preview ? "min-h-[460px] rounded-card" : "min-h-screen min-h-dvh",
      )}
      style={
        preview
          ? undefined
          : { paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }
      }
    >
      {preview && (
        <div className="absolute inset-x-0 top-0 z-10 bg-accent px-3 py-1.5 text-center text-xs font-medium text-accent-fg">
          ตัวอย่าง — ผู้เข้าชมยังไม่เห็นหน้านี้ (ไม่กระทบเว็บจริง)
        </div>
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(232,163,61,0.16),transparent_70%)]"
      />
      <main className="relative z-[1] mx-auto flex w-full max-w-md flex-col items-center gap-6 px-6 py-16 text-center">
        <div className="flex items-center gap-2.5">
          <img src="/v1/logo-64.webp" alt="RoV LAB" width={40} height={40} className="h-10 w-10 shrink-0" />
          <span className="font-display text-xl font-semibold tracking-tight">RoV LAB</span>
        </div>

        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-bg-surface text-accent">
          <Wrench className="h-7 w-7" aria-hidden="true" />
        </div>

        <div className="space-y-3" role="status">
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">เรากำลังปรับปรุงระบบ</h1>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-text-muted sm:text-base">{message}</p>
        </div>

        {(endMs !== null || config.etaNote.trim() !== "") && (
          <div className="w-full space-y-2 rounded-card border border-border bg-bg-surface p-4">
            {endMs !== null && (
              <p className="text-sm text-text-muted">
                คาดว่าจะเปิดให้บริการอีกครั้ง <span className="font-medium text-text">{fmtEnd(endMs)}</span> น. (เวลาไทย)
              </p>
            )}
            {config.etaNote.trim() !== "" && <p className="break-words text-sm text-text-muted">{config.etaNote}</p>}
            {remaining !== null && (
              <p aria-hidden="true" className="font-display text-3xl font-semibold tabular-nums text-accent">
                {formatRemaining(remaining)}
              </p>
            )}
          </div>
        )}

        {!preview && (
          <Link to="/login" className="text-xs text-text-faint underline-offset-2 hover:text-text-muted hover:underline">
            สำหรับผู้ดูแลระบบ
          </Link>
        )}
      </main>
    </div>
  );
}
