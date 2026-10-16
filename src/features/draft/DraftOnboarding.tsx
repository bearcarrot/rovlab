import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { BarChart3, GripVertical, Link2, Share2, Swords, Users } from "lucide-react";
import { Modal } from "@/features/community/Modal";

// แฟลกเดียวใน localStorage (ไม่เก็บ Draft/ข้อมูลผู้ใช้) — เก็บไม่ได้ = ไม่เปิดอัตโนมัติ ผู้ใช้ยังกด "วิธีใช้งาน" เองได้
const KEY = "rovlab:draft:onboarding:v1";

function hasSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true;
  }
}

function markSeen() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // เก็บไม่ได้ก็ไม่เป็นไร
  }
}

/** `ready` = editor พร้อมแล้ว (โหลดฮีโร่เสร็จ) จึงเปิดอัตโนมัติได้โดยไม่ทำให้หน้ากระตุก */
export function useDraftOnboarding(ready: boolean) {
  const [open, setOpen] = useState(false);
  const checked = useRef(false);
  useEffect(() => {
    if (!ready || checked.current) return;
    checked.current = true;
    if (!hasSeen()) setOpen(true);
  }, [ready]);
  // ปิดด้วยวิธีไหนก็ตาม (ข้าม/เสร็จสิ้น/Esc/กดพื้นหลัง) = ไม่เปิดเองอีก
  const close = useCallback(() => {
    markSeen();
    setOpen(false);
  }, []);
  const show = useCallback(() => setOpen(true), []);
  return { open, close, show };
}

// ตัวอย่างสลับช่อง: กล่องเปล่าไม่มีข้อมูลฮีโร่จริง ไม่แตะ Draft ของผู้ใช้; ปิดแอนิเมชันเมื่อผู้ใช้ตั้ง reduced motion
function SwapDemo() {
  return (
    <div aria-hidden className="flex justify-center py-2">
      <style>{`
        @keyframes rov-swap-a{0%,20%{transform:translateX(0)}45%,70%{transform:translateX(3.5rem)}95%,100%{transform:translateX(0)}}
        @keyframes rov-swap-b{0%,20%{transform:translateX(0)}45%,70%{transform:translateX(-3.5rem)}95%,100%{transform:translateX(0)}}
        @media (prefers-reduced-motion: reduce){.rov-swap{animation:none!important}}
      `}</style>
      <div className="flex gap-2">
        <div
          className="rov-swap relative flex h-12 w-12 items-center justify-center rounded-lg border border-accent bg-accent/10 text-sm font-semibold text-accent"
          style={{ animation: "rov-swap-a 3.5s ease-in-out infinite" }}
        >
          A
          <GripVertical className="absolute bottom-0.5 left-0.5 h-3.5 w-3.5 text-text-muted" />
        </div>
        <div
          className="rov-swap flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-bg-raised text-sm font-semibold text-text-muted"
          style={{ animation: "rov-swap-b 3.5s ease-in-out infinite" }}
        >
          B
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-border text-text-faint">+</div>
      </div>
    </div>
  );
}

function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-0.5 shrink-0 text-accent">{icon}</span>
      <span>{children}</span>
    </li>
  );
}

interface Step {
  title: string;
  body: ReactNode;
}

// เนื้อหาทุกข้อมาจาก UI ที่มีอยู่จริงของหน้านี้ (ดู DraftAssistant / TeamSlots / RecommendedPickCard / DraftShareBar)
const STEPS: Step[] = [
  {
    title: "Draft Assistant คืออะไร?",
    body: (
      <p>
        ช่วยวางดราฟต์ ดูว่าทีมของคุณขาดอะไร เทียบเคาน์เตอร์/คอมโบกับทีมศัตรู และแนะนำฮีโร่ตัวถัดไป
        ผลที่ได้เป็นการประเมินเบื้องต้นจากสถิติและข้อมูลในระบบ ใช้ประกอบการตัดสินใจ ไม่ใช่คำตอบตายตัว
      </p>
    ),
  },
  {
    title: "เลือกฮีโร่ใน Draft",
    body: (
      <ul className="space-y-2">
        <Row icon={<Users className="h-4 w-4" />}>มี 2 ทีม คือ “ทีมของคุณ” และ “ทีมศัตรู” ทีมละ 5 ช่อง</Row>
        <Row icon={<span className="text-sm font-bold">+</span>}>
          แตะช่อง + แล้วเลือกฮีโร่จากรายการด้านล่าง ค้นหาด้วยชื่อ หรือกรองตามบทบาท/เลนได้
        </Row>
        <Row icon={<span className="text-sm font-bold">×</span>}>
          กด × ที่มุมช่องเพื่อเอาออก หรือแตะช่องที่มีฮีโร่อยู่แล้วเลือกตัวใหม่เพื่อเปลี่ยน
        </Row>
        <Row icon={<Swords className="h-4 w-4" />}>
          ถ้าเลือกโหมดซีรีส์ (BO3/BO5/BO7) จะมีช่องแบนเพิ่มของแต่ละทีม
        </Row>
      </ul>
    ),
  },
  {
    title: "จัดตำแหน่งฮีโร่ได้ตามต้องการ",
    body: (
      <div className="space-y-2">
        <SwapDemo />
        <p>
          จับที่ไอคอน <GripVertical className="inline h-4 w-4 align-text-bottom" /> มุมซ้ายล่างของช่อง แล้วลากไปวางบนอีกช่องของทีมเดียวกันเพื่อสลับ
          หรือวางบนช่องว่างเพื่อย้ายฮีโร่ไปช่องนั้น
        </p>
        <p className="text-text-muted">
          บนมือถือ แตะที่ไอคอนนั้นแล้วลากได้เลย (ลากที่อื่นยังเลื่อนหน้าตามปกติ) หรือแตะช่อง แล้วกดปุ่มลูกศรซ้าย/ขวาใต้ช่อง ลากข้ามทีมไม่ได้
        </p>
      </div>
    ),
  },
  {
    title: "อ่านผลวิเคราะห์ก่อนเลือกตัว",
    body: (
      <ul className="space-y-2">
        <Row icon={<BarChart3 className="h-4 w-4" />}>
          “ภาพรวมทีมของคุณ” มีมิเตอร์ เช่น แนวหน้า, Crowd Control, ความคล่องตัว และจุดที่ทีมยังขาด เป็นค่าประเมินคร่าวๆ
        </Row>
        <Row icon={<Swords className="h-4 w-4" />}>
          “ชนะทางศัตรู” คือฮีโร่ที่ข้อมูลในระบบบอกว่าเคาน์เตอร์ตัวที่ศัตรูเลือกไปแล้ว
        </Row>
        <Row icon={<Link2 className="h-4 w-4" />}>“คอมโบกับทีมของคุณ” คือฮีโร่ที่เข้ากับตัวที่คุณเลือกไว้</Row>
        <Row icon={<Users className="h-4 w-4" />}>
          การ์ดแนะนำมีดาว (ยิ่งมากยิ่งเหมาะตามคะแนนของระบบ), Tier, ความเสี่ยง ต่ำ/กลาง/สูง ซึ่งอิงระดับความยากของฮีโร่ และเหตุผลสั้นๆ ข้อความสีเหลืองคือคำเตือน เช่น ศัตรูชนะทางตัวนี้
        </Row>
      </ul>
    ),
  },
  {
    title: "แชร์ Draft ให้เพื่อน",
    body: (
      <ul className="space-y-2">
        <Row icon={<Share2 className="h-4 w-4" />}>
          ใต้ช่องฮีโร่มีปุ่มแชร์รูปและแชร์ลิงก์ รูปคือเกมที่เปิดอยู่ ส่วนลิงก์คือทั้งซีรีส์
        </Row>
        <Row icon={<Link2 className="h-4 w-4" />}>
          แชร์ลิงก์ต้องเข้าสู่ระบบ และจะบันทึก/เผยแพร่ใน Community ก่อน ผู้รับเปิดดูได้โดยไม่ต้องล็อกอิน
        </Row>
        <Row icon={<span className="text-xs font-bold">💾</span>}>
          กด “บันทึก” เพื่อเก็บไว้ในแท็บ “Draft ของฉัน”
        </Row>
      </ul>
    ),
  },
];

export function DraftOnboarding({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <Modal title={step.title} onClose={onClose}>
      <div className="space-y-4 text-sm leading-relaxed">
        <div>{step.body}</div>

        <div className="flex items-center justify-center gap-1.5" aria-hidden>
          {STEPS.map((_, n) => (
            <span key={n} className={`h-1.5 rounded-full ${n === i ? "w-5 bg-accent" : "w-1.5 bg-border"}`} />
          ))}
        </div>
        <p className="sr-only" aria-live="polite">{`ขั้นที่ ${i + 1} จาก ${STEPS.length}`}</p>

        <div className="flex items-center justify-between gap-2">
          {last ? (
            <span />
          ) : (
            <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-text-muted hover:text-text">
              ข้าม
            </button>
          )}
          <div className="flex gap-2">
            {i > 0 && (
              <button
                type="button"
                onClick={() => setI(i - 1)}
                className="rounded-lg border border-border px-3 py-2 text-text-muted hover:text-text"
              >
                ย้อนกลับ
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? onClose() : setI(i + 1))}
              className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-fg"
            >
              {last ? "เสร็จสิ้น" : "ถัดไป"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
