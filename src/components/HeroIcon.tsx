import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { viaVercel } from "@/lib/imageUrl";

type Props = {
  icon?: string | null;
  name: string;
  /** ตัวอักษรย่อที่แสดงเมื่อไม่มีรูปหรือรูปโหลดไม่ได้ (ไม่ใส่จะใช้ 2 ตัวแรกของ name) */
  fallback?: string;
  className?: string;
  /** รูปตกแต่ง: alt ว่าง ใช้เมื่อชื่อฮีโร่แสดงเป็นข้อความอยู่ข้างๆ แล้ว */
  decorative?: boolean;
  /** โหลดทันที ใช้เฉพาะรูปที่จำเป็นต่อการแสดงผลแรกของหน้า (ค่าเริ่มต้น lazy) */
  eager?: boolean;
};

// รูปใน bucket hero-icons ถูกโหลดผ่าน /img/* (rewrite ใน vercel.json) เพื่อไม่ให้ทุก request ไปติด API Gateway log ของ Supabase
// รูปที่ไม่ใช่ Supabase Storage (เช่น R2 https://assets.rovlab.app/...) ใช้ URL เดิมตรงๆ ไม่ผ่าน proxy
// ทุกที่ที่แสดงไอคอนฮีโร่ควรใช้ HeroIcon เพื่อให้รูปเดียวกันใช้ URL เดียวกัน (เบราว์เซอร์จะใช้แคชซ้ำได้)

export function HeroIcon({ icon, name, fallback, className, decorative = false, eager = false }: Props) {
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
          alt={decorative ? "" : name}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          // ถ้า /img/* โหลดไม่ได้ ให้ลองลิงก์ Supabase เดิมอีกครั้งก่อนแสดงตัวอักษรย่อ
          onError={() => (proxy && src !== icon ? setProxy(false) : setFailed(true))}
        />
      ) : (
        <span aria-hidden={decorative || undefined}>{initials}</span>
      )}
    </div>
  );
}
