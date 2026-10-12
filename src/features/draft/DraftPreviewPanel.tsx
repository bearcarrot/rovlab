import { Progress } from "@/components/ui/progress";

const PREVIEW_METERS = [
  { label: "แนวหน้า", value: 30 },
  { label: "Crowd Control", value: 60 },
  { label: "ความคล่องตัว", value: 80 },
];

// ภาพประกอบแบบ static (ไม่มี request) ใช้เป็นค่าเริ่มต้นและเป็น fallback เมื่อยังไม่มีดราฟต์ชุมชนที่มียอดถูกใจ
// min-h เท่ากับ CommunityDraftSpotlight (208px) เพื่อไม่ให้เลย์เอาต์ขยับตอนสลับ (กัน CLS) และจัดเนื้อหาให้อยู่กึ่งกลาง
export function DraftPreviewPanel() {
  return (
    <div
      aria-hidden="true"
      className="flex min-h-[208px] flex-col justify-center gap-3 rounded-card border border-border bg-bg-surface p-4"
    >
      {PREVIEW_METERS.map((m) => (
        <div key={m.label}>
          <p className="mb-1 text-xs text-text-muted">{m.label}</p>
          <Progress value={m.value} />
        </div>
      ))}
      <p className="pt-1 text-[11px] text-text-faint">ภาพประกอบเพื่ออธิบายหน้าตา ไม่ใช่ผลวิเคราะห์จริง</p>
    </div>
  );
}
