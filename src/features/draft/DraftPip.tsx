import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Search, X } from "lucide-react";
import { heroMatchesQuery } from "@/lib/heroSearch";
import { cn } from "@/lib/utils";
import type { HeroSummary } from "@/types/hero";
import type { Recommendation } from "./analyzeTeam";
import type { TeamKey } from "./series";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
const TEAMS: { key: TeamKey; label: string }[] = [
  { key: "mine", label: "ทีมของคุณ" },
  { key: "enemy", label: "ทีมศัตรู" },
];

function Icon({ hero }: { hero: HeroSummary }) {
  return hero.icon ? (
    <img src={hero.icon} alt="" draggable={false} referrerPolicy="no-referrer" className="h-full w-full object-cover" />
  ) : (
    <span className="font-display text-sm text-text-faint">{hero.name.slice(0, 2).toUpperCase()}</span>
  );
}

// Everything here is props from DraftAssistant: the PiP window has no state of its own except the search box,
// so selecting in either window goes through the same useDraftSession callbacks and both re-render together.
export function DraftPip({
  win,
  teams,
  active,
  pool,
  recs,
  onSelectSlot,
  onClearSlot,
  onPick,
  onPickRec,
  onClose,
}: {
  win: Window;
  teams: Record<TeamKey, (HeroSummary | null)[]>;
  active: { team: TeamKey; kind: "pick"; index: number } | { team: TeamKey; kind: "ban" } | null;
  /** The page's activePool: already excludes heroes taken/banned/Global-BP-restricted, so duplicate rules are the page's. */
  pool: HeroSummary[];
  recs: Recommendation[];
  onSelectSlot: (team: TeamKey, index: number) => void;
  onClearSlot: (team: TeamKey, index: number) => void;
  onPick: (hero: HeroSummary) => void;
  onPickRec: (hero: HeroSummary) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => pool.filter((h) => heroMatchesQuery(h, query)), [pool, query]);

  return createPortal(
    <div className="flex h-screen flex-col gap-2 overflow-hidden bg-bg p-2 text-text">
      <header className="flex items-center gap-2">
        <span className="font-display text-sm font-semibold text-accent">RoV LAB</span>
        <span className="min-w-0 flex-1 truncate text-xs text-text-muted">Draft Assistant</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิดหน้าต่างลอย"
          className={cn("flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-muted hover:text-text", FOCUS)}
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {TEAMS.map(({ key, label }) => (
        <section key={key} aria-label={label}>
          <p className="mb-1 text-[11px] font-medium text-text-faint">{label}</p>
          <div className="grid grid-cols-5 gap-1.5">
            {teams[key].map((hero, i) => {
              const isActive = active?.kind === "pick" && active.team === key && active.index === i;
              return (
                <div
                  key={i}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-lg border bg-bg-surface",
                    isActive ? "border-accent bg-accent/10" : "border-border",
                    !hero && "border-dashed"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectSlot(key, i)}
                    aria-label={hero ? `${hero.nameTh} (เปลี่ยน)` : `ช่อง ${i + 1} ว่าง`}
                    aria-pressed={isActive}
                    className={cn("absolute inset-0 flex items-center justify-center", FOCUS)}
                  >
                    {hero ? <Icon hero={hero} /> : <Plus className="h-4 w-4 text-text-faint" />}
                  </button>
                  {hero && (
                    <button
                      type="button"
                      onClick={() => onClearSlot(key, i)}
                      aria-label={`เอา ${hero.nameTh} ออก`}
                      className={cn("absolute right-0.5 top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-loss text-white", FOCUS)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {recs.length > 0 && (
        <section aria-label="แนะนำตัวถัดไป">
          <p className="mb-1 text-[11px] font-medium text-text-faint">แนะนำตัวถัดไป (ใส่ช่องว่างของทีมคุณ)</p>
          <div className="flex gap-1.5">
            {recs.map((r) => (
              <button
                key={r.hero.id}
                type="button"
                onClick={() => onPickRec(r.hero)}
                title={r.hero.nameTh}
                aria-label={`เลือก ${r.hero.nameTh} ตามที่ระบบแนะนำ`}
                className={cn("flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border border-border bg-bg-raised hover:border-accent/60", FOCUS)}
              >
                <Icon hero={r.hero} />
              </button>
            ))}
          </div>
        </section>
      )}

      {!active ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-text-muted">แตะช่องด้านบนเพื่อเลือกฮีโร่</p>
      ) : (
        <>
          <label className="flex items-center gap-2 rounded-lg border border-border bg-bg-surface px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาฮีโร่"
              aria-label="ค้นหาฮีโร่"
              className="w-full bg-transparent text-sm outline-none placeholder:text-text-faint"
            />
          </label>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {shown.length === 0 ? (
              <p className="text-sm text-text-faint">ไม่พบฮีโร่</p>
            ) : (
              <div className="grid grid-cols-5 gap-1.5">
                {shown.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => onPick(h)}
                    title={h.nameTh}
                    aria-label={h.nameTh}
                    className={cn("aspect-square overflow-hidden rounded-lg border border-border bg-bg-raised hover:border-accent/60", FOCUS)}
                  >
                    <Icon hero={h} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>,
    win.document.body
  );
}
