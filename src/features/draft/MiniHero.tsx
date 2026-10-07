import { HeroIcon } from "@/components/HeroIcon";
import type { HeroSummary } from "@/types/hero";
import { cn } from "@/lib/utils";

/** Small icon + name chip used for bans, global restrictions and read-only draft views. */
export function MiniHero({ hero, fallback, className }: { hero?: HeroSummary; fallback?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md bg-bg-raised py-0.5 pl-0.5 pr-2 text-xs", className)}>
      {hero ? (
        <HeroIcon icon={hero.icon} name={hero.name} className="h-6 w-6 rounded" />
      ) : (
        <span className="h-6 w-6 rounded bg-bg" />
      )}
      <span className="max-w-[7rem] truncate">{hero?.nameTh ?? fallback ?? "?"}</span>
    </span>
  );
}
