import { useEffect, useRef, useState, type ReactNode } from "react";

// เมานต์ children ครั้งแรกเมื่อพื้นที่ใกล้เข้าจอ แล้วคงไว้ (latched) เลื่อนออกแล้วกลับมาก็ไม่โหลดซ้ำ
// คำขอของ children เริ่มตอนเมานต์ จึงไม่ยิงก่อนผู้ใช้เลื่อนมาใกล้ส่วนนั้น
// eager = ต้องเมานต์ทันที (เช่น ลิงก์ลึกไปความคิดเห็น); ไม่มี IntersectionObserver = เมานต์ทันที
export function LazySection({ children, eager = false, minHeight = 160 }: { children: ReactNode; eager?: boolean; minHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === "undefined");
  const show = seen || eager;

  useEffect(() => {
    if (show) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [show]);

  if (show) return <>{children}</>;
  // ที่ว่างกันกระโดดของเลย์เอาต์ ไม่มีเนื้อหาให้โฟกัส/อ่าน
  return <div ref={ref} aria-hidden="true" style={{ minHeight }} />;
}
