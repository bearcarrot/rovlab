import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  icon?: string | null;
  name: string;
  /** ตัวอักษรย่อที่แสดงเมื่อไม่มีรูปหรือรูปโหลดไม่ได้ (ไม่ใส่จะใช้ 2 ตัวแรกของ name) */
  fallback?: string;
  className?: string;
};

// รูปใน bucket hero-icons ถูกโหลดผ่าน /img/* (rewrite ใน vercel.json) เพื่อไม่ให้ทุก request ไปติด API Gateway log ของ Supabase
const STORAGE_PREFIX = "https://mttcdaiwuasnkqlxbeqs.supabase.co/storage/v1/object/public/hero-icons/";
const viaVercel = (url: string) => (url.startsWith(STORAGE_PREFIX) ? `/img/${url.slice(STORAGE_PREFIX.length)}` : url);

export function HeroIcon({ icon, name, fallback, className }: Props) {
  const [failed, setFailed] = useState(false);
  const [proxy, setProxy] = useState(true);

  useEffect(() => {
    setFailed(false);
    setProxy(true);
  }, [icon]);

  const initials = fallback ?? Array.from(name).slice(0, 2).join("").toUpperCase();
  const src = icon && proxy ? viaVercel(icon) : icon;

  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-bg-raised font-display text-xs text-text-faint",
        className
      )}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          // ถ้า /img/* โหลดไม่ได้ ให้ลองลิงก์ Supabase เดิมอีกครั้งก่อนแสดงตัวอักษรย่อ
          onError={() => (proxy && src !== icon ? setProxy(false) : setFailed(true))}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
