import { useState } from "react";
import { cn } from "@/lib/utils";

export function Avatar({ handle, url, size = "md" }: { handle: string; url: string | null; size?: "sm" | "md" | "lg" }) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-raised font-display text-text-faint",
        size === "sm" && "h-7 w-7 text-xs",
        size === "md" && "h-9 w-9 text-sm",
        size === "lg" && "h-16 w-16 text-xl"
      )}
    >
      {url && !failed ? (
        <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        handle.slice(0, 1).toUpperCase()
      )}
    </div>
  );
}
