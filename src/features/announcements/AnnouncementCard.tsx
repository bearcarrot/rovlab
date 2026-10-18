import { AlertTriangle, ExternalLink, Info, Megaphone, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Announcement, Priority } from "./types";
import { MediaView } from "./MediaView";

// One announcement (spec sections 5 and 9). PRESENTATIONAL ONLY: no services, stores or hooks, so the admin preview can render
// exactly what visitors see without any chance of mutating data. In mode "preview" the dismiss controls are shown but inert.

const STYLE: Record<Priority, { box: string; label: string; text: string; Icon: typeof Info }> = {
  normal: { box: "border-border bg-bg-surface", label: "ประกาศ", text: "text-text-muted", Icon: Megaphone },
  important: { box: "border-accent/60 bg-accent/10", label: "สำคัญ", text: "text-accent", Icon: Info },
  urgent: { box: "border-loss/70 bg-loss/10", label: "ด่วน", text: "text-loss", Icon: AlertTriangle },
};

type Props = {
  announcement: Announcement;
  mode: "live" | "preview";
  onDismiss?: (id: string) => void;
  // The popup has its own close button (closes for this visit only); hiding the card's X avoids a second, permanent-dismiss X next to it.
  hideCloseButton?: boolean;
};

export function AnnouncementCard({ announcement: a, mode, onDismiss, hideCloseButton = false }: Props) {
  const live = mode === "live" && onDismiss !== undefined;
  const style = STYLE[a.priority];
  const hasMedia = a.media_type !== "none" && a.media_url !== null;
  const titleId = `announcement-title-${a.id}`;

  return (
    <article
      aria-labelledby={titleId}
      role={a.priority === "urgent" ? "alert" : undefined}
      className={cn("rounded-card border p-4 shadow-card", style.box)}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", style.text)}>
            <style.Icon className="h-4 w-4" aria-hidden="true" />
            {style.label}
          </span>
          {mode === "preview" && (
            <span className="rounded-md border border-border bg-bg-raised px-2 py-0.5 text-xs font-semibold text-text-muted">ตัวอย่าง</span>
          )}
        </div>
        {a.is_dismissible && !hideCloseButton && (
          <button
            type="button"
            aria-label="ปิดประกาศ"
            aria-disabled={!live || undefined}
            disabled={!live}
            onClick={live ? () => onDismiss(a.id) : undefined}
            className="rounded-md p-1 text-text-muted hover:bg-bg-raised hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className={cn("grid gap-3", hasMedia && "sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]")}>
        <div className="min-w-0">
          <h3 id={titleId} className="font-display text-base font-semibold text-text break-words">
            {a.title}
          </h3>
          {a.content !== "" && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-text-muted">{a.content}</p>}
          {a.link_url !== null && (
            <a
              href={a.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {a.link_label ?? "ดูเพิ่มเติม"}
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          )}
        </div>
        {hasMedia && <MediaView announcement={a} />}
      </div>

      {a.is_dismissible && (
        <label className={cn("mt-3 inline-flex items-center gap-2 text-xs text-text-muted", live ? "cursor-pointer" : "cursor-not-allowed opacity-60")}>
          <input
            type="checkbox"
            checked={false}
            aria-disabled={!live || undefined}
            disabled={!live}
            onChange={live ? () => onDismiss(a.id) : undefined}
            className="h-4 w-4 accent-[#E8A33D]"
          />
          ซ่อนประกาศนี้
        </label>
      )}
    </article>
  );
}
