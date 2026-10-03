import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// เลื่อนขึ้นบนสุดทุกครั้งที่เปลี่ยนหน้า (React Router ไม่ทำให้เอง)
// - กดย้อนกลับ/เดินหน้า (POP) ปล่อยให้เบราว์เซอร์คืนตำแหน่งเดิม
// - เปลี่ยนแค่ query string (เช่น ตัวกรอง) ไม่เลื่อน มีผลเฉพาะเมื่อ pathname เปลี่ยน
export function ScrollToTop() {
  const { pathname } = useLocation();
  const navType = useNavigationType();

  useEffect(() => {
    if (navType === "POP") return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname, navType]);

  return null;
}
