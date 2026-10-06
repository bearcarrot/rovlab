import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { supabase } from "@/lib/supabase";
import { setCacheBypass } from "@/lib/ttlCache";

// เช็กว่าผู้ใช้ที่ล็อกอินอยู่เป็นแอดมินหรือไม่ (RPC is_admin ใน Supabase)
// สิทธิ์จริงควบคุมที่ RLS ของ DB หน้านี้ใช้แค่ซ่อน/แสดงเมนู
// แอดมินจะข้าม cache ฝั่งหน้าเว็บ (ttlCache) เพื่อเห็นข้อมูลที่เพิ่งแก้ทันที
export function useIsAdmin() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [state, setState] = useState<{ uid: string | null; ok: boolean; err: string }>({
    uid: null,
    ok: false,
    err: "",
  });

  useEffect(() => {
    if (!uid) {
      setCacheBypass(false);
      return;
    }
    let alive = true;
    void supabase.rpc("is_admin").then(({ data, error }) => {
      if (alive) {
        setCacheBypass(Boolean(data));
        setState({ uid, ok: Boolean(data), err: error?.message ?? "" });
      }
    });
    return () => {
      alive = false;
    };
  }, [uid]);

  return {
    isAdmin: uid !== null && state.uid === uid && state.ok,
    checking: uid !== null && state.uid !== uid,
    error: state.err,
  };
}
