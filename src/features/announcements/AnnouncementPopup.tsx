import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { AnnouncementCard } from "./AnnouncementCard";
import { useAnnouncements } from "./useAnnouncements";

// Fail closed and silent: a popup problem must never replace the page with an error card (the shared ErrorBoundary would).
class SilentBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error("[AnnouncementPopup]", error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Popup() {
  const { shown, more, ready, dismiss } = useAnnouncements();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const decided = useRef(false);

  // Decide ONCE, when the first load finishes: open only if something is visible at that moment (i.e. on site open).
  // An announcement that activates later in the same visit never pops up by itself.
  useEffect(() => {
    if (!ready || decided.current) return;
    decided.current = true;
    if (shown.length > 0) setOpen(true);
  }, [ready, shown.length]);

  // Everything was hidden: reset so a later arrival cannot reopen a popup that was already used up.
  useEffect(() => {
    if (shown.length === 0) setOpen(false);
  }, [shown.length]);

  // Loading, error and zero visible items all render nothing.
  if (shown.length === 0) return null;

  const cards = expanded ? [...shown, ...more] : shown;
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-card border border-border bg-bg-surface shadow-card focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border py-1 pl-4 pr-1">
            <Dialog.Title className="font-display text-base font-semibold text-text">ประกาศ</Dialog.Title>
            <Dialog.Close
              aria-label="ปิด"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-text-muted hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="space-y-3 overflow-y-auto p-4">
            {cards.map((a) => (
              <AnnouncementCard key={a.id} announcement={a} mode="live" hideCloseButton onDismiss={(id) => void dismiss(id)} />
            ))}
            {more.length > 0 && (
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpanded((v) => !v)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-bg-raised px-3 text-sm text-text-muted hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                {expanded ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
                {expanded ? "ซ่อนประกาศอื่น" : `ดูประกาศอื่นอีก ${more.length} รายการ`}
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function AnnouncementPopup() {
  return (
    <SilentBoundary>
      <Popup />
    </SilentBoundary>
  );
}
