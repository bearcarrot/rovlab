import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, GripVertical, Plus, X } from "lucide-react";
import type { HeroSummary } from "@/types/hero";
import { cn } from "@/lib/utils";

function HeroSlotIcon({ hero }: { hero: HeroSummary }) {
  const [imageError, setImageError] = useState(false);

  // ไอคอนเต็มช่อง (ช่องเป็นสี่เหลี่ยมจัตุรัสไล่ตามความกว้างจอ) ไม่แสดงชื่อในช่อง
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-bg-raised">
      {hero.icon && !imageError ? (
        <img
          src={hero.icon}
          alt={hero.nameTh}
          loading="lazy"
          draggable={false}
          referrerPolicy="no-referrer"
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <span className="text-sm font-display text-text-faint sm:text-base">
          {hero.name.slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  );
}

interface Drag {
  from: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  moving: boolean;
  over: number | null;
}

const DRAG_THRESHOLD_PX = 4;

// ช่องฮีโร่ 5 ช่องของทีมเดียว: ลากที่จับ (มุมซ้ายล่าง) ไปวางบนอีกช่องของทีมเดียวกันเพื่อสลับ/ย้ายเข้าช่องว่าง
// ใช้ Pointer Events (เมาส์/ทัช/ปากกาเหมือนกัน) และให้เฉพาะที่จับเท่านั้นที่ touch-action: none จึงเลื่อนหน้าได้ตามปกติ
// ทางเลือกที่ไม่ต้องลาก: ปุ่มลูกศรซ้าย/ขวา หรือกดลูกศรซ้าย/ขวาเมื่อโฟกัสที่ที่จับ
export function TeamSlots({
  label,
  teamId,
  team,
  activeIndex,
  onSelectSlot,
  onClearSlot,
  onMove,
}: {
  label: string;
  /** ใช้แยกเป้าหมายการวาง: ลากข้ามทีมไม่ได้ */
  teamId: string;
  team: (HeroSummary | null)[];
  activeIndex: number | null;
  onSelectSlot: (i: number) => void;
  onClearSlot: (i: number) => void;
  onMove: (from: number, to: number) => void;
}) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const [notice, setNotice] = useState("");
  const handleRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const overAt = useCallback(
    (x: number, y: number, from: number): number | null => {
      const el = document.elementFromPoint(x, y)?.closest<HTMLElement>(`[data-slot-team="${teamId}"]`);
      if (!el) return null;
      const n = Number(el.dataset.slotIndex);
      return Number.isInteger(n) && n !== from ? n : null;
    },
    [teamId]
  );

  const dragging = drag?.moving === true;
  useEffect(() => {
    if (!dragging) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrag(null);
        setNotice("ยกเลิกการลากแล้ว");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dragging]);

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>, i: number) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ from: i, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moving: false, over: null });
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const { clientX: x, clientY: y } = e;
    setDrag((d) => {
      if (!d) return d;
      const moving = d.moving || Math.hypot(x - d.startX, y - d.startY) > DRAG_THRESHOLD_PX;
      return { ...d, x, y, moving, over: moving ? overAt(x, y, d.from) : null };
    });
  }

  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const d = drag;
    setDrag(null);
    if (!d || !d.moving) return;
    const over = overAt(e.clientX, e.clientY, d.from);
    if (over === null) {
      setNotice("ยกเลิกการลากแล้ว");
      return;
    }
    onMove(d.from, over);
    setNotice(`ย้ายฮีโร่ไปช่อง ${over + 1} แล้ว`);
  }

  function onPointerCancel() {
    if (drag?.moving) setNotice("ยกเลิกการลากแล้ว");
    setDrag(null);
  }

  function onHandleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, i: number) {
    const to = e.key === "ArrowLeft" ? i - 1 : e.key === "ArrowRight" ? i + 1 : null;
    if (to === null || to < 0 || to >= team.length) return;
    e.preventDefault();
    onMove(i, to);
    setNotice(`ย้ายฮีโร่ไปช่อง ${to + 1} แล้ว`);
    requestAnimationFrame(() => handleRefs.current[to]?.focus());
  }

  const filledCount = team.filter(Boolean).length;
  const firstFilled = team.findIndex(Boolean);
  const activeHero = activeIndex !== null ? team[activeIndex] ?? null : null;
  const ghostHero = dragging && drag ? team[drag.from] : null;

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-text-faint">{label}</p>

      <div data-tour={`team-${teamId}`} className="grid grid-cols-5 gap-2 sm:gap-3">
        {team.map((hero, i) => {
          const isSource = dragging && drag?.from === i;
          const isOver = dragging && drag?.over === i;
          return (
            <div
              key={i}
              data-slot-team={teamId}
              data-slot-index={i}
              className={cn(
                "relative aspect-square overflow-hidden rounded-lg border text-center transition-opacity",
                activeIndex === i ? "border-accent bg-accent/10" : "border-border bg-bg-surface",
                !hero && "border-dashed",
                dragging && !isSource && "border-dashed border-accent/70",
                isSource && "opacity-40",
                isOver && "bg-accent/20 ring-2 ring-accent"
              )}
            >
              <button
                type="button"
                onClick={() => onSelectSlot(i)}
                title={hero?.nameTh}
                aria-label={hero ? hero.nameTh : `ช่อง ${i + 1} ว่าง`}
                className="absolute inset-0 flex items-center justify-center"
              >
                {hero ? <HeroSlotIcon hero={hero} /> : <Plus className="h-4 w-4 text-text-faint sm:h-5 sm:w-5" />}
              </button>

              {hero && (
                <>
                  <button
                    type="button"
                    onClick={() => onClearSlot(i)}
                    aria-label={`เอา ${hero.nameTh} ออก`}
                    className="absolute right-0.5 top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-loss text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    data-tour={i === firstFilled ? "drag-handle" : undefined}
                    ref={(el) => {
                      handleRefs.current[i] = el;
                    }}
                    title="ลากเพื่อสลับตำแหน่ง"
                    aria-label={`ลากเพื่อสลับตำแหน่ง ${hero.nameTh} หรือกดลูกศรซ้าย/ขวาเพื่อย้าย`}
                    onPointerDown={(e) => onPointerDown(e, i)}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerCancel}
                    onKeyDown={(e) => onHandleKeyDown(e, i)}
                    className="absolute bottom-0.5 left-0.5 z-10 flex h-6 w-6 cursor-grab touch-none select-none items-center justify-center rounded bg-black/60 text-white active:cursor-grabbing"
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {filledCount > 0 && (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-text-faint">
          <p className="min-w-0 flex-1">ลากฮีโร่เพื่อสลับตำแหน่ง</p>
          {activeHero && activeIndex !== null && (
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                disabled={activeIndex === 0}
                onClick={() => onMove(activeIndex, activeIndex - 1)}
                aria-label="ย้ายฮีโร่ที่เลือกไปทางซ้าย"
                className="flex h-7 w-7 items-center justify-center rounded border border-border text-text-muted hover:text-text disabled:opacity-40"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={activeIndex === team.length - 1}
                onClick={() => onMove(activeIndex, activeIndex + 1)}
                aria-label="ย้ายฮีโร่ที่เลือกไปทางขวา"
                className="flex h-7 w-7 items-center justify-center rounded border border-border text-text-muted hover:text-text disabled:opacity-40"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {notice}
      </p>

      {ghostHero && drag && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[100] h-14 w-14 overflow-hidden rounded-lg border-2 border-accent opacity-90 shadow-card"
          style={{ left: drag.x - 28, top: drag.y - 28 }}
        >
          <HeroSlotIcon hero={ghostHero} />
        </div>
      )}
    </div>
  );
}
