export type ContactAppId =
  | "line"
  | "facebook"
  | "discord"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "x"
  | "twitch"
  | "telegram";

export interface ContactLink {
  app: ContactAppId;
  url: string; // https URL on the app's official host (validated client-side and by a DB CHECK)
}

export interface Profile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  preferredRoles: string[];
  preferredHeroes: string[]; // hero ids (uuid), at most PROFILE_LIMITS.favoriteHeroes
  bio: string | null;
  gameName: string | null; // in-game name (RoV) — shown to signed-in users only
  contact: string | null; // legacy free-text contact: no longer shown or editable (replaced by contactLinks)
  contactLinks: ContactLink[]; // official social links — shown to signed-in users only
}

export interface PublicProfile extends Profile {
  createdAt: string;
}

// Mirrors the CHECK constraints on public.profiles.
export const PROFILE_LIMITS = {
  displayNameMin: 2,
  displayNameMax: 30,
  bio: 200,
  gameName: 40,
  contact: 80,
  favoriteHeroes: 3,
} as const;
