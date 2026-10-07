import { useEffect, useState } from "react";
import { Modal } from "./Modal";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** destructive action: red confirm button, focus starts on cancel */
  danger?: boolean;
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

let listener: ((p: Pending) => void) | null = null;

/**
 * Promise-based replacement for window.confirm. Resolves true only when the user presses the confirm button;
 * Esc / backdrop / cancel resolve false. Needs <ConfirmHost /> mounted on the page; if it is not,
 * it falls back to the native prompt rather than silently confirming.
 */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!listener) {
      resolve(window.confirm([opts.title, opts.message].filter(Boolean).join("\n")));
      return;
    }
    listener({ ...opts, resolve });
  });
}

export function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    listener = (p) =>
      setPending((cur) => {
        cur?.resolve(false); // a newer prompt cancels the older one
        return p;
      });
    return () => {
      listener = null;
    };
  }, []);

  if (!pending) return null;
  const close = (ok: boolean) => {
    pending.resolve(ok);
    setPending(null);
  };

  return (
    <Modal title={pending.title} onClose={() => close(false)}>
      <div className="space-y-4">
        {pending.message && <p className="text-sm text-text-muted">{pending.message}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            autoFocus={pending.danger}
            onClick={() => close(false)}
            className="rounded-lg border border-border px-3 py-2 text-sm text-text-muted hover:text-text"
          >
            {pending.cancelLabel ?? "ยกเลิก"}
          </button>
          <button
            type="button"
            autoFocus={!pending.danger}
            onClick={() => close(true)}
            className={
              pending.danger
                ? "rounded-lg bg-loss px-4 py-2 text-sm font-semibold text-white"
                : "rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg"
            }
          >
            {pending.confirmLabel ?? "ยืนยัน"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
