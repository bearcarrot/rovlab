import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

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

// ทุกที่ที่แสดงไอคอนฮีโร่ควรใช้ HeroIcon เพื่อให้รูปเดียวกันใช้ URL เดียวกัน (เบราว์เซอร์/Cloudflare จะใช้แคชซ้ำได้)
// รูปทั้งหมดอยู่ใน Cloudflare R2 (https://assets.rovlab.app/...) และถูกส่งด้วย Cache-Control: immutable
export function HeroIcon({ icon, name, fallback, className, decorative = false, eager = false }: Props) {
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
          alt={decorative ? "" : name}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden={decorative || undefined}>{initials}</span>
      )}
    </div>
  );
}
