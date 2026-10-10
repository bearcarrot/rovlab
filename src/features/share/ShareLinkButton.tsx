import { useState } from "react";
import { Link2, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { canNativeShare, shareOrCopyLink } from "./shareLink";

// Share-as-URL button. `build` runs on click (so the link always reflects the current content) and returns null on failure.
// variant "bar" matches ShareImageButtons; "compact" matches the small action rows (e.g. Tier List workspace).
export function ShareLinkButton({
  build,
  disabled,
  variant = "bar",
  className,
}: {
  build: () => { url: string; title: string } | null;
  disabled?: boolean;
  variant?: "bar" | "compact";
  className?: string;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const label = canNativeShare() ? "แชร์ลิงก์" : "คัดลอกลิงก์";

  async function onClick() {
    if (busy) return;
    let link: { url: string; title: string } | null = null;
    try {
      link = build();
    } catch {
      link = null;
    }
    if (!link) {
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
        "flex items-center justify-center gap-1.5 rounded-lg border border-border text-sm disabled:cursor-not-allowed disabled:opacity-60",
        variant === "bar"
          ? "min-h-10 bg-bg-surface py-2 font-medium text-text hover:bg-bg-raised sm:px-4"
          : "px-3 py-1.5 text-text-muted hover:text-text",
        className
      )}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
      {label}
    </button>
  );
}
