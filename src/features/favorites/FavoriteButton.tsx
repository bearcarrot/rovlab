import { Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFavorites } from "@/hooks/useFavorites";
import { cn } from "@/lib/utils";

export function FavoriteButton({ heroSlug, className }: { heroSlug: string; className?: string }) {
  const { isFavorite, toggle, canToggle } = useFavorites();
  const navigate = useNavigate();
  const active = isFavorite(heroSlug);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!canToggle) {
          navigate("/login");
          return;
        }
        toggle(heroSlug);
      }}
      aria-label={active ? "เอาออกจากรายการโปรด" : "เพิ่มในรายการโปรด"}
      aria-pressed={active}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-full bg-bg/80 backdrop-blur transition-colors",
        active ? "text-loss" : "text-text-faint hover:text-text",
        className
      )}
    >
      <Heart className="h-4 w-4" fill={active ? "currentColor" : "none"} strokeWidth={2} />
    </button>
  );
}
