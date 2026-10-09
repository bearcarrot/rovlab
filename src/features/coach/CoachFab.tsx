import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { askCoach } from "@/services/ai";
import { useAuth } from "@/features/auth/AuthContext";
import { withNext } from "@/features/auth/nav";
import { useCoachChatState, type QuickChat } from "@/features/coach/CoachChatContext";
import { CoachText } from "@/components/CoachText";
import { EllipsisJump } from "@/components/EllipsisJump";
import { cn } from "@/lib/utils";

type Msg = { id: number; role: "user" | "coach" | "error"; text: string };

function Mascot({ className }: { className?: string }) {
  return (
    <img
      src="/CoachAi-64.webp"
      alt=""
      aria-hidden
      width={64}
      height={64}
      decoding="async"
      className={cn("shrink-0 object-contain", className)}
    />
  );
}

// ปุ่มลอยมุมขวาล่าง เปิดแชทโค้ช AI: ไม่มีช่องพิมพ์ เลือกได้เฉพาะ Quick Chat ที่หน้านั้นลงทะเบียนไว้
// แสดงเฉพาะหน้าที่เรียก useCoachQuickChats (ดู CoachChatContext)
export function CoachFab() {
  const { chats, resetKey } = useCoachChatState();
  const { user, loading } = useAuth();
  const { pathname, search } = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const reqId = useRef(0);
  const msgId = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);
  const hasChats = chats.length > 0;

  // เปลี่ยนหน้า/ฮีโร่ (resetKey เปลี่ยน) → ล้างบทสนทนา และทิ้งคำตอบที่ยังค้างอยู่
  useEffect(() => {
    reqId.current++;
    setMessages([]);
    setBusy(false);
  }, [resetKey]);

  // ออกจากหน้าที่มีแชท (เช่นกด Back ตอนแชทเปิดอยู่) → ปิดแชท กันเด้งเปิดเองในหน้าถัดไป
  useEffect(() => {
    if (!hasChats) setOpen(false);
  }, [hasChats]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy, open]);

  function push(role: Msg["role"], text: string) {
    const id = ++msgId.current;
    setMessages((m) => [...m, { id, role, text }]);
  }

  async function ask(q: QuickChat) {
    if (busy) return;
    const id = ++reqId.current;
    push("user", q.label);
    setBusy(true);
    try {
      const text = await askCoach(q.prompt, q.context);
      if (id === reqId.current) push("coach", text || "ยังไม่ได้คำตอบ ลองกดถามใหม่อีกครั้ง");
    } catch (e) {
      if (id === reqId.current) push("error", e instanceof Error ? e.message : "ถาม AI ไม่สำเร็จ");
    } finally {
      if (id === reqId.current) setBusy(false);
    }
  }

  if (!hasChats) return null;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="เปิดแชทโค้ช AI"
          className="fixed bottom-[calc(5rem_+_env(safe-area-inset-bottom,0px))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-accent/40 bg-bg-surface shadow-card transition-transform hover:scale-105 active:scale-95 motion-reduce:transition-none lg:bottom-6 lg:right-6"
        >
          <Mascot className="h-10 w-10" />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-50 flex h-[70dvh] flex-col rounded-t-2xl border border-b-0 border-border bg-bg-surface shadow-card outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom-8 data-[state=open]:slide-in-from-bottom-8 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[560px] sm:max-h-[80dvh] sm:w-[380px] sm:rounded-2xl sm:border-b"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Mascot className="h-9 w-9" />
            <div className="min-w-0 flex-1">
              <Dialog.Title className="font-display text-base font-semibold">โค้ช AI</Dialog.Title>
              <Dialog.Description className="text-xs text-text-faint">เลือกคำถามด้านล่างเพื่อถามโค้ช</Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="ปิด"
              className="rounded-lg p-2 text-text-muted hover:bg-bg-raised hover:text-text"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
            {messages.length === 0 && !busy && (
              <p className="py-6 text-center text-sm text-text-faint">เลือกคำถามด้านล่างได้เลย</p>
            )}
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3 py-2 text-sm font-medium text-accent-fg">
                    {m.text}
                  </p>
                </div>
              ) : (
                <div key={m.id} className="flex items-start gap-2">
                  <Mascot className="h-7 w-7" />
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl rounded-tl-md px-3 py-2",
                      m.role === "error" ? "border border-loss/40 bg-loss/10 text-sm text-loss" : "bg-bg-raised"
                    )}
                  >
                    {m.role === "error" ? m.text : <CoachText text={m.text} className="text-text" />}
                  </div>
                </div>
              )
            )}
            {busy && (
              <div className="flex items-start gap-2">
                <Mascot className="h-7 w-7" />
                <div className="rounded-2xl rounded-tl-md bg-bg-raised px-3 py-3 text-text-muted">
                  <EllipsisJump />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t border-border px-4 py-3">
            {loading ? null : user ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {chats.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      disabled={busy}
                      onClick={() => void ask(q)}
                      className="rounded-full border border-border bg-bg-raised px-3 py-1.5 text-sm text-text hover:border-accent/50 disabled:cursor-wait disabled:opacity-50"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-text-faint">* คำแนะนำจาก AI สร้างจากข้อมูลบนหน้านี้ อาจคลาดเคลื่อน</p>
              </>
            ) : (
              <p className="text-sm text-text-muted">
                <Link
                  to={withNext("/login", pathname + search)}
                  onClick={() => setOpen(false)}
                  className="text-accent underline"
                >
                  เข้าสู่ระบบ
                </Link>{" "}
                เพื่อถามโค้ช AI
              </p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
