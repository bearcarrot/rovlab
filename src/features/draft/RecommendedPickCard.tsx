import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HeroIcon } from "@/components/HeroIcon";
import { CoachIcon } from "@/components/CoachIcon";
import { CoachText } from "@/components/CoachText";
import { askCoach } from "@/services/ai";
import type { Recommendation, RecommendTag } from "./analyzeTeam";

const TAG_LABEL: Record<RecommendTag, string> = {
  firstPick: "First Pick",
  counter: "ชนะทางศัตรู",
  synergy: "คอมโบ",
};

export function RecommendedPickCard({
  rec,
  onPick,
  coachContext,
}: {
  rec: Recommendation;
  onPick: () => void;
  // สร้าง context ให้ Coach AI (มีสกิลจริงของฮีโร่ที่เกี่ยวข้อง) — ดู coachContext.ts
  coachContext?: (rec: Recommendation) => unknown;
}) {
  const [advice, setAdvice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // คอมโบที่แอดมินยังไม่ได้กรอกคำอธิบาย: บอกตรงๆ แทนการเงียบ
  const missingCombos = rec.details.combos.filter((c) => !c.reason);
  const hasMechanism = rec.explain.length > 0 || missingCombos.length > 0;

  async function ask() {
    setBusy(true);
    setError("");
    try {
      const text = await askCoach(
        `ตอบเป็นข้อๆ ไม่เกิน 6 ข้อ สั้นกระชับ เรื่องการเลือก ${rec.hero.nameTh} ในดราฟต์นี้: ` +
          `1) ควรใช้สกิลไหนก่อน/หลัง และใช้ตอนไหน (อ้างชื่อสกิลจริงจาก heroes[].skills) ` +
          `2) ถ้ามี combos: อธิบายว่าสกิลของสองตัวเสริมกันยังไง (ใช้ข้อความ reason ถ้ามี และสกิลจริงประกอบ) ` +
          `3) ถ้ามี counters: direction=wins ให้บอกว่าศัตรูมีสกิลไหนที่ต้องหลบหรือตัดจังหวะ และเราใช้สกิลไหนสู้; ` +
          `direction=loses ให้บอกวิธีลดความเสียเปรียบ ` +
          `4) จุดที่ต้องระวัง ` +
          `ใช้เฉพาะข้อมูลที่ให้ ห้ามแต่งสกิลหรือตัวเลขที่ไม่มีในข้อมูล ถ้าข้อมูลสกิลไม่พอให้บอกตรงๆ`,
        coachContext
          ? coachContext(rec)
          : {
              hero: rec.hero.nameTh,
              // ไม่ส่ง Tier/Win Rate ถ้าฮีโร่ยังไม่มีสถิติจริง (ค่าเริ่มต้นเป็น Tier C ซึ่งเป็นค่าสมมติ)
              stat: rec.hero.stat.hasStats
                ? { tier: rec.hero.stat.tier, winRate: rec.hero.stat.winRate, patch: rec.hero.stat.patch }
                : null,
              risk: rec.risk,
              reasons: rec.reasons,
              warnings: rec.warnings,
              combos: rec.details.combos,
              counters: rec.details.counters,
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
                {rec.hero.nameTh} + {c.partner}: ยังไม่มีคำอธิบายกลไกในระบบ (ถามโค้ช AI ให้วิเคราะห์จากสกิลได้)
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

        {advice && (
          <div className="rounded-lg bg-bg-raised p-2">
            <CoachText text={advice} className="text-text" />
          </div>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={ask}
            disabled={busy}
            aria-busy={busy}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border py-1.5 text-sm text-text hover:bg-bg-raised disabled:cursor-wait disabled:opacity-80"
          >
            <CoachIcon busy={busy} className="h-3.5 w-3.5" />
            <span className={busy ? "animate-pulse" : undefined}>{busy ? "กำลังคิด..." : advice ? "ถามใหม่" : "ถามโค้ช AI"}</span>
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
