import { Star } from "lucide-react";
import type { CounterEntry } from "@/types/hero";
import { cn } from "@/lib/utils";

export const MATCHUP_STARS: Record<CounterEntry["strength"], { stars: number; label: string }> = {
  best: { stars: 3, label: "Best" },
  good: { stars: 2, label: "Good" },
  situational: { stars: 1, label: "Situation" },
};

export function StarRating({ stars, label, className }: { stars: number; label: string; className?: string }) {
  return (
    <span role="img" aria-label={`${label} ${stars} จาก 3 ดาว`} className={cn("inline-flex shrink-0 gap-0.5", className)}>
      {[1, 2, 3].map((i) => (
        <Star
          key={i}
          aria-hidden
          className={cn("h-3.5 w-3.5", i <= stars ? "fill-accent text-accent" : "text-text-faint/50")}
        />
      ))}
    </span>
  );
}

export function StarLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-faint sm:text-xs">
      {Object.values(MATCHUP_STARS).map((m) => (
        <li key={m.label} className="flex items-center gap-1.5">
          <StarRating stars={m.stars} label={m.label} className="[&_svg]:h-3 [&_svg]:w-3" />
          {m.label}
        </li>
      ))}
    </ul>
  );
}
