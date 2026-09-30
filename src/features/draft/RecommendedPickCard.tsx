import { useState } from "react";
import { Sparkles, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HeroIcon } from "@/components/HeroIcon";
import { askCoach } from "@/services/ai";
import type { recommendPicks } from "./analyzeTeam";

type Rec = ReturnType<typeof recommendPicks>[number];

export function RecommendedPickCard({
  rec,
  onPick,
  draft,
}: {
  rec: Rec;
  onPick: () => void;
  draft?: unknown; // ทีมเรา/ศัตรูที่เลือกแล้ว (ไม่ใส่ก็ได้)
}) {
  const [advice, setAdvice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function ask() {
    setBusy(true);
    setError("");
    try {
      const text = await askCoach(
        `อธิบายสั้นๆ ไม่เกิน 3 ประโยค ว่าทำไมควรเลือก ${rec.hero.nameTh} ในดราฟต์นี้ และมีจุดไหนที่ต้องระวัง`,
        {
          hero: rec.hero.nameTh,
          tier: rec.hero.stat.tier,
          risk: rec.risk,
          reasons: rec.reasons,
          draft,
        },
      );
      setAdvice(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ถาม AI ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex min-w-0 items-center gap-2.5">
          <HeroIcon icon={rec.hero.icon} name={rec.hero.name} className="h-11 w-11" />
          <CardTitle>{rec.hero.nameTh}</CardTitle>
        </div>
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

        {advice && (
          <p className="whitespace-pre-wrap rounded-lg bg-bg-raised p-2 text-sm text-text">{advice}</p>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={ask}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border py-1.5 text-sm text-text hover:bg-bg-raised disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {busy ? "กำลังคิด..." : advice ? "ถามใหม่" : "ถามโค้ช AI"}
          </button>
          <button
            onClick={onPick}
            className="flex-1 rounded-lg bg-bg-raised py-1.5 text-sm font-medium text-text hover:bg-border"
          >
            เลือกฮีโร่นี้
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
