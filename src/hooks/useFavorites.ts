import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { addFavorite, getFavoriteHeroSlugs, removeFavorite } from "@/services/favorites";

// Centralizes favorite state so HeroCard/HeroDetail/Favorites page stay in sync.
// Signed-out or unconfigured-Supabase users get an empty read-only set — toggling
// is a no-op for them (UI should prompt sign-in instead of calling toggle).
export function useFavorites() {
  const { user, isConfigured } = useAuth();
  const [slugs, setSlugs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !isConfigured) {
      setSlugs(new Set());
      return;
    }
    setLoading(true);
    getFavoriteHeroSlugs(user.id)
      .then((list) => setSlugs(new Set(list)))
      .catch(() => setSlugs(new Set()))
      .finally(() => setLoading(false));
  }, [user, isConfigured]);

  const toggle = useCallback(
    async (heroSlug: string) => {
      if (!user) return;
      const isFav = slugs.has(heroSlug);
      // optimistic update
      setSlugs((prev) => {
        const next = new Set(prev);
        isFav ? next.delete(heroSlug) : next.add(heroSlug);
        return next;
      });
      try {
        if (isFav) await removeFavorite(user.id, heroSlug);
        else await addFavorite(user.id, heroSlug);
      } catch {
        // revert on failure
        setSlugs((prev) => {
          const next = new Set(prev);
          isFav ? next.add(heroSlug) : next.delete(heroSlug);
          return next;
        });
      }
    },
    [user, slugs]
  );

  return { favoriteSlugs: slugs, isFavorite: (slug: string) => slugs.has(slug), toggle, loading, canToggle: Boolean(user) };
}
