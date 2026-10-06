import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/components/ui/toast";
import { addFavorite, getFavoriteHeroSlugs, removeFavorite } from "@/services/favorites";

// รายการโปรดเป็น store กลางระดับโมดูล: ทุก FavoriteButton/หน้า Favorites ใช้ข้อมูลชุดเดียวกัน
// - โหลดครั้งเดียวต่อผู้ใช้ (ไม่ยิงคำขอซ้ำตามจำนวนการ์ดฮีโร่)
// - กดหัวใจที่จุดหนึ่ง จุดอื่นและหน้า Favorites อัปเดตตามทันที
// ผู้ที่ยังไม่ล็อกอิน/ยังไม่ตั้งค่า Supabase ได้ชุดว่างแบบอ่านอย่างเดียว (UI ควรพาไปล็อกอินแทนการเรียก toggle)

type Status = "idle" | "loading" | "ready" | "error";
type Snapshot = { userId: string | null; slugs: Set<string>; status: Status };

const EMPTY: Snapshot = { userId: null, slugs: new Set(), status: "idle" };
let snap: Snapshot = EMPTY;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: Snapshot) {
  snap = next;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
const getSnapshot = () => snap;

function resetFavorites() {
  inflight = null;
  if (snap !== EMPTY) publish(EMPTY);
}

function loadFavorites(userId: string) {
  // กำลังโหลด/โหลดแล้วของผู้ใช้คนนี้ = ไม่ต้องทำซ้ำ (status error จะลองใหม่เมื่อมี component mount ครั้งถัดไป)
  if (snap.userId === userId && (snap.status === "loading" || snap.status === "ready")) return;
  publish({ userId, slugs: new Set(), status: "loading" });
  const p: Promise<void> = getFavoriteHeroSlugs(userId)
    .then((list) => {
      if (inflight === p) publish({ userId, slugs: new Set(list), status: "ready" });
    })
    .catch(() => {
      if (inflight === p) publish({ userId, slugs: new Set(), status: "error" });
    });
  inflight = p;
}

export function useFavorites() {
  const { user, isConfigured } = useAuth();
  const toast = useToast();
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId || !isConfigured) {
      resetFavorites();
      return;
    }
    loadFavorites(userId);
  }, [userId, isConfigured]);

  const mine = userId !== null && state.userId === userId;
  const slugs = mine ? state.slugs : EMPTY.slugs;
  // ล็อกอินอยู่แต่ยังไม่มีผลของผู้ใช้คนนี้ = กำลังโหลด (กันหน้า Favorites วาบ "ยังไม่มีฮีโร่โปรด")
  const loading = Boolean(userId && isConfigured) && !(mine && (state.status === "ready" || state.status === "error"));

  const toggle = useCallback(
    async (heroSlug: string) => {
      if (!userId) return;
      const isFav = snap.userId === userId && snap.slugs.has(heroSlug);
      // อ่านค่าล่าสุดจาก store เสมอ (ไม่ใช่ค่าจาก closure) กันกดรัว ๆ แล้วทับกัน
      const apply = (add: boolean) => {
        if (snap.userId !== userId) return;
        const next = new Set(snap.slugs);
        if (add) next.add(heroSlug);
        else next.delete(heroSlug);
        publish({ ...snap, slugs: next });
      };
      apply(!isFav); // optimistic
      try {
        if (isFav) await removeFavorite(userId, heroSlug);
        else await addFavorite(userId, heroSlug);
      } catch {
        apply(isFav); // revert
        toast.error(isFav ? "เอาออกจากรายการโปรดไม่สำเร็จ" : "เพิ่มในรายการโปรดไม่สำเร็จ");
      }
    },
    [userId, toast]
  );

  return {
    favoriteSlugs: slugs,
    isFavorite: (slug: string) => slugs.has(slug),
    toggle,
    loading,
    canToggle: Boolean(user),
  };
}
