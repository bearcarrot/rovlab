// Pure helpers for avatar object keys on R2 (shared by supabase/functions/avatar and the node tests).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Keys always start with the caller's own user id, so one user can never write into another user's folder.
export const avatarKey = (userId: string, ts: number, ext: "jpg" | "png" | "webp") => `avatars/${userId}/${ts}.${ext}`;
export const avatarPublicUrl = (base: string, key: string) => `${base.replace(/\/+$/, "")}/${key}`;

// R2 key of the user's CURRENT avatar, or null when the URL is not ours, belongs to someone else, or is a Google/legacy URL.
// null means "never delete": Google photos and Supabase Storage objects are intentionally left alone.
export function ownAvatarKey(url: string | null | undefined, userId: string, base: string): string | null {
  if (!url || !UUID.test(userId)) return null;
  try {
    const u = new URL(url);
    if (u.origin !== new URL(base).origin) return null;
    const id = userId.toLowerCase();
    const m = new RegExp(`^/avatars/${id}/(\\d{10,15})\\.(jpg|png|webp)$`).exec(u.pathname);
    return m ? `avatars/${id}/${m[1]}.${m[2]}` : null;
  } catch {
    return null;
  }
}
