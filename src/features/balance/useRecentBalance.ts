import { useEffect, useState } from "react";
import { getRecentBalance, type BalanceKind } from "@/services/balance";

// hero uuid -> ประเภทการปรับล่าสุด (เฉพาะช่วงที่ยังใหม่) — null = กำลังโหลด ช่วยให้การ์ดทุกใบใช้คำขอเดียวกัน
export function useRecentBalance(): Map<string, BalanceKind> | null {
  const [map, setMap] = useState<Map<string, BalanceKind> | null>(null);
  useEffect(() => {
    let alive = true;
    void getRecentBalance().then((m) => {
      if (alive) setMap(m);
    });
    return () => {
      alive = false;
    };
  }, []);
  return map;
}
