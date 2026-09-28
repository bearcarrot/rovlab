import * as React from "react";
import { cn } from "@/lib/utils";

const TIER_STYLES: Record<string, string> = {
  "S+": "bg-accent text-accent-fg",
  S: "bg-accent/90 text-accent-fg",
  A: "bg-rift text-white",
  B: "bg-bg-raised text-text-muted border border-border",
  C: "bg-bg-raised text-text-faint border border-border",
};

export function Badge({
  className,
  tier,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tier?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-semibold",
        tier ? TIER_STYLES[tier] ?? "bg-bg-raised text-text-muted" : "bg-bg-raised text-text-muted border border-border",
        className
      )}
      {...props}
    />
  );
}
