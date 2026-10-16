import { lazy, Suspense } from "react";
import { useCoachChatState } from "@/features/coach/CoachChatContext";

// CoachFab ลาก Radix Dialog, services/ai และ CoachFeedback มาด้วย แต่โผล่เฉพาะหน้าที่ลงทะเบียน Quick Chat
// จึงโหลดแบบ lazy เฉพาะตอนมี chats เพื่อไม่ให้อยู่ใน main bundle ของทุกหน้า (PSI: unused JavaScript)
const CoachFab = lazy(() => import("@/features/coach/CoachFab").then((m) => ({ default: m.CoachFab })));

export function CoachFabLoader() {
  if (useCoachChatState().chats.length === 0) return null;
  return (
    <Suspense fallback={null}>
      <CoachFab />
    </Suspense>
  );
}
