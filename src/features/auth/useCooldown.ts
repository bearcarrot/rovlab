import { useCallback, useEffect, useState } from "react";

// cooldown ฝั่งผู้ใช้ (เช่น Resend 60 วินาที) — เป็นแค่ UX ตัวจำกัดจริงคือ rate limit ของ Supabase Auth
const storageKey = (name: string) => `rovlab:cooldown:${name}`;

function readUntil(name: string): number {
  try {
    return Number(localStorage.getItem(storageKey(name))) || 0;
  } catch {
    return 0;
  }
}

export function useCooldown(name: string, seconds = 60) {
  const [until, setUntil] = useState(() => readUntil(name));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (until <= Date.now()) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= until) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [until]);

  const start = useCallback(() => {
    const u = Date.now() + seconds * 1000;
    try {
      localStorage.setItem(storageKey(name), String(u));
    } catch {
      /* ignore */
    }
    setUntil(u);
    setNow(Date.now());
  }, [name, seconds]);

  return { remaining: Math.max(0, Math.ceil((until - now) / 1000)), start };
}
