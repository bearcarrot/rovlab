import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { sortTags, tagColor, type EffectTag } from "@/lib/effectTags";
import { getEffectTagColors } from "@/services/effectTagStyles";

// สีที่แอดมินตั้งไว้ โหลดครั้งเดียว (แคชในเซอร์วิส) ระหว่างโหลดใช้สีเริ่มต้นตามกลุ่ม
export function useEffectTagColors(): Record<string, string> {
  const [colors, setColors] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    void getEffectTagColors().then((c) => {
      if (alive) setColors(c);
    });
    return () => {
      alive = false;
    };
  }, []);
  return colors;
}

// สีเป็น hex ใส่ผ่าน inline style (Tailwind สร้างคลาสจากสีที่แอดมินเลือกเองไม่ได้): ตัวอักษร=สีเต็ม, พื้น/ขอบ=สีเดียวกันโปร่งใส
export function EffectTagBadge({ name, color, className }: { name: string; color: string; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none", className)}
      style={{ color, borderColor: `${color}66`, backgroundColor: `${color}26` }}
    >
      {name}
    </span>
  );
}

// ไม่มีแท็ก (ยังไม่ได้นำเข้า) = ไม่แสดงอะไร ไม่ให้หน้าว่างเปล่าดูแปลก
export function EffectTagList({ tags, className }: { tags: EffectTag[]; className?: string }) {
  const colors = useEffectTagColors();
  if (tags.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {sortTags(tags).map((t) => (
        <EffectTagBadge key={t.name} name={t.name} color={tagColor(t.name, colors)} />
      ))}
    </div>
  );
}
