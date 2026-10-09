import { Plus, X } from "lucide-react";
import type { HeroSummary } from "@/types/hero";
import { cn } from "@/lib/utils";
import { useState } from "react";

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
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover"
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

export function TeamSlots({
  label,
  team,
  activeIndex,
  onSelectSlot,
  onClearSlot,
}: {
  label: string;
  team: (HeroSummary | null)[];
  activeIndex: number | null;
  onSelectSlot: (i: number) => void;
  onClearSlot: (i: number) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-text-faint">{label}</p>

      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        {team.map((hero, i) => (
          <button
            key={i}
            onClick={() => onSelectSlot(i)}
            title={hero?.nameTh}
            aria-label={hero?.nameTh}
            className={cn(
              "relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-lg border text-center",
              activeIndex === i
                ? "border-accent bg-accent/10"
                : "border-border bg-bg-surface",
              !hero && "border-dashed"
            )}
          >
            {hero ? (
              <>
                <HeroSlotIcon hero={hero} />

                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearSlot(i);
                  }}
                  className="absolute right-0.5 top-0.5 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-loss text-white"
                >
                  <X className="h-2.5 w-2.5" />
                </span>
              </>
            ) : (
              <Plus className="h-4 w-4 text-text-faint sm:h-5 sm:w-5" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
