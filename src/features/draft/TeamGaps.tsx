import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { TeamGap } from "./teamGaps";

// บอกชัดๆ ว่าทีมตอนนี้ขาดอะไร (ไม่ต้องไล่ดูแถบ meter เอง) — ส่วนที่แนะนำตัวถัดไปใช้เกณฑ์เดียวกัน
export function TeamGaps({ gaps, filledSlots }: { gaps: TeamGap[]; filledSlots: number }) {
  if (filledSlots === 0) return null;

  if (gaps.length === 0) {
    return (
      <div className="mb-2 flex items-start gap-2 rounded-card border border-border bg-bg-surface p-3 text-sm">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-win" />
        <p className="text-text-muted">
          <span className="font-medium text-text">องค์ประกอบหลักครบ</span> · ดาเมจสองสาย แนวหน้า และ CC ผ่านเกณฑ์แล้ว
        </p>
      </div>
    );
  }

  return (
    <div className="mb-2 rounded-card border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm">
      <p className="flex items-center gap-1.5 font-medium text-yellow-500">
        <AlertTriangle className="h-4 w-4" /> ทีมตอนนี้ยังขาด {gaps.length} อย่าง
      </p>
      <ul className="mt-2 space-y-1.5">
        {gaps.map((g) => (
          <li key={g.key} className="text-text-muted">
            <span className="font-medium text-text">{g.label}</span> — {g.detail}
          </li>
        ))}
      </ul>
      {filledSlots < 5 && (
        <p className="mt-2 text-[11px] text-text-faint">ตัวที่แนะนำด้านล่างจะเน้นเติมจุดเหล่านี้ให้</p>
      )}
    </div>
  );
}
