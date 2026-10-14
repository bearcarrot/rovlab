import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/components/ui/toast";
import { applyReaction, type Reaction } from "@/features/community/reactions";
import { reactToBuild } from "@/services/userBuilds";

// ถูกใจ / ไม่ถูกใจ ของ Community Build — optimistic update + revert เมื่อบันทึกไม่สำเร็จ (พฤติกรรมเดียวกับ Community Tier List)
export function useBuildReaction(b: { id: string; likes: number; dislikes: number; myValue: Reaction }) {
  const { user } = useAuth();
  const toast = useToast();
  const [s, setS] = useState({ likes: b.likes, dislikes: b.dislikes, value: b.myValue });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setS({ likes: b.likes, dislikes: b.dislikes, value: b.myValue });
  }, [b.id, b.likes, b.dislikes, b.myValue]);

  async function react(next: Reaction) {
    if (!user) {
      toast.info("เข้าสู่ระบบเพื่อกด ถูกใจ / ไม่ถูกใจ");
      return;
    }
    const prev = s;
    setS({ value: next, ...applyReaction({ likes: prev.likes, dislikes: prev.dislikes }, prev.value, next) });
    setPending(true);
    try {
      await reactToBuild(b.id, user.id, next);
    } catch {
      setS(prev); // revert
      toast.error("บันทึกการกดไม่สำเร็จ");
    } finally {
      setPending(false);
    }
  }

  return { likes: s.likes, dislikes: s.dislikes, value: s.value, pending, react };
}
