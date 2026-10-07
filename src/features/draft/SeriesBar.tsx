import { useMemo } from "react";
import { Redo2, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/features/community/confirm";
import type { DraftSessionApi } from "./useDraftSession";
import { droppedGameCount, findRestrictionConflicts, isGameEmpty, type Game7Rule, type SeriesFormat } from "./series";

export const FORMAT_LABEL: Record<SeriesFormat, string> = { single: "Single Game", bo3: "BO3", bo5: "BO5", bo7: "BO7" };

const selectCls = "rounded-lg border border-border bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-accent/60";
const iconBtn =
  "flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-muted hover:text-text disabled:opacity-40";

// Compact series controls placed above the existing two-team layout (format, Global BP, game tabs, undo/reset).
export function SeriesBar({ ds, heroName }: { ds: DraftSessionApi; heroName: (slug: string) => string }) {
  const { series, gameNumber } = ds;
  const isSeries = series.format !== "single";
  const conflicts = useMemo(() => findRestrictionConflicts(series), [series]);

  async function onFormat(next: SeriesFormat) {
    const dropped = droppedGameCount(series, next);
    if (
      dropped > 0 &&
      !(await confirmDialog({
        title: `เปลี่ยนเป็น ${FORMAT_LABEL[next]}?`,
        message: `Draft ของ ${dropped} เกมที่เกินจำนวนจะถูกลบ (ย้อนกลับได้ด้วยปุ่มเลิกทำ)`,
        confirmLabel: "เปลี่ยนรูปแบบ",
        danger: true,
      }))
    )
      return;
    ds.setFormat(next);
  }

  async function onResetSeries() {
    const ok = await confirmDialog({
      title: "ล้างทุกเกมในซีรีส์นี้?",
      message: "Pick และ Ban ของทุกเกมจะถูกล้าง (ย้อนกลับได้ด้วยปุ่มเลิกทำ)",
      confirmLabel: "ล้างซีรีส์",
      danger: true,
    });
    if (ok) ds.resetSeries();
  }

  return (
    <section className="space-y-2" aria-label="ตั้งค่าซีรีส์">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="draft-format">รูปแบบ Draft</label>
        <select id="draft-format" value={series.format} onChange={(e) => void onFormat(e.target.value as SeriesFormat)} className={selectCls}>
          {(Object.keys(FORMAT_LABEL) as SeriesFormat[]).map((f) => (
            <option key={f} value={f}>{FORMAT_LABEL[f]}</option>
          ))}
        </select>

        {isSeries && (
          <button
            type="button"
            role="switch"
            aria-checked={series.globalBanPick}
            onClick={() => ds.setGlobal(!series.globalBanPick)}
            className={cn(
              "rounded-lg border px-2.5 py-1.5 text-sm",
              series.globalBanPick ? "border-accent bg-accent/10 text-text" : "border-border text-text-muted"
            )}
          >
            Global BP {series.globalBanPick ? "ON" : "OFF"}
          </button>
        )}

        {series.format === "bo7" && series.globalBanPick && (
          <label className="flex items-center gap-1.5 text-xs text-text-faint">
            เกม 7
            <select value={series.game7Rule} onChange={(e) => ds.setGame7(e.target.value as Game7Rule)} className={selectCls}>
              <option value="normal">Normal Ban Pick</option>
              <option value="global">Global Ban Pick</option>
              <option value="ultimate" disabled>Ultimate Battle (เร็วๆ นี้)</option>
            </select>
          </label>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" className={iconBtn} disabled={!ds.canUndo} onClick={ds.undo} aria-label="เลิกทำ">
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button type="button" className={iconBtn} disabled={!ds.canRedo} onClick={ds.redo} aria-label="ทำซ้ำ">
            <Redo2 className="h-3.5 w-3.5" />
          </button>
          <button type="button" className={iconBtn} onClick={ds.resetGame}>
            <RotateCcw className="h-3.5 w-3.5" />
            {isSeries ? "ล้างเกมนี้" : "ล้าง"}
          </button>
          {isSeries && (
            <button type="button" className={cn(iconBtn, "hover:text-loss")} onClick={() => void onResetSeries()}>
              <Trash2 className="h-3.5 w-3.5" />
              ล้างซีรีส์
            </button>
          )}
        </div>
      </div>

      {isSeries && (
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="เกมในซีรีส์">
          {series.games.map((g) => (
            <button
              key={g.gameNumber}
              type="button"
              role="tab"
              aria-selected={g.gameNumber === gameNumber}
              onClick={() => ds.setGame(g.gameNumber)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm",
                g.gameNumber === gameNumber ? "border-accent bg-accent text-accent-fg" : "border-border text-text-muted hover:text-text"
              )}
            >
              Game {g.gameNumber}
              {!isGameEmpty(g) && g.gameNumber !== gameNumber && <span aria-hidden className="ml-1 text-accent">●</span>}
            </button>
          ))}
        </div>
      )}

      {conflicts.length > 0 && (
        <div role="alert" className="rounded-lg border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-xs text-amber-300">
          <p className="font-medium">มีการเลือกฮีโร่ซ้ำที่ผิดกฎ Global BP (เพราะแก้เกมก่อนหน้า)</p>
          <ul className="mt-1 list-disc pl-4">
            {conflicts.slice(0, 3).map((c) => (
              <li key={`${c.gameNumber}-${c.team}-${c.hero}`}>
                เกม {c.gameNumber}: {c.team === "mine" ? "ทีมคุณ" : "ทีมศัตรู"}เลือก {heroName(c.hero)} ซ้ำ
              </li>
            ))}
          </ul>
          {conflicts.length > 3 && <p className="mt-1">และอีก {conflicts.length - 3} รายการ</p>}
        </div>
      )}
    </section>
  );
}
