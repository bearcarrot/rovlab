import * as ToastPrimitive from "@radix-ui/react-toast";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Toast กลางของทั้งแอป — ผลของการกระทำ (บันทึก/ลบ/ส่ง/คัดลอก หรือพลาดแล้ว revert) ใช้ตัวนี้ตัวเดียว
// validation ของช่องกรอกและ error ของฟอร์มล็อกอิน/สมัคร ยังเป็น inline ใต้ช่องตามเดิม
// ใช้: const toast = useToast(); toast.success("บันทึกแล้ว"); toast.error("บันทึกไม่สำเร็จ");
// ข้อความ: สำเร็จ = "…แล้ว" / ล้มเหลว = "…ไม่สำเร็จ" (ต่อด้วยเหตุผลได้)

type Variant = "success" | "error" | "info";
type Item = { id: number; variant: Variant; text: string };

export interface ToastApi {
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);

const MAX_VISIBLE = 3;
// error อยู่นานกว่าเพื่อให้อ่านทัน (เท่ากับ toast เดิมของหน้าแอดมิน)
const DURATION: Record<Variant, number> = { success: 2500, info: 3500, error: 6000 };

const STYLE: Record<Variant, { icon: LucideIcon; iconCls: string; borderCls: string }> = {
  success: { icon: CheckCircle2, iconCls: "text-win", borderCls: "border-win/40" },
  error: { icon: AlertCircle, iconCls: "text-loss", borderCls: "border-loss/50" },
  info: { icon: Info, iconCls: "text-accent", borderCls: "border-accent/40" },
};

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);

  const push = useCallback((variant: Variant, text: string) => {
    setItems((cur) => [...cur.slice(-(MAX_VISIBLE - 1)), { id: ++seq, variant, text }]);
  }, []);

  const drop = useCallback((id: number) => {
    setItems((cur) => cur.filter((x) => x.id !== id));
  }, []);

  // object นี้คงที่ตลอดอายุแอป ใส่ใน dependency ของ hook อื่นได้โดยไม่ทำให้ re-render เพิ่ม
  const api = useMemo<ToastApi>(
    () => ({
      success: (text) => push("success", text),
      error: (text) => push("error", text),
      info: (text) => push("info", text),
    }),
    [push]
  );

  return (
    <Ctx.Provider value={api}>
      <ToastPrimitive.Provider swipeDirection="right" label="การแจ้งเตือน">
        {children}
        {items.map((it) => {
          const { icon: Icon, iconCls, borderCls } = STYLE[it.variant];
          return (
            <ToastPrimitive.Root
              key={it.id}
              type={it.variant === "error" ? "foreground" : "background"}
              duration={DURATION[it.variant]}
              onOpenChange={(open) => {
                // รอให้อนิเมชันปิดจบก่อนค่อยเอาออกจากรายการ
                if (!open) window.setTimeout(() => drop(it.id), 250);
              }}
              className={cn(
                "flex items-start gap-2.5 rounded-lg border bg-bg-raised px-3 py-3 text-sm text-text shadow-card",
                "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2",
                "data-[state=closed]:animate-out data-[state=closed]:fade-out-80",
                "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]",
                "data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform",
                "data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]",
                borderCls
              )}
            >
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconCls)} />
              <ToastPrimitive.Description className="min-w-0 flex-1 break-words leading-snug">
                {it.text}
              </ToastPrimitive.Description>
              <ToastPrimitive.Close
                aria-label="ปิดการแจ้งเตือน"
                className="shrink-0 rounded p-0.5 text-text-faint hover:text-text"
              >
                <X className="h-4 w-4" />
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          );
        })}
        {/* มือถือ: ลอยเหนือ BottomNav (h-16 + safe-area) จอ lg ขึ้นไป BottomNav ซ่อน จึงชิดล่างปกติ */}
        <ToastPrimitive.Viewport
          label="การแจ้งเตือน ({hotkey})"
          className="fixed inset-x-4 bottom-[calc(4rem+env(safe-area-inset-bottom,0px)+0.75rem)] z-[100] m-0 flex list-none flex-col gap-2 p-0 outline-none sm:inset-x-auto sm:right-6 sm:w-96 lg:bottom-6"
        />
      </ToastPrimitive.Provider>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast ต้องใช้ภายใน <ToastProvider>");
  return ctx;
}
