import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/components/ui/toast";
import { applyReaction, type Reaction } from "@/features/community/reactions";
import { reactToCombo } from "@/services/combos";

// ถูกใจ / ไม่ถูกใจ ของ Combo — optimistic update + revert เมื่อบันทึกไม่สำเร็จ (เหมือน useBuildReaction)
export function useComboReaction(c: { id: string; likes: number; dislikes: number; myValue: Reaction }) {
  const { user } = useAuth();
  const toast = useToast();
  const [s, setS] = useState({ likes: c.likes, dislikes: c.dislikes, value: c.myValue });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setS({ likes: c.likes, dislikes: c.dislikes, value: c.myValue });
  }, [c.id, c.likes, c.dislikes, c.myValue]);

  async function react(next: Reaction) {
    if (!user) {
      toast.info("เข้าสู่ระบบเพื่อกด ถูกใจ / ไม่ถูกใจ");
      return;
    }
    const prev = s;
    setS({ value: next, ...applyReaction({ likes: prev.likes, dislikes: prev.dislikes }, prev.value, next) });
    setPending(true);
    try {
      await reactToCombo(c.id, user.id, next);
    } catch {
      setS(prev); // revert
      toast.error("บันทึกการกดไม่สำเร็จ");
    } finally {
      setPending(false);
    }
  }

  return { likes: s.likes, dislikes: s.dislikes, value: s.value, pending, react };
}
