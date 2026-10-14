import { useEffect, useState } from "react";
import { useIsAdmin } from "@/features/auth/useIsAdmin";
import { getContactCounts } from "@/services/contact";

// จำนวนข้อความติดต่อใหม่ (สถานะ new) สำหรับ badge ที่เมนูแอดมิน/แท็บ — เรียกเฉพาะแอดมิน
// โหลดตอน mount, เมื่อกลับมาที่แท็บเบราว์เซอร์ และเมื่อแอดมินเปลี่ยนสถานะในหน้าแอดมิน (ไม่มี polling)
export const CONTACT_COUNTS_CHANGED = "rovlab:contact-counts-changed";

// Sidebar / MobileDrawer / AdminHub ใช้ hook นี้พร้อมกัน → แชร์ request ที่กำลังวิ่ง/เพิ่งเสร็จ (ภายใน 3 วินาที)
let inflight: { at: number; p: Promise<number> } | null = null;
function fetchNewCount(force: boolean): Promise<number> {
  const now = Date.now();
  if (!force && inflight && now - inflight.at < 3000) return inflight.p;
  const p = getContactCounts().then((c) => c.newCount);
  inflight = { at: now, p };
  return p;
}

export function useAdminContactCount(): number {
  const { isAdmin } = useIsAdmin();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isAdmin) {
      setCount(0);
      return;
    }
    let alive = true;
    const load = (force: boolean) => {
      fetchNewCount(force)
        .then((n) => {
          if (alive) setCount(n);
        })
        .catch(() => {
          /* badge is best-effort */
        });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") load(false);
    };
    const onChanged = () => load(true);
    load(false);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(CONTACT_COUNTS_CHANGED, onChanged);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(CONTACT_COUNTS_CHANGED, onChanged);
    };
  }, [isAdmin]);

  return count;
}
