import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// `fallback` replaces the default initial-letter placeholder (e.g. a generic user icon).
export function UserAvatar({
  name,
  url,
  className,
  fallback,
  eager = false,
}: {
  name: string;
  url?: string | null;
  className?: string;
  fallback?: ReactNode;
  /** above-the-fold avatar (likely LCP): load immediately instead of lazily */
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  const showImg = !!url && url.startsWith("https://") && !failed;
  return (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-raised font-display text-xs text-text-faint",
        className
      )}
    >
      {showImg ? (
        <img
          src={url!}
          alt={name}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          width={160}
          height={160}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        (fallback ?? <span>{(Array.from(name)[0] ?? "?").toUpperCase()}</span>)
      )}
    </div>
  );
}
