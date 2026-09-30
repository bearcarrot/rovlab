import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function UserAvatar({ name, url, className }: { name: string; url?: string | null; className?: string }) {
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
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{(Array.from(name)[0] ?? "?").toUpperCase()}</span>
      )}
    </div>
  );
}
