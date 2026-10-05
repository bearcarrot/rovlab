import { useEffect, useRef, useState } from "react";
import { Download, Image as ImageGlyph, Share2, X } from "lucide-react";
import { FORMAT_LABEL, canShareImage, downloadBlob, shareOrSave, type ImageFormat } from "@/lib/shareImage/canvas";
import { cn } from "@/lib/utils";

interface Props {
  label?: string;
  title: string; // used for the share sheet
  filenameBase: string;
  disabled?: boolean;
  formats?: ImageFormat[];
  className?: string;
  // Draws the image for the chosen format. Called when the dialog opens / the format changes.
  render: (format: ImageFormat) => Promise<Blob>;
}

// Button + preview dialog. The image is generated when the dialog opens, so the "share" tap that follows
// has a ready file (mobile browsers only allow the share sheet from a direct tap).
export function ShareImageButton({
  label = "แชร์เป็นรูป",
  title,
  filenameBase,
  disabled,
  formats = ["portrait", "landscape"],
  className,
  render,
}: Props) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ImageFormat>(formats[0]);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [note, setNote] = useState("");
  const renderRef = useRef(render);
  renderRef.current = render;
  const filename = `${filenameBase}-${format}.png`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let url: string | null = null;
    setStatus("loading");
    setBlob(null);
    setPreviewUrl(null);
    setNote("");
    renderRef
      .current(format)
      .then((b) => {
        if (cancelled) return;
        url = URL.createObjectURL(b);
        setBlob(b);
        setPreviewUrl(url);
        setStatus("ready");
      })
      .catch((e) => {
        console.error("share image failed", e);
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [open, format]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  async function onShare() {
    if (!blob) return;
    const res = await shareOrSave(blob, filename, title);
    if (res === "downloaded") setNote("บันทึกรูปลงเครื่องแล้ว");
  }

  function onDownload() {
    if (!blob) return;
    downloadBlob(blob, filename);
    setNote("บันทึกรูปลงเครื่องแล้ว");
  }

  const canShare = blob ? canShareImage(blob, filename) : false;

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border border-border bg-bg-surface px-3 py-1.5 text-xs font-medium text-text hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        <ImageGlyph className="h-3.5 w-3.5" />
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-t-card border border-border bg-bg-surface p-4 sm:rounded-card"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold">{label}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="ปิด" className="rounded-md p-1 text-text-muted hover:text-text">
                <X className="h-4 w-4" />
              </button>
            </div>

            {formats.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {formats.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    aria-pressed={format === f}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium",
                      format === f ? "border-accent bg-accent text-accent-fg" : "border-border bg-bg text-text-muted hover:text-text"
                    )}
                  >
                    {FORMAT_LABEL[f]}
                  </button>
                ))}
              </div>
            )}

            <div className="flex min-h-40 items-center justify-center rounded-lg bg-bg p-2">
              {status === "loading" && <p className="text-sm text-text-muted">กำลังสร้างรูป...</p>}
              {status === "error" && (
                <p className="px-4 text-center text-sm text-red-400">
                  สร้างรูปไม่สำเร็จ ลองใหม่อีกครั้ง (ถ้ายังไม่ได้ อาจเป็นที่รูปฮีโร่ไม่อนุญาตการโหลดข้ามโดเมน)
                </p>
              )}
              {status === "ready" && previewUrl && (
                <img src={previewUrl} alt="ตัวอย่างรูปที่จะบันทึก" className="max-h-[55vh] w-auto max-w-full rounded-md" />
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {canShare && (
                <button
                  type="button"
                  onClick={onShare}
                  disabled={status !== "ready"}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent py-2.5 text-sm font-medium text-accent-fg disabled:opacity-50"
                >
                  <Share2 className="h-4 w-4" /> แชร์
                </button>
              )}
              <button
                type="button"
                onClick={onDownload}
                disabled={status !== "ready"}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-medium disabled:opacity-50",
                  canShare ? "border border-border text-text" : "bg-accent text-accent-fg"
                )}
              >
                <Download className="h-4 w-4" /> บันทึกรูป
              </button>
            </div>
            {note && <p className="text-center text-xs text-win">{note}</p>}
            <p className="text-center text-[11px] text-text-faint">บนมือถือกดค้างที่รูปเพื่อบันทึกได้เช่นกัน</p>
          </div>
        </div>
      )}
    </>
  );
}
