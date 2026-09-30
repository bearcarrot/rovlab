export interface HeroComment {
  id: string;
  userId: string;
  body: string;
  createdAt: string; // ISO timestamp
  authorName: string;
  avatarUrl: string | null;
}
