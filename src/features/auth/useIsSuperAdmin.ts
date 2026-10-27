import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { useIsAdmin } from "@/features/auth/useIsAdmin";
import { amISuperAdmin } from "@/services/adminUsers";

// เช็กว่าผู้ใช้ที่ล็อกอินอยู่เป็น Super Admin หรือไม่ (RPC is_super_admin) — เรียกเฉพาะเมื่อเป็นแอดมินแล้ว
// ใช้ซ่อน/แสดงเมนูเท่านั้น สิทธิ์จริงต้องถูกบังคับฝั่งเซิร์ฟเวอร์ (เช่น Edge Function game-fetch ตรวจ is_super_admin เอง)
export function useIsSuperAdmin() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const uid = user?.id ?? null;
  const [state, setState] = useState<{ uid: string | null; ok: boolean }>({ uid: null, ok: false });

  useEffect(() => {
    if (!uid || !isAdmin) return;
    let alive = true;
    void amISuperAdmin().then((ok) => {
      if (alive) setState({ uid, ok });
    });
    return () => {
      alive = false;
    };
  }, [uid, isAdmin]);

  const known = uid !== null && state.uid === uid;
  return {
    isSuperAdmin: isAdmin && known && state.ok,
    // กำลังตรวจ: ยังไม่รู้ผล (ใช้กันแท็บที่จำไว้เด้งไปหน้าอื่นชั่วคราว)
    checking: isAdmin && !known,
  };
}
