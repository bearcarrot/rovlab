import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Modal } from "@/features/community/Modal";
import { cn } from "@/lib/utils";

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** ใช้กับการกระทำที่ย้อนไม่ได้ (ลบ/แทนที่): ปุ่มยืนยันเป็นสีแดง และโฟกัสเริ่มที่ปุ่มยกเลิก */
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

// แทน window.confirm: เปิด Modal ของแอป แล้วคืน Promise<boolean> (true = ยืนยัน, false = ยกเลิก/ปิด/กด Esc)
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (o) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false); // ถ้ามีกล่องค้างอยู่ ถือว่ายกเลิกอันเก่า
        resolver.current = resolve;
        setOptions(o);
      }),
    []
  );

  const settle = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  }, []);
  const cancel = useCallback(() => settle(false), [settle]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <Modal title={options.title} onClose={cancel}>
          <div className="space-y-4 text-sm">
            {options.message && <div className="text-text-muted">{options.message}</div>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                autoFocus={options.danger}
                onClick={cancel}
                className="rounded-lg border border-border px-3 py-2 text-text-muted hover:text-text"
              >
                {options.cancelLabel ?? "ยกเลิก"}
              </button>
              <button
                type="button"
                autoFocus={!options.danger}
                onClick={() => settle(true)}
                className={cn("rounded-lg px-4 py-2 font-semibold", options.danger ? "bg-loss text-white" : "bg-accent text-accent-fg")}
              >
                {options.confirmLabel ?? "ตกลง"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const fn = useContext(ConfirmContext);
  if (!fn) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return fn;
}
