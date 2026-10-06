import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Minimal accessible dialog shared by the Draft / Tier List save, view and confirm flows.
export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "flex max-h-[90vh] w-full flex-col rounded-t-2xl border border-border bg-bg-surface shadow-card sm:rounded-card",
          wide ? "sm:max-w-3xl" : "sm:max-w-md"
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="min-w-0 truncate font-display text-base font-semibold">{title}</h2>
          <button type="button" aria-label="ปิด" onClick={onClose} className="shrink-0 text-text-faint hover:text-text">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
