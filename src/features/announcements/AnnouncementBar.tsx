import { Component, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { AnnouncementCard } from "./AnnouncementCard";
import { useAnnouncements } from "./useAnnouncements";

// Fail closed and silent: a banner problem must never replace the page with an error card (the shared ErrorBoundary would).
class SilentBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error("[AnnouncementBar]", error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Bar() {
  const { shown, more, dismiss } = useAnnouncements();
  const [expanded, setExpanded] = useState(false);

  // Loading, error and zero visible items all render nothing: no empty box.
  if (shown.length === 0) return null;

  const cards = expanded ? [...shown, ...more] : shown;
  return (
    <section aria-label="ประกาศ" className="mx-auto mb-4 w-full max-w-6xl space-y-3">
      {cards.map((a) => (
        <AnnouncementCard key={a.id} announcement={a} mode="live" onDismiss={(id) => void dismiss(id)} />
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
    </section>
  );
}

export function AnnouncementBar() {
  return (
    <SilentBoundary>
      <Bar />
    </SilentBoundary>
  );
}
