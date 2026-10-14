import { ReactionButtons } from "@/features/community/ReactionButtons";
import type { UserBuild } from "@/services/userBuilds";
import { useBuildReaction } from "./useBuildReaction";

// ปุ่ม ถูกใจ / ไม่ถูกใจ ใช้ร่วมกันระหว่างการ์ด Community Build และหน้ารายละเอียดบิลด์
export function BuildReactions({ b }: { b: Pick<UserBuild, "id" | "likes" | "dislikes" | "myValue"> }) {
  const r = useBuildReaction(b);
  return <ReactionButtons likes={r.likes} dislikes={r.dislikes} value={r.value} disabled={r.pending} onChange={(n) => void r.react(n)} />;
}
