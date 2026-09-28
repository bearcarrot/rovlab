import { Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { recommendPicks } from "./analyzeTeam";

type Rec = ReturnType<typeof recommendPicks>[number];

export function RecommendedPickCard({ rec, onPick }: { rec: Rec; onPick: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{rec.hero.nameTh}</CardTitle>
        <div className="flex shrink-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={`h-3.5 w-3.5 ${i < rec.stars ? "fill-accent text-accent" : "text-border"}`} />
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex gap-3 text-xs text-text-muted">
          <span>ความเสี่ยง: {rec.risk}</span>
          <span>Tier {rec.hero.stat.tier}</span>
        </div>
        <ul className="space-y-1 text-sm text-text-muted">
          {rec.reasons.map((r) => <li key={r}>• {r}</li>)}
        </ul>
        <button
          onClick={onPick}
          className="mt-1 w-full rounded-lg bg-bg-raised py-1.5 text-sm font-medium text-text hover:bg-border"
        >
          เลือกฮีโร่นี้
        </button>
      </CardContent>
    </Card>
  );
}
