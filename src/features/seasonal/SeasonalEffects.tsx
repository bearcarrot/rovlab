import { useEffect, useState, type CSSProperties } from "react";
import { isHalloweenActive, msUntilHalloweenEnd } from "@/features/seasonal/halloween";
import "./halloween.css";

// เอฟเฟกต์ Halloween 2026: CSS + inline SVG ล้วน ไม่มี network/dependency ใหม่ ไม่ดักคลิก (pointer-events: none)
// นอกช่วงวันที่ 31 ต.ค. 2026 (หรือปิดด้วย HALLOWEEN_ENABLED) คืน null = ไม่มี DOM/animation

// ลูกไฟ 6 ดวง: --x ตำแหน่งแนวนอน, --dx ระยะเลื่อนข้าง, --d ระยะเวลา, --w ดีเลย์ (ลบ = เริ่มกลางทาง), --s ขนาด
const EMBERS: CSSProperties[] = [
  { "--x": "8%", "--dx": "28px", "--d": "19s", "--w": "-4s", "--s": "4px" },
  { "--x": "72%", "--dx": "-34px", "--d": "23s", "--w": "-11s", "--s": "3px" },
  { "--x": "31%", "--dx": "-22px", "--d": "17s", "--w": "-8s", "--s": "5px" },
  { "--x": "55%", "--dx": "36px", "--d": "21s", "--w": "-15s", "--s": "3px" },
  { "--x": "90%", "--dx": "-26px", "--d": "25s", "--w": "-2s", "--s": "4px" },
  { "--x": "44%", "--dx": "20px", "--d": "20s", "--w": "-17s", "--s": "3px" },
] as CSSProperties[];

// หยากไย่มุมบน (วาดที่มุมซ้ายบนของ viewBox; ฝั่งขวาใช้ CSS กลับด้าน)
function Web({ className }: { className: string }) {
  return (
    <svg className={`hw-web ${className}`} viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M0 0 L97 0 M0 0 L90 37 M0 0 L69 69 M0 0 L37 90 M0 0 L0 97" />
      <path d="M34 0 L31 13 L24 24 L13 31 L0 34" />
      <path d="M63 0 L58 24 L45 45 L24 58 L0 63" />
      <path d="M92 0 L85 35 L65 65 L35 85 L0 92" />
    </svg>
  );
}

export function SeasonalEffects() {
  const [active, setActive] = useState(() => isHalloweenActive());

  // ปิดเองเมื่อถึงเที่ยงคืน 1 พ.ย. สำหรับคนที่เปิดหน้าค้างไว้ (timer เดียว ไม่มี listener; ตั้งเฉพาะตอนอยู่ในช่วง)
  useEffect(() => {
    const ms = msUntilHalloweenEnd();
    if (ms === null) return;
    const id = window.setTimeout(() => setActive(isHalloweenActive()), ms + 50);
    return () => window.clearTimeout(id);
  }, []);

  if (!active) return null;

  return (
    <div className="hw-root" aria-hidden="true">
      <div className="hw-glow" />
      <Web className="hw-web-l" />
      <Web className="hw-web-r" />
      <div className="hw-embers">
        {EMBERS.map((style, i) => (
          <span key={i} className="hw-ember" style={style} />
        ))}
      </div>
      <svg className="hw-bat" viewBox="0 0 32 22" width="30" height="21">
        <path
          d="M16 6c-2 0-3 2-3.5 3.5C10 8 6 7 1 10c3 0 4.500 1.500 5 3.500 1.200-1 3-1.300 4.500-.5.600 1.400 1.800 2.500 3 2.800L16 20l1.500-3.700c1.200-.3 2.400-1.400 3-2.800 1.500-.8 3.300-.5 4.500.5.500-2 2-3.500 5-3.500-5-3-9-2-11.500-.5C19 8 18 6 16 6z"
          fill="#1C1F26"
          stroke="#E8A33D"
          strokeWidth=".6"
        />
      </svg>
    </div>
  );
}
