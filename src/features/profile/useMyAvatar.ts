import { useEffect } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { getProfile } from "@/services/profile";
import { resetMyAvatar, setMyAvatar, useMyAvatarState } from "@/lib/myAvatarStore";

// Loads the signed-in user's avatar_url once per user. Signed out / not configured / no row => null.
export function useMyAvatar(): string | null {
  const { user, isConfigured } = useAuth();
  const url = useMyAvatarState();
  const userId = user?.id;

  useEffect(() => {
    resetMyAvatar(); // never show the previous user's photo while the next one loads
    if (!isConfigured || !userId) return;
    let cancelled = false;
    getProfile(userId)
      .then((p) => {
        if (!cancelled) setMyAvatar(p?.avatarUrl ?? null);
      })
      .catch(() => {
        if (!cancelled) setMyAvatar(null); // keep the default icon if the profile can't be read
      });
    return () => {
      cancelled = true;
    };
  }, [userId, isConfigured]);

  return url;
}
