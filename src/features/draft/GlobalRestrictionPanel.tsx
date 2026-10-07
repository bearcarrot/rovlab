import type { HeroSummary } from "@/types/hero";
import { MiniHero } from "./MiniHero";

// Shown from game 2 on when Global Ban Pick is active. The opponent's list is secondary: heroes the
// other team used remain available to us, so only "your team" is spelled out.
export function GlobalRestrictionPanel({
  mine,
  enemy,
}: {
  mine: HeroSummary[];
  enemy: HeroSummary[];
}) {
  if (mine.length === 0 && enemy.length === 0) return null;
  return (
    <section className="space-y-2 rounded-card border border-amber-400/40 bg-amber-400/5 p-3" aria-label="Global Ban Pick">
      <div>
        <h3 className="font-display text-sm font-semibold">Global Ban — ทีมคุณ</h3>
        <p className="text-xs text-text-faint">ฮีโร่เหล่านี้ถูกใช้โดยทีมคุณในเกมก่อนหน้า จึงไม่สามารถเลือกซ้ำได้</p>
      </div>
      {mine.length === 0 ? (
        <p className="text-xs text-text-faint">ทีมคุณยังไม่มีฮีโร่ที่ถูกห้ามซ้ำ</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {mine.map((h) => (
            <MiniHero key={h.slug} hero={h} />
          ))}
        </div>
      )}
      {enemy.length > 0 && (
        <details className="text-xs text-text-muted">
          <summary className="cursor-pointer">ทีมศัตรู ({enemy.length}) — ฮีโร่ที่ทีมคุณเลือกได้ยังคงเลือกได้ตามปกติ</summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {enemy.map((h) => (
              <MiniHero key={h.slug} hero={h} />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
