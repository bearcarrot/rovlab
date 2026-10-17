import { Progress } from "@/components/ui/progress";
import type { TeamAnalysis } from "./analyzeTeam";

const MAX = 10; // heuristic ceiling per dimension, for bar scaling only

const ROWS: { key: keyof TeamAnalysis; label: string }[] = [
  { key: "frontline", label: "แนวหน้า" },
  { key: "cc", label: "CC" },
  { key: "mobility", label: "ความคล่องตัว" },
  { key: "sustain", label: "การคงทน" },
  { key: "earlyGame", label: "ความแข็งแกร่งช่วงต้นเกม" },
  { key: "lateGame", label: "ความแข็งแกร่งช่วงปลายเกม" },
];

// tag = ป้ายหน้าแถบ ใช้ตอนเทียบสองทีมเท่านั้น
function DamageBar({ a, tag }: { a: TeamAnalysis; tag?: string }) {
  const total = a.physicalDamage + a.magicDamage;
  return (
    <div className="flex items-center gap-2">
      {tag && <span className="w-12 shrink-0 text-[11px] text-text-faint">{tag}</span>}
      <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-bg-raised">
        <div className="h-full bg-rift" style={{ width: total ? `${(a.physicalDamage / total) * 100}%` : "50%" }} />
        <div className="h-full bg-accent" style={{ width: total ? `${(a.magicDamage / total) * 100}%` : "50%" }} />
      </div>
    </div>
  );
}

// enemy = ผลวิเคราะห์ทีมศัตรู (ส่งมาเมื่อเลือกศัตรูมากพอแล้วเท่านั้น); ไม่ส่ง = แสดงเฉพาะทีมเรา
export function TeamMeters({ analysis, enemy }: { analysis: TeamAnalysis; enemy?: TeamAnalysis }) {
  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 flex justify-between text-xs text-text-muted">
          <span>ดาเมจกายภาพ</span>
          <span>ดาเมจเวท</span>
        </div>
        <div className="space-y-1">
          <DamageBar a={analysis} tag={enemy ? "ทีมคุณ" : undefined} />
          {enemy && <DamageBar a={enemy} tag="ศัตรู" />}
        </div>
      </div>
      {enemy && (
        <div className="flex items-center gap-3 text-[11px] text-text-faint">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-accent" />
            ทีมคุณ
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-text-faint" />
            ศัตรู
          </span>
        </div>
      )}
      {ROWS.map((r) => (
        <div key={r.key}>
          <div className="mb-1 flex justify-between text-xs text-text-muted">
            <span>{r.label}</span>
          </div>
          <Progress value={(Number(analysis[r.key]) / MAX) * 100} />
          {enemy && <Progress className="mt-1" barClassName="bg-text-faint" value={(Number(enemy[r.key]) / MAX) * 100} />}
        </div>
      ))}
      <p className="pt-1 text-[11px] text-text-faint">
        * ค่าประเมินจาก Role ของฮีโร่ (Heuristic) ยังไม่ใช่ข้อมูลจริงระดับสกิล
      </p>
    </div>
  );
}
