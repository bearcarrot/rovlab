import { HeroIcon } from "@/components/HeroIcon";
import type { HeroSummary } from "@/types/hero";
import { cn } from "@/lib/utils";

/** Small icon + name chip used for bans, global restrictions and read-only draft views. */
export function MiniHero({
  hero,
  fallback,
  className,
  showName = true,
  grayscale = false,
  size = "sm",
}: {
  hero?: HeroSummary;
  fallback?: string;
  className?: string;
  /** false = icon only (name stays as tooltip / accessible label) */
  showName?: boolean;
  /** true = desaturate the icon (used for banned heroes) */
  grayscale?: boolean;
  /** sm = 24px (default), md = 32px (icon-only chips are easier to recognise when larger) */
  size?: "sm" | "md";
}) {
  const name = hero?.nameTh ?? fallback ?? "?";
  const box = size === "md" ? "h-8 w-8" : "h-6 w-6";
  return (
    <span
      title={name}
      aria-label={showName ? undefined : name}
      className={cn("inline-flex items-center gap-1.5 rounded-md bg-bg-raised py-0.5 pl-0.5 text-xs", showName ? "pr-2" : "pr-0.5", className)}
    >
      {hero ? (
        <HeroIcon icon={hero.icon} name={hero.name} className={cn(box, "rounded", grayscale && "grayscale")} />
      ) : (
        <span className={cn(box, "rounded bg-bg", grayscale && "grayscale")} />
      )}
      {showName && <span className="max-w-[7rem] truncate">{name}</span>}
    </span>
  );
}
