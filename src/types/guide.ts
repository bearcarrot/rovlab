export type GuideDifficulty = "easy" | "medium" | "hard";

export interface GuideCategory {
  slug: string;
  nameTh: string;
}

export interface GuideSummary {
  id: string;
  slug: string;
  title: string;
  categorySlug: string;
  difficulty: GuideDifficulty;
  readingMinutes: number;
  excerpt: string;
}

export interface GuideDetail extends GuideSummary {
  content: string[]; // paragraphs
  heroRefs: string[]; // hero slugs
  isMock: boolean;
}
