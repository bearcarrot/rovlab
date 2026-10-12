import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { DraftPreviewPanel } from "@/features/draft/DraftPreviewPanel";
import type { HeroSummary } from "@/types/hero";

// โค้ดและ request ของการ์ดดราฟต์ชุมชนถูกแยก chunk และโหลดก็ต่อเมื่อส่วนนี้เลื่อนเข้าใกล้หน้าจอ
// เพื่อไม่กระทบ LCP / JS ที่ต้องโหลดตอนเปิดหน้าแรก (PSI)
const CommunityDraftSpotlight = lazy(() => import("@/features/draft/CommunityDraftSpotlight"));

export function DraftPreviewSlot({ heroes }: { heroes: HeroSummary[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {near && heroes.length > 0 ? (
        <Suspense fallback={<DraftPreviewPanel />}>
          <CommunityDraftSpotlight heroes={heroes} />
        </Suspense>
      ) : (
        <DraftPreviewPanel />
      )}
    </div>
  );
}
