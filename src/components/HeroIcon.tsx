import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  icon?: string | null;
  name: string;
  /** ตัวอักษรย่อที่แสดงเมื่อไม่มีรูปหรือรูปโหลดไม่ได้ (ไม่ใส่จะใช้ 2 ตัวแรกของ name) */
  fallback?: string;
  className?: string;
};

// โหลดรูปจาก URL ที่เก็บในฐานข้อมูลโดยตรง (Supabase Storage)
// เคยลองส่งผ่าน /img/* rewrite ของ Vercel แต่ทุกรูปที่แสดงนับเป็น CDN Request ของ Vercel (Hobby จำกัด 1M ต่อเดือน)
// ซึ่งหมดเร็วกว่า (~900k request รูปต่อวัน) จึงกลับมาใช้ลิงก์ตรง — ถ้าจะส่งผ่าน Vercel อีก ต้องลดจำนวน request รูปก่อน เช่น รวมไอคอนเป็น sprite
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
          decoding="async"
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
