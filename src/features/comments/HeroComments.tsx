import { useSearchParams } from "react-router-dom";
import { CommentSection } from "@/features/community/CommentSection";
import { LazySection } from "@/components/LazySection";

// Kept as the entry point used by HeroDetail; the implementation moved to features/community
// (replies, like/dislike, @mentions, notifications, profanity filter, reports, ...).
// ท้ายหน้า: โหลดความคิดเห็น (และ RPC สิทธิ์แอดมิน/มอดเดอเรเตอร์) เมื่อเลื่อนมาใกล้เท่านั้น; ลิงก์ ?c=<id> เมานต์ทันที
export function HeroComments({ heroSlug }: { heroSlug: string }) {
  const [params] = useSearchParams();
  return (
    <LazySection eager={params.has("c")} minHeight={240}>
      <CommentSection heroSlug={heroSlug} />
    </LazySection>
  );
}
