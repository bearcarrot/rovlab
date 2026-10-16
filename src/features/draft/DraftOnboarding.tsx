import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { GripVertical } from "lucide-react";

// แฟลกเดียวใน localStorage (ไม่เก็บ Draft/ข้อมูลผู้ใช้) — เก็บไม่ได้ = ไม่เปิดอัตโนมัติ ผู้ใช้ยังกด "วิธีใช้งาน" เองได้
const KEY = "rovlab:draft:onboarding:v2";

function hasSeen(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return true;
  }
}

function markSeen(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // เก็บไม่ได้ก็ไม่เป็นไร
  }
}

/** `ready` = editor พร้อมแล้ว (โหลดฮีโร่เสร็จ) จึงเปิดอัตโนมัติได้โดยไม่ทำให้หน้ากระตุก */
export function useDraftOnboarding(ready: boolean, key = KEY) {
  const [open, setOpen] = useState(false);
  const checked = useRef(false);
  useEffect(() => {
    if (!ready || checked.current) return;
    checked.current = true;
    if (!hasSeen(key)) setOpen(true);
  }, [ready, key]);
  // ปิดด้วยวิธีไหนก็ตาม (ข้าม/เสร็จสิ้น/Esc) = ไม่เปิดเองอีก
  const close = useCallback(() => {
    markSeen(key);
    setOpen(false);
  }, [key]);
  const show = useCallback(() => setOpen(true), []);
  return { open, close, show };
}

// ตัวอย่างสลับช่อง (ใช้เมื่อยังไม่มีฮีโร่ในช่องให้ชี้): กล่องเปล่า ไม่แตะ Draft ของผู้ใช้; หยุดแอนิเมชันเมื่อเปิด reduced motion
function SwapDemo() {
  return (
    <div aria-hidden className="flex justify-center py-1">
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

export interface Step {
  /** ค่า data-tour ของ element จริงบนหน้าที่จะไฮไลต์ (ไม่มี = การ์ดกลางจอ) */
  target?: string;
  /** ใช้เมื่อหา target ไม่เจอ (เช่น ยังไม่มีฮีโร่ในช่องจึงยังไม่มีที่จับ) */
  fallback?: string;
  title: string;
  body: (found: boolean) => ReactNode;
}

// ทุกขั้นชี้ element จริงของหน้า Draft Assistant (data-tour ใน DraftAssistant / TeamSlots)
const DEFAULT_STEPS: Step[] = [
  {
    title: "Draft Assistant คืออะไร?",
    body: () => (
      <p>
        ช่วยวางดราฟต์ ดูว่าทีมของคุณขาดอะไร เทียบเคาน์เตอร์/คอมโบกับทีมศัตรู และแนะนำฮีโร่ตัวถัดไป
        ผลเป็นการประเมินเบื้องต้นจากสถิติและข้อมูลในระบบ ใช้ประกอบการตัดสินใจ ไม่ใช่คำตอบตายตัว
        จะพาไปดูทีละจุดบนหน้านี้
      </p>
    ),
  },
  {
    target: "team-mine",
    title: "ช่องทีมของคุณ",
    body: () => (
      <p>
        5 ช่องนี้คือทีมของคุณ แตะช่อง + เพื่อเลือกว่าจะใส่ฮีโร่ช่องไหน แตะช่องที่มีฮีโร่แล้วเพื่อเปลี่ยนตัว
        กด × มุมขวาบนของช่องเพื่อเอาฮีโร่ออก
      </p>
    ),
  },
  {
    target: "team-enemy",
    title: "ช่องทีมศัตรู",
    body: () => (
      <p>
        ใส่ฮีโร่ที่ศัตรูเลือกไว้ตรงนี้ ระบบจะใช้หาตัวที่ชนะทางศัตรูและเตือนตัวที่ศัตรูชนะทาง
        ถ้าเลือกโหมดซีรีส์ (BO3/BO5/BO7) จะมีช่องแบนเพิ่มใต้แต่ละทีม
      </p>
    ),
  },
  {
    target: "picker",
    fallback: "team-mine",
    title: "รายการเลือกฮีโร่",
    body: (found) => (
      <p>
        {found
          ? "แตะฮีโร่ในรายการเพื่อใส่ช่องที่เลือกอยู่ (ชื่อช่องอยู่ในช่องค้นหา) พิมพ์ชื่อเพื่อค้นหา หรือกรองตามบทบาท/เลน ฮีโร่ที่ถูกใช้หรือแบนในเกมนี้แล้วจะไม่แสดง"
          : "รายการเลือกฮีโร่จะเปิดเมื่อคุณแตะช่องในทีม แล้วแตะฮีโร่ในรายการเพื่อใส่ช่องนั้น ค้นหาด้วยชื่อหรือกรองตามบทบาท/เลนได้"}
      </p>
    ),
  },
  {
    target: "drag-handle",
    fallback: "team-mine",
    title: "ลากสลับตำแหน่ง",
    body: (found) => (
      <div className="space-y-2">
        {!found && <SwapDemo />}
        <p>
          {found
            ? "ไอคอนจุดตรงนี้คือที่จับ ลากไปวางบนช่องอื่นของทีมเดียวกันเพื่อสลับตำแหน่ง หรือวางบนช่องว่างเพื่อย้ายฮีโร่ไปช่องนั้น"
            : "เมื่อมีฮีโร่ในช่อง จะมีไอคอนจุดที่มุมซ้ายล่างของช่อง ลากไอคอนนั้นไปวางบนอีกช่องของทีมเดียวกันเพื่อสลับตำแหน่งหรือย้ายเข้าช่องว่าง"}
        </p>
        <p className="text-text-muted">
          บนมือถือแตะไอคอนนี้แล้วลากได้เลย (ลากที่อื่นยังเลื่อนหน้าได้ปกติ) หรือแตะช่อง แล้วกดปุ่มลูกศรซ้าย/ขวาใต้ช่อง
          ลากข้ามทีมไม่ได้
        </p>
      </div>
    ),
  },
  {
    target: "meters",
    fallback: "team-mine",
    title: "มิเตอร์ทีมของคุณ",
    body: () => (
      <p>
        แถบเหล่านี้ประเมินทีมของคุณคร่าวๆ เช่น แนวหน้า, Crowd Control, ความคล่องตัว ยิ่งแถบเต็มยิ่งทีมมีด้านนั้นมาก
        เป็นค่าประเมินเบื้องต้น ไม่ใช่สถิติที่วัดจริง ส่วน “จุดที่ทีมขาด” ด้านบนบอกว่าควรเติมอะไร
      </p>
    ),
  },
  {
    target: "recs",
    fallback: "team-mine",
    title: "แนะนำตัวถัดไป",
    body: () => (
      <div className="space-y-2">
        <p>
          การ์ดฮีโร่ที่ระบบแนะนำ ดาวยิ่งมากยิ่งเหมาะกับดราฟต์นี้ตามคะแนนของระบบ ความเสี่ยง ต่ำ/กลาง/สูง อิงระดับความยากของฮีโร่
          ข้อความสีเหลืองคือคำเตือน เช่น ศัตรูชนะทางตัวนี้ กด “เลือกฮีโร่นี้” เพื่อใส่ช่องว่างช่องแรกของทีมคุณ
        </p>
        <p className="text-text-muted">
          เมื่อเลือกทีมศัตรูแล้วจะมีหัวข้อ “ชนะทางศัตรู” และ “คอมโบกับทีมของคุณ” แยกให้
        </p>
      </div>
    ),
  },
  {
    target: "share",
    fallback: "team-mine",
    title: "แชร์ Draft",
    body: () => (
      <p>
        ปุ่มแชร์รูปและแชร์ลิงก์อยู่ตรงนี้ (กดได้เมื่อเลือกฮีโร่แล้ว) รูปคือเกมที่เปิดอยู่ ส่วนลิงก์คือทั้งซีรีส์
        การแชร์ลิงก์ต้องเข้าสู่ระบบ แต่ผู้รับเปิดดูได้โดยไม่ต้องล็อกอิน
      </p>
    ),
  },
  {
    target: "save",
    title: "บันทึก Draft",
    body: () => (
      <p>
        กดบันทึกเพื่อเก็บ Draft ไว้ดูต่อในแท็บ “Draft ของฉัน” ต้องเข้าสู่ระบบ
        และกดปุ่ม “วิธีใช้งาน” ข้างหัวข้อหน้าเมื่อไหร่ก็ได้เพื่อเปิดคู่มือนี้อีกครั้ง
      </p>
    ),
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 6;

const find = (name?: string) =>
  name ? document.querySelector<HTMLElement>(`[data-tour="${name}"]`) : null;

// ทัวร์ไฮไลต์: วงสว่างรอบ element จริง + การ์ดอธิบายอยู่ฝั่งตรงข้าม (บน/ล่างของจอ) ไม่บังจุดที่ไฮไลต์
export function DraftOnboarding({ onClose, steps: STEPS = DEFAULT_STEPS }: { onClose: () => void; steps?: Step[] }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [found, setFound] = useState(false);
  const nextRef = useRef<HTMLButtonElement>(null);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  useEffect(() => {
    const primary = find(step.target);
    const el = primary ?? find(step.fallback);
    setFound(primary !== null);
    if (!el) {
      setRect(null);
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    const update = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    // เลื่อนแบบ smooth ใช้เวลา: วัดซ้ำสั้นๆ แล้วคอยตามตอนเลื่อน/ย่อขยายจอ
    let raf = 0;
    const t0 = performance.now();
    const tick = () => {
      update();
      if (performance.now() - t0 < 700) raf = requestAnimationFrame(tick);
    };
    tick();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [step]);

  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
  }, [i]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ไฮไลต์อยู่ครึ่งบนของจอ → การ์ดอยู่ล่าง / อยู่ครึ่งล่าง → การ์ดอยู่บน
  const cardAtTop = rect !== null && rect.top + rect.height / 2 > window.innerHeight / 2;
  const cardPos = rect
    ? cardAtTop
      ? { top: "max(0.75rem, env(safe-area-inset-top))" }
      : { bottom: "max(0.75rem, env(safe-area-inset-bottom))" }
    : { top: "50%", transform: "translateY(-50%)" };

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label={step.title}>
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-xl border-2 border-accent transition-[top,left,width,height] duration-200 motion-reduce:transition-none motion-safe:animate-pulse"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.65)",
          }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-black/65" />
      )}

      <div
        className="fixed left-3 right-3 mx-auto max-h-[60vh] max-w-sm overflow-y-auto rounded-card border border-border bg-bg-surface p-4 shadow-card"
        style={cardPos}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="min-w-0 font-display text-base font-semibold">{step.title}</h2>
          <span className="shrink-0 text-xs text-text-faint">
            {i + 1}/{STEPS.length}
          </span>
        </div>

        <div className="text-sm leading-relaxed">{step.body(found)}</div>

        <p className="sr-only" aria-live="polite">{`ขั้นที่ ${i + 1} จาก ${STEPS.length}`}</p>

        <div className="mt-4 flex items-center justify-between gap-2">
          {last ? (
            <span />
          ) : (
            <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-text-muted hover:text-text">
              ข้าม
            </button>
          )}
          <div className="flex gap-2">
            {i > 0 && (
              <button
                type="button"
                onClick={() => setI(i - 1)}
                className="rounded-lg border border-border px-3 py-2 text-sm text-text-muted hover:text-text"
              >
                ย้อนกลับ
              </button>
            )}
            <button
              ref={nextRef}
              type="button"
              onClick={() => (last ? onClose() : setI(i + 1))}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg"
            >
              {last ? "เสร็จสิ้น" : "ถัดไป"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
