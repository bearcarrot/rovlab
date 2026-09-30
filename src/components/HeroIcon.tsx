import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  icon?: string | null;
  name: string;
  /** ตัวอักษรย่อที่แสดงเมื่อไม่มีรูปหรือรูปโหลดไม่ได้ (ไม่ใส่จะใช้ 2 ตัวแรกของ name) */
  fallback?: string;
  className?: string;
};

export function HeroIcon({ icon, name, fallback, className }: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [icon]);

  const initials = fallback ?? Array.from(name).slice(0, 2).join("").toUpperCase();

  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-bg-raised font-display text-xs text-text-faint",
        className
      )}
    >
      {icon && !failed ? (
        <img
          src={icon}
          alt={name}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
