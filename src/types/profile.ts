export interface Profile {
  id: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  preferredRoles: string[];
  preferredHeroes: string[]; // hero slugs
}
