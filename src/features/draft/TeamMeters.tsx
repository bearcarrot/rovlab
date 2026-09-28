import { Progress } from "@/components/ui/progress";
import type { TeamAnalysis } from "./analyzeTeam";

const MAX = 10; // heuristic ceiling per dimension, for bar scaling only

const ROWS: { key: keyof TeamAnalysis; label: string }[] = [
  { key: "frontline", label: "แนวหน้า" },
  { key: "cc", label: "Crowd Control" },
  { key: "mobility", label: "ความคล่องตัว" },
  { key: "sustain", label: "การคงทน" },
  { key: "earlyGame", label: "ความแข็งแกร่งช่วงต้นเกม" },
  { key: "lateGame", label: "ความแข็งแกร่งช่วงปลายเกม" },
];

export function TeamMeters({ analysis }: { analysis: TeamAnalysis }) {
  const total = analysis.physicalDamage + analysis.magicDamage;
  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 flex justify-between text-xs text-text-muted">
          <span>ดาเมจกายภาพ</span>
          <span>ดาเมจเวท</span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-bg-raised">
          <div className="h-full bg-rift" style={{ width: total ? `${(analysis.physicalDamage / total) * 100}%` : "50%" }} />
          <div className="h-full bg-accent" style={{ width: total ? `${(analysis.magicDamage / total) * 100}%` : "50%" }} />
        </div>
      </div>
      {ROWS.map((r) => (
        <div key={r.key}>
          <div className="mb-1 flex justify-between text-xs text-text-muted">
            <span>{r.label}</span>
          </div>
          <Progress value={(Number(analysis[r.key]) / MAX) * 100} />
        </div>
      ))}
      <p className="pt-1 text-[11px] text-text-faint">
        * ค่าประเมินจาก Role ของฮีโร่ (Heuristic) ยังไม่ใช่ข้อมูลจริงระดับสกิล
      </p>
    </div>
  );
}
