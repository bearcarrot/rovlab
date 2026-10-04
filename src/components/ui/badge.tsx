import * as React from "react";
import { cn } from "@/lib/utils";

// สีป้าย Tier ทุกหน้าใช้ที่นี่ที่เดียว (ค่าสีอยู่ใน tailwind.config.ts → colors.tier)
// S+ แดง · S ส้ม · A เหลือง · B เขียว · C ฟ้า (ชื่อคลาสเขียนเต็มเพื่อให้ Tailwind สแกนเจอ)
const TIER_STYLES: Record<string, string> = {
  "S+": "bg-tier-sp text-white",
  S: "bg-tier-s text-accent-fg",
  A: "bg-tier-a text-accent-fg",
  B: "bg-tier-b text-accent-fg",
  C: "bg-tier-c text-white",
};

// สีป้ายระดับความยากของคู่มือ: ง่าย เขียว · ปานกลาง เหลือง · ยาก ส้ม
// ใช้ชุดสีเดียวกับ Tier (B เขียว · A เหลือง · S ส้ม) จึงอ่านออกทั้งโหมดสว่าง/มืด
const DIFFICULTY_STYLES: Record<string, string> = {
  easy: "bg-tier-b text-accent-fg",
  medium: "bg-tier-a text-accent-fg",
  hard: "bg-tier-s text-accent-fg",
};

const NEUTRAL = "bg-bg-raised text-text-muted border border-border";

export function Badge({
  className,
  tier,
  difficulty,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tier?: string; difficulty?: string | null }) {
  const color = tier
    ? (TIER_STYLES[tier] ?? "bg-bg-raised text-text-muted")
    : difficulty
      ? (DIFFICULTY_STYLES[difficulty] ?? NEUTRAL)
      : NEUTRAL;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-semibold",
        color,
        className
      )}
      {...props}
    />
  );
}
