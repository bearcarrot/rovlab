import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Decorative lane icon (the lane name is always written next to it). A missing / broken icon falls back to the
// first letter at the same size, so there is no broken-image glyph and no layout shift.
export function LaneIcon({ icon, label, className }: { icon?: string; label: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [icon]);
  if (icon && !failed) {
    return (
      <img
        src={icon}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className={cn("h-5 w-5 shrink-0 object-contain", className)}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded bg-bg-raised text-[10px] font-semibold uppercase text-text-faint", className)}
    >
      {Array.from(label)[0] ?? ""}
    </span>
  );
}
