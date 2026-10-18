import { useState } from "react";
import { ExternalLink, ImageOff, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Announcement } from "./types";
import { embedUrl, parseVideo } from "./media";

// Media for one announcement (spec sections 5 and 9). Presentational: no services, no stores.
// Nothing here renders HTML. Embed URLs are rebuilt from the parsed id (media.ts), never from the raw URL.

const FRAME = "w-full aspect-video overflow-hidden rounded-lg border border-border bg-bg-raised";

function Placeholder({ text }: { text: string }) {
  return (
    <div className={cn(FRAME, "flex items-center justify-center gap-2 text-sm text-text-muted")}>
      <ImageOff className="h-4 w-4" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}

function ImageMedia({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Placeholder text="ไม่สามารถแสดงรูปได้" />;
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn(FRAME, "object-cover")}
    />
  );
}

function EmbedMedia({ embedSrc, title }: { embedSrc: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  if (!playing) {
    return (
      <button
        type="button"
        onClick={() => setPlaying(true)}
        aria-label={`เล่นวิดีโอ: ${title}`}
        className={cn(FRAME, "flex items-center justify-center text-text transition-colors hover:bg-bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent")}
      >
        <span className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-fg">
          <Play className="h-4 w-4" aria-hidden="true" />
          เล่นวิดีโอ
        </span>
      </button>
    );
  }
  return (
    <iframe
      src={embedSrc}
      title={title}
      sandbox="allow-scripts allow-same-origin allow-presentation"
      allow="autoplay; encrypted-media; picture-in-picture"
      referrerPolicy="strict-origin-when-cross-origin"
      loading="lazy"
      allowFullScreen
      className={FRAME}
    />
  );
}

function DirectVideo({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Placeholder text="ไม่สามารถเล่นวิดีโอนี้ได้" />;
  return <video src={url} controls preload="none" playsInline onError={() => setFailed(true)} className={cn(FRAME, "bg-black")} />;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function MediaView({ announcement: a }: { announcement: Announcement }) {
  if (a.media_type === "none" || a.media_url === null) return null;
  if (a.media_type === "image") return <ImageMedia url={a.media_url} alt={a.title} />;
  if (a.media_type === "video") {
    const parsed = parseVideo(a.media_url);
    if (parsed === null) return <Placeholder text="ไม่รองรับวิดีโอนี้" />;
    if (parsed.kind === "direct") return <DirectVideo url={parsed.url} />;
    const embedSrc = embedUrl(parsed);
    return <EmbedMedia embedSrc={embedSrc} title={a.title} />;
  }
  // media_type === "link": the destination is media_url; the button text is link_label
  return (
    <a
      href={a.media_url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-raised px-3 py-2 text-sm text-text hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      <span className="min-w-0 truncate text-text-muted">{hostOf(a.media_url)}</span>
      <span className="flex shrink-0 items-center gap-1 font-semibold text-accent">
        {a.link_label ?? "เปิดลิงก์"}
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
      </span>
    </a>
  );
}
