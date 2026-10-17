import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { supabase } from "@/lib/supabase";
import { setCacheBypass } from "@/lib/ttlCache";

type Result = { ok: boolean; err: string };

// Sidebar / MobileDrawer / AdminHub / Admin / ตัวนับข้อความติดต่อ ใช้ hook นี้พร้อมกัน
// → แชร์ผล RPC เดียวต่อผู้ใช้ (request ที่กำลังวิ่งหรือเพิ่งเสร็จภายใน 30 วินาที) แทนการยิงซ้ำทุก component
// TTL สั้นพอให้การให้/ถอนสิทธิ์แอดมินมีผลเมื่อเปิดหน้าใหม่ ส่วนผลที่ error จะไม่ถูกเก็บ
const SHARE_MS = 30_000;
let shared: { uid: string; at: number; p: Promise<Result> } | null = null;

function checkAdmin(uid: string): Promise<Result> {
  if (shared && shared.uid === uid && Date.now() - shared.at < SHARE_MS) return shared.p;
  const entry = {
    uid,
    at: Date.now(),
    p: Promise.resolve(supabase.rpc("is_admin")).then(
      ({ data, error }): Result => {
        if (error && shared === entry) shared = null;
        return { ok: Boolean(data), err: error?.message ?? "" };
      },
      (e: unknown): Result => {
        if (shared === entry) shared = null;
        return { ok: false, err: e instanceof Error ? e.message : String(e) };
      },
    ),
  };
  shared = entry;
  return entry.p;
}

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
      shared = null;
      setCacheBypass(false);
      return;
    }
    let alive = true;
    void checkAdmin(uid).then(({ ok, err }) => {
      if (alive) {
        setCacheBypass(ok);
        setState({ uid, ok, err });
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
