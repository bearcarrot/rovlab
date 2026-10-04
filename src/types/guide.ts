export type GuideDifficulty = "easy" | "medium" | "hard";

export interface GuideCategory {
  slug: string;
  nameTh: string;
}

export interface GuideSummary {
  id: string;
  slug: string;
  title: string;
  categorySlug: string; // "" = ยังไม่ได้จัดหมวด
  difficulty: GuideDifficulty | null; // null = แอดมินยังไม่ระบุ
  readingMinutes: number;
  excerpt: string;
}

export interface GuideDetail extends GuideSummary {
  content: string[]; // paragraphs
  heroRefs: string[]; // hero slugs
  heroNames?: Record<string, string>; // slug → ชื่อฮีโร่ (ข้อมูลจริงจาก DB; mock ไม่มีจะใช้ MOCK_HEROES แทน)
  isMock: boolean;
}
