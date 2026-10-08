import { HeroIcon } from "@/components/HeroIcon";
import type { HeroSummary } from "@/types/hero";
import { cn } from "@/lib/utils";

/** Small icon + name chip used for bans, global restrictions and read-only draft views. */
export function MiniHero({
  hero,
  fallback,
  className,
  showName = true,
}: {
  hero?: HeroSummary;
  fallback?: string;
  className?: string;
  /** false = icon only (name stays as tooltip / accessible label) */
  showName?: boolean;
}) {
  const name = hero?.nameTh ?? fallback ?? "?";
  return (
    <span
      title={name}
      aria-label={showName ? undefined : name}
      className={cn("inline-flex items-center gap-1.5 rounded-md bg-bg-raised py-0.5 pl-0.5 text-xs", showName ? "pr-2" : "pr-0.5", className)}
    >
      {hero ? (
        <HeroIcon icon={hero.icon} name={hero.name} className="h-6 w-6 rounded" />
      ) : (
        <span className="h-6 w-6 rounded bg-bg" />
      )}
      {showName && <span className="max-w-[7rem] truncate">{name}</span>}
    </span>
  );
}
