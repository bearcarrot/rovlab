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

// รูปจากโดเมนนี้ขอด้วย CORS (crossOrigin="anonymous") เหมือนตัวโหลดรูปแชร์ใน lib/share-image/assets.ts
// เพื่อให้ <img> กับการโหลดรูปแชร์ใช้แคชของเบราว์เซอร์ร่วมกัน (คำขอแบบ CORS กับไม่ใช้ CORS ใช้แคชร่วมกันไม่ได้เมื่อมี Vary: Origin)
// โดเมนอื่นอาจไม่ส่ง CORS header จึงไม่ใส่ crossOrigin
const R2_ORIGIN = "https://assets.rovlab.app/";

// ทุกที่ที่แสดงไอคอนฮีโร่ควรใช้ HeroIcon เพื่อให้รูปเดียวกันใช้ URL เดียวกัน (เบราว์เซอร์/Cloudflare จะใช้แคชซ้ำได้)
// รูปทั้งหมดอยู่ใน Cloudflare R2 (https://assets.rovlab.app/...) และถูกส่งด้วย Cache-Control: immutable
export function HeroIcon({ icon, name, fallback, className, decorative = false, eager = false }: Props) {
  const [failed, setFailed] = useState(false);
  // CORS ไม่ผ่าน (เช่นโดเมนพรีวิวที่ยังไม่อยู่ใน CORS policy ของบักเก็ต) → ลองใหม่แบบไม่ใช้ CORS หนึ่งครั้ง รูปจะได้ไม่หาย
  const [noCors, setNoCors] = useState(false);

  useEffect(() => {
    setFailed(false);
    setNoCors(false);
  }, [icon]);

  const withCors = !!icon && icon.startsWith(R2_ORIGIN) && !noCors;
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
          key={withCors ? "cors" : "plain"}
          src={icon}
          alt={decorative ? "" : name}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          crossOrigin={withCors ? "anonymous" : undefined}
          className="h-full w-full object-cover"
          onError={() => (withCors ? setNoCors(true) : setFailed(true))}
        />
      ) : (
        <span aria-hidden={decorative || undefined}>{initials}</span>
      )}
    </div>
  );
}
