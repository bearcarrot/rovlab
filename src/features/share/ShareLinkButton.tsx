import { useState } from "react";
import { Link2, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { canNativeShare, shareOrCopyLink } from "./shareLink";

export interface ShareLink {
  url: string;
  title: string;
}
// null = could not build (error toast); undefined = handled elsewhere (login prompt / publish dialog), show nothing
type BuildResult = ShareLink | null | undefined;

// Sits in the same row as ShareImageButtons (passed through its `extra` slot), so the sizing matches it.
// `build` runs on click so the link always reflects the current content. A synchronous build keeps the
// click's user gesture, which iOS needs to open the share sheet; an async build (DB lookup) falls back to copying.
export function ShareLinkButton({
  build,
  disabled,
  className,
}: {
  build: () => BuildResult | Promise<BuildResult>;
  disabled?: boolean;
  className?: string;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const label = canNativeShare() ? "แชร์ลิงก์" : "คัดลอกลิงก์";

  async function onClick() {
    if (busy) return;
    let link: BuildResult;
    try {
      const r = build();
      if (r instanceof Promise) {
        setBusy(true);
        link = await r;
      } else {
        link = r;
      }
    } catch (e) {
      setBusy(false);
      toast.error(e instanceof Error ? e.message : "สร้างลิงก์ไม่สำเร็จ ลองใหม่อีกครั้ง");
      return;
    }
    if (link === undefined) {
      setBusy(false);
      return;
    }
    if (link === null) {
      setBusy(false);
      toast.error("สร้างลิงก์ไม่สำเร็จ ลองใหม่อีกครั้ง");
      return;
    }
    setBusy(true);
    try {
      const outcome = await shareOrCopyLink(link.url, link.title);
      if (outcome === "shared") toast.success("เปิดเมนูแชร์แล้ว");
      else if (outcome === "copied") toast.success("คัดลอกลิงก์แล้ว");
      else if (outcome === "failed") window.prompt("คัดลอกลิงก์นี้", link.url); // clipboard blocked: let the user copy by hand
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={busy || disabled}
      aria-busy={busy}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-bg-surface py-2 text-sm font-medium text-text hover:bg-bg-raised disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none sm:px-4",
        className
      )}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
      {label}
    </button>
  );
}
