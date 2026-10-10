import { Link } from "react-router-dom";
import { AlertTriangle, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HeroIcon } from "@/components/HeroIcon";
import type { Recommendation, RecommendTag } from "./analyzeTeam";

const TAG_LABEL: Record<RecommendTag, string> = {
  firstPick: "First Pick",
  counter: "ชนะทางศัตรู",
  synergy: "คอมโบ",
};

// การ์ดฮีโร่ที่ระบบแนะนำ — การถาม Coach Ai ย้ายไปอยู่ที่ปุ่มลอย (FAB) ของหน้า Draft แล้ว (ดู DraftAssistant)
export function RecommendedPickCard({ rec, onPick }: { rec: Recommendation; onPick: () => void }) {
  // คอมโบที่แอดมินยังไม่ได้กรอกคำอธิบาย: บอกตรงๆ แทนการเงียบ
  const missingCombos = rec.details.combos.filter((c) => !c.reason);
  const hasMechanism = rec.explain.length > 0 || missingCombos.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex min-w-0 items-center gap-2.5">
          <Link to={`/heroes/${rec.hero.slug}`} aria-label={rec.hero.nameTh} className="shrink-0">
            <HeroIcon icon={rec.hero.icon} name={rec.hero.name} className="h-11 w-11" />
          </Link>
          <CardTitle>{rec.hero.nameTh}</CardTitle>
        </div>
        <div className="flex shrink-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={`h-3.5 w-3.5 ${i < rec.stars ? "fill-accent text-accent" : "text-border"}`} />
          ))}
        </div>
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
        <div className="flex gap-3 text-xs text-text-muted">
          <span>ความเสี่ยง: {rec.risk}</span>
          {rec.hero.stat.hasStats && <span>Tier {rec.hero.stat.tier}</span>}
        </div>
        <ul className="space-y-1 text-sm text-text-muted">
          {rec.reasons.map((r) => <li key={r}>• {r}</li>)}
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
