// Shared labels for system roles and Verified Creator categories.
// Verified status is independent of the system role: a verified creator is NOT an admin.

export type SystemRole = "member" | "moderator" | "admin" | "super_admin";
export type CreatorCategory = "streamer" | "pro_player" | "public_figure" | "community_creator";

export const SYSTEM_ROLES: { value: SystemRole; label: string }[] = [
  { value: "member", label: "สมาชิก" },
  { value: "moderator", label: "Moderator" },
  { value: "admin", label: "Admin" },
  { value: "super_admin", label: "Super Admin" },
];

export const ROLE_LABEL: Record<string, string> = Object.fromEntries(SYSTEM_ROLES.map((r) => [r.value, r.label]));

export const CREATOR_CATEGORIES: { value: CreatorCategory; label: string }[] = [
  { value: "streamer", label: "Streamer / YouTuber" },
  { value: "pro_player", label: "Pro Player / Esports Player" },
  { value: "public_figure", label: "Public Figure" },
  { value: "community_creator", label: "Community Creator" },
];

export const creatorLabel = (category: string | null | undefined): string =>
  CREATOR_CATEGORIES.find((c) => c.value === category)?.label ?? "Verified Creator";
