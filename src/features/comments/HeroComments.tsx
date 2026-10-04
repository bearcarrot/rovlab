import { CommentSection } from "@/features/community/CommentSection";

// Kept as the entry point used by HeroDetail; the implementation moved to features/community
// (replies, like/dislike, @mentions, notifications, profanity filter, reports, ...).
export function HeroComments({ heroSlug }: { heroSlug: string }) {
  return <CommentSection heroSlug={heroSlug} />;
}
