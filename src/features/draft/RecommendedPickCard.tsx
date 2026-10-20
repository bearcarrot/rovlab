import { Link } from "react-router-dom";
import { AlertTriangle, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HeroIcon } from "@/components/HeroIcon";
import { MATCHUP_STARS, StarRating } from "@/features/heroes/MatchupStars";
import type { HeroSummary } from "@/types/hero";
import type { Recommendation, RecommendTag } from "./analyzeTeam";

const TAG_LABEL: Record<RecommendTag, string> = {
  firstPick: "First Pick",
  counter: "ชนะทางศัตรู",
  synergy: "คอมโบ",
};

// การ์ดฮีโร่ที่ระบบแนะนำ — การถาม Coach Ai ย้ายไปอยู่ที่ปุ่มลอย (FAB) ของหน้า Draft แล้ว (ดู DraftAssistant)
// enemies: ฮีโร่ทีมศัตรูที่เลือกอยู่ ใช้หาไอคอนของตัวที่ถูกชนะทาง (ไม่มี = แสดงเป็นชื่อแทน)
export function RecommendedPickCard({
  rec,
  onPick,
  enemies,
}: {
  rec: Recommendation;
  onPick: () => void;
  enemies?: HeroSummary[];
}) {
  // คอมโบที่แอดมินยังไม่ได้กรอกคำอธิบาย: บอกตรงๆ แทนการเงียบ
  const missingCombos = rec.details.combos.filter((c) => !c.reason);
  const hasMechanism = rec.explain.length > 0 || missingCombos.length > 0;
  const wins = rec.details.counters.filter((c) => c.direction === "wins");
  const { stat } = rec.hero;
  // บรรทัด "ชนะทาง X (ระดับ…)" ซ้ำกับแถวดาวชนะทางด้านบน จึงไม่แสดงซ้ำ (reasons เดิมยังอยู่ใน rec สำหรับที่อื่น)
  const reasons = rec.reasons.filter((r) => !wins.some((c) => r.startsWith(`ชนะทาง ${c.enemy} (`)));

  return (
    <Card>
      <CardHeader>
        <div className="flex min-w-0 items-center gap-2.5">
          <Link to={`/heroes/${rec.hero.slug}`} aria-label={rec.hero.nameTh} className="shrink-0">
            <HeroIcon icon={rec.hero.icon} name={rec.hero.name} className="h-11 w-11" />
          </Link>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <CardTitle className="max-w-full truncate">{rec.hero.nameTh}</CardTitle>
            {stat.hasStats ? <Badge tier={stat.tier}>{stat.tier}</Badge> : <Badge>N/A</Badge>}
          </div>
        </div>
        {/* 1–5 ดาวคือคะแนนแนะนำภาพรวม: ซ่อนเมื่อการ์ดนี้มีข้อมูลชนะทาง เพื่อไม่ให้ปนกับดาว 3/2/1 */}
        {wins.length === 0 && (
          <div
            role="img"
            aria-label={`คะแนนแนะนำภาพรวม ${rec.stars} จาก 5`}
            title="คะแนนแนะนำภาพรวม (ไม่ใช่ระดับการชนะทาง)"
            className="flex shrink-0"
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={`h-3.5 w-3.5 ${i < rec.stars ? "fill-accent text-accent" : "text-border"}`} />
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {rec.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {rec.tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent"
              >
                {TAG_LABEL[t]}
              </span>
            ))}
          </div>
        )}
        {wins.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-text-muted">
            <span>ชนะทาง</span>
            {wins.map((c) => {
              const m = MATCHUP_STARS[c.strength];
              const e = enemies?.find((h) => h.nameTh === c.enemy);
              return (
                <span key={c.enemy} title={c.enemy} className="inline-flex items-center gap-1.5">
                  {e ? (
                    <>
                      <HeroIcon icon={e.icon} name={e.name} className="h-8 w-8" />
                      <span className="sr-only">{c.enemy}</span>
                    </>
                  ) : (
                    <span className="text-text">{c.enemy}</span>
                  )}
                  <StarRating stars={m.stars} label={m.label} />
                </span>
              );
            })}
          </div>
        )}
        <p className="text-xs text-text-muted">ความเสี่ยง: {rec.risk}</p>
        <ul className="space-y-1 text-sm text-text-muted">
          {reasons.map((r) => <li key={r}>• {r}</li>)}
        </ul>

        {/* กลไกคอมโบ/ชนะทาง จากข้อมูลที่แอดมินกรอกไว้ */}
        {hasMechanism && (
          <div className="space-y-1 rounded-lg border border-border bg-bg-raised p-2 text-xs leading-relaxed text-text">
            <p className="font-medium text-text-muted">ทำงานยังไง</p>
            {rec.explain.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
            {missingCombos.map((c) => (
              <p key={c.partner} className="text-text-faint">
                {rec.hero.nameTh} + {c.partner}: ยังไม่มีคำอธิบายกลไกในระบบ
              </p>
            ))}
          </div>
        )}

        {rec.warnings.length > 0 && (
          <ul className="space-y-1 text-sm text-amber-400">
            {rec.warnings.map((w) => (
              <li key={w} className="flex gap-1.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={onPick}
          className="w-full rounded-lg bg-bg-raised py-1.5 text-sm font-medium text-text hover:bg-border"
        >
          เลือกฮีโร่นี้
        </button>
      </CardContent>
    </Card>
  );
}
