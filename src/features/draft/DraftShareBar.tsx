import { useCallback, useEffect, useState } from "react";
import { ShareImageButtons } from "@/features/share/ShareImageButtons";
import { useShareImage } from "@/features/share/useShareImage";
import {
  draftAssistantTemplate,
  formatGeneratedDate,
  makeFilename,
  preloadImages,
  type DraftImageData,
  type ShareHero,
} from "@/lib/share-image";
import type { HeroSummary } from "@/types/hero";
import type { DraftMode, Recommendation, TeamAnalysis } from "./analyzeTeam";

const MAX = 10; // เพดานแถบเดียวกับ TeamMeters

const METERS: { key: keyof TeamAnalysis; label: string }[] = [
  { key: "frontline", label: "แนวหน้า" },
  { key: "cc", label: "Crowd Control" },
  { key: "mobility", label: "ความคล่องตัว" },
  { key: "sustain", label: "การคงทน" },
  { key: "earlyGame", label: "ช่วงต้นเกม" },
  { key: "lateGame", label: "ช่วงปลายเกม" },
];

const MODE_LABEL: Record<DraftMode, string> = {
  firstPick: "โหมด First Pick",
  counter: "โหมดชนะทางศัตรู",
  composition: "โหมดเติมทีม",
};

const toShare = (h: HeroSummary | null): ShareHero | null => (h ? { id: h.id, name: h.name, icon: h.icon } : null);

export function DraftShareBar({
  myTeam,
  enemyTeam,
  recs,
  analysis,
  mode,
  coachText,
}: {
  myTeam: (HeroSummary | null)[];
  enemyTeam: (HeroSummary | null)[];
  /** แนะนำตัวถัดไป (ว่างเมื่อทีมครบ 5 แล้ว ให้ตรงกับที่แสดงบนหน้า) */
  recs: Recommendation[];
  analysis: TeamAnalysis;
  mode: DraftMode;
  /** คำตอบ AI Coach ล่าสุดบนหน้า (ว่าง = ยังไม่ได้ถาม) */
  coachText: string;
}) {
  // AI Coach บนรูปปิดเป็นค่าเริ่มต้น ผู้ใช้ต้องเปิดเอง
  const [includeAi, setIncludeAi] = useState(false);
  const hasCoach = coachText.trim().length > 0;
  useEffect(() => {
    if (!hasCoach) setIncludeAi(false);
  }, [hasCoach]);

  const filled = analysis.filledSlots + enemyTeam.filter(Boolean).length;

  const build = useCallback(() => {
    const data: DraftImageData = {
      mine: myTeam.map(toShare),
      enemy: enemyTeam.map(toShare),
      recs: recs.slice(0, 5).map((r) => ({ hero: toShare(r.hero)!, stars: r.stars, tags: r.tags })),
      meters: METERS.map((m) => ({ label: m.label, value: Number(analysis[m.key]) / MAX })),
      damage: { physical: analysis.physicalDamage, magic: analysis.magicDamage },
      modeLabel: MODE_LABEL[mode],
      aiCoach: includeAi && hasCoach ? coachText : null,
      generatedDate: formatGeneratedDate(),
    };
    return { data, filename: makeFilename("rovlab-draft"), title: "RoV LAB Draft Assistant" };
  }, [myTeam, enemyTeam, recs, analysis, mode, includeAi, hasCoach, coachText]);

  const share = useShareImage(draftAssistantTemplate, build);

  useEffect(() => {
    const icons = [...myTeam, ...enemyTeam, ...recs.slice(0, 5).map((r) => r.hero)].map((h) => h?.icon ?? "");
    preloadImages(icons);
  }, [myTeam, enemyTeam, recs]);

  return (
    <div className="space-y-2">
      <ShareImageButtons
        busy={share.busy}
        pending={share.pending}
        status={share.status}
        disabled={filled === 0}
        onShare={share.share}
        onDownload={share.download}
      />
      {hasCoach && (
        <label className="flex items-center gap-2 text-xs text-text-muted">
          <input type="checkbox" checked={includeAi} onChange={(e) => setIncludeAi(e.target.checked)} className="h-4 w-4 accent-[#E8A33D]" />
          ใส่ผล AI Coach ในรูป
        </label>
      )}
      <p className="text-[11px] text-text-faint">รูปจะมีป้าย HEURISTIC เสมอ เพราะเป็นการประเมินเบื้องต้น ไม่ใช่ข้อมูลทางการของเกม</p>
    </div>
  );
}
