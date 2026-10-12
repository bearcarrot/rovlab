import { HeroIcon } from "@/components/HeroIcon";
import type { HeroSummary } from "@/types/hero";

/** Heroes one team picked in a single earlier game (one row in the panel). */
export type RestrictedByGame = { gameNumber: number; heroes: HeroSummary[] };

// ไอคอนขยายตามความกว้างแถว (grid 5 คอลัมน์, aspect-square) แทนชิป 32px ชิดซ้าย ไม่เหลือที่ว่างขวาบนมือถือ
// max-w-72 จำกัดไม่ให้ใหญ่เกินไปบนจอกว้าง; เกมที่มีฮีโร่น้อยกว่า 5 ตัวไอคอนยังขนาดเท่าเดิม
function GameRows({ rows }: { rows: RestrictedByGame[] }) {
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.gameNumber} className="flex items-center gap-2">
          <span className="w-12 shrink-0 text-xs font-medium text-text-muted">เกม {r.gameNumber}</span>
          {r.heroes.length === 0 ? (
            <span className="text-xs text-text-faint">ยังไม่ได้เลือก</span>
          ) : (
            <div className="grid max-w-72 flex-1 grid-cols-5 gap-1.5">
              {r.heroes.map((h) => (
                <div key={h.slug} title={h.nameTh}>
                  <HeroIcon icon={h.icon} name={h.name} className="aspect-square h-auto w-full rounded-md" />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const hasHeroes = (rows: RestrictedByGame[]) => rows.some((r) => r.heroes.length > 0);

// Shown from game 2 on when Global Ban Pick is active. One row per earlier game, icons only (name = tooltip).
// The opponent's list is secondary: heroes the other team used remain available to us, so only "your team" is spelled out.
export function GlobalRestrictionPanel({
  mine,
  enemy,
}: {
  mine: RestrictedByGame[];
  enemy: RestrictedByGame[];
}) {
  if (!hasHeroes(mine) && !hasHeroes(enemy)) return null;
  return (
    <section className="space-y-2 rounded-card border border-amber-400/40 bg-amber-400/5 p-3" aria-label="Global Ban Pick">
      <div>
        <h3 className="font-display text-sm font-semibold">Global Ban — ทีมคุณ</h3>
        <p className="text-xs text-text-faint">ฮีโร่เหล่านี้ถูกใช้โดยทีมคุณในเกมก่อนหน้า จึงไม่สามารถเลือกซ้ำได้</p>
      </div>
      {hasHeroes(mine) ? (
        <GameRows rows={mine} />
      ) : (
        <p className="text-xs text-text-faint">ทีมคุณยังไม่มีฮีโร่ที่ถูกห้ามซ้ำ</p>
      )}
      {hasHeroes(enemy) && (
        <details className="text-xs text-text-muted">
          <summary className="cursor-pointer">
            ทีมศัตรู ({enemy.reduce((n, r) => n + r.heroes.length, 0)}) — ฮีโร่ที่ทีมคุณเลือกได้ยังคงเลือกได้ตามปกติ
          </summary>
          <div className="mt-2">
            <GameRows rows={enemy} />
          </div>
        </details>
      )}
    </section>
  );
}
