import { Plus, X } from "lucide-react";
import type { HeroSummary } from "@/types/hero";
import { cn } from "@/lib/utils";
import { MiniHero } from "./MiniHero";

export function BanRow({
  label,
  bans,
  active,
  max,
  onStart,
  onRemove,
}: {
  label: string;
  bans: { slug: string; hero?: HeroSummary }[];
  active: boolean;
  max: number;
  onStart: () => void;
  onRemove: (slug: string) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-text-faint">{label}</span>
      {bans.map((b) => (
        <span key={b.slug} className="inline-flex items-center gap-0.5 rounded-md bg-bg-raised pr-1">
          <MiniHero hero={b.hero} fallback={b.slug} className="bg-transparent pr-1" />
          <button type="button" aria-label="เอาแบนออก" onClick={() => onRemove(b.slug)} className="text-text-faint hover:text-loss">
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}
      <button
        type="button"
        disabled={bans.length >= max}
        onClick={onStart}
        aria-pressed={active}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs disabled:opacity-40",
          active ? "border-accent bg-accent/10 text-text" : "border-dashed border-border text-text-muted hover:text-text"
        )}
      >
        <Plus className="h-3.5 w-3.5" />
        แบน
      </button>
    </div>
  );
}
