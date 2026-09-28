export interface Profile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  preferredRoles: string[];
  preferredHeroes: string[]; // hero slugs
}
