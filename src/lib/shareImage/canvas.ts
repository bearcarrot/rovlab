// Shared helpers for drawing share images on a <canvas> (no server, no extra dependency).

export type ImageFormat = "portrait" | "landscape";

export const FORMAT_SIZE: Record<ImageFormat, { w: number; h: number }> = {
  portrait: { w: 1080, h: 1350 },
  landscape: { w: 1920, h: 1080 },
};

export const FORMAT_LABEL: Record<ImageFormat, string> = {
  portrait: "แนวตั้ง (IG / Facebook)",
  landscape: "แนวนอน (Discord / X)",
};

// Same palette as tailwind.config.ts
export const COLORS = {
  bg: "#0A0B0E",
  surface: "#14161B",
  raised: "#1C1F26",
  border: "#262A33",
  text: "#F2F3F5",
  muted: "#8B909B",
  faint: "#5C616D",
  accent: "#E8A33D",
  accentFg: "#0A0B0E",
  rift: "#4C8DFF",
  win: "#3DD68C",
  loss: "#E5484D",
} as const;

// Fonts are loaded from index.html (Google Fonts). Weights used here must be among the loaded ones:
// Kanit 500/600/700, IBM Plex Sans Thai 400/500/600.
export const FONT_DISPLAY = '"Kanit", "IBM Plex Sans Thai", sans-serif';
export const FONT_BODY = '"IBM Plex Sans Thai", "Inter", sans-serif';

// Row colours for the image (more distinct than the on-screen badges so each tier reads at a glance)
export const TIER_COLORS: Record<string, string> = {
  "S+": "#E8A33D",
  S: "#E2813B",
  A: "#4C8DFF",
  B: "#3DD68C",
  C: "#8B909B",
};

export const MARGIN = 48;
export const CONTENT_TOP = 218; // below brand + title + subtitle
export const FOOTER_RESERVED = 162; // footer + its margin

export function contentRect(w: number, h: number) {
  return { x: MARGIN, y: CONTENT_TOP, w: w - MARGIN * 2, h: h - CONTENT_TOP - FOOTER_RESERVED };
}

export async function ensureFonts(): Promise<void> {
  try {
    if (!document.fonts) return;
    const sample = "กขค Aa";
    await Promise.all([
      document.fonts.load('600 40px "Kanit"', sample),
      document.fonts.load('700 40px "Kanit"', sample),
      document.fonts.load('400 24px "IBM Plex Sans Thai"', sample),
      document.fonts.load('500 24px "IBM Plex Sans Thai"', sample),
    ]);
    await document.fonts.ready;
  } catch {
    // fall back to system fonts
  }
}

const imageCache = new Map<string, HTMLImageElement>();

// crossOrigin=anonymous keeps the canvas untainted so it can be exported (needs CORS on the image host;
// Supabase public buckets send it). Resolves null when the image can't be loaded — callers draw a fallback.
export function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  const hit = imageCache.get(src);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function loadImages(urls: string[]): Promise<Map<string, HTMLImageElement | null>> {
  const unique = [...new Set(urls.filter(Boolean))];
  const entries = await Promise.all(unique.map(async (u) => [u, await loadImage(u)] as const));
  return new Map(entries);
}

export function createCanvas(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("เบราว์เซอร์นี้ไม่รองรับการสร้างรูป");
  return { canvas, ctx };
}

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  let t = text;
  while (t.length > 0 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

// Set ctx.font before calling.
export function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  return ctx.measureText(text).width <= maxW ? text : ellipsize(ctx, text, maxW);
}

// Thai has no spaces, so wrap by character but never start a line with a combining mark / following vowel
// and never end a line with a leading vowel. Set ctx.font before calling.
const NO_START = /[\u0E2F\u0E30-\u0E3A\u0E45-\u0E4E]/;
const NO_END = /[\u0E40-\u0E44]/;

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const ch of Array.from(text)) {
    if (line !== "" && ctx.measureText(line + ch).width > maxW) {
      let head = line;
      let tail = ch;
      while (head.length > 1 && (NO_START.test(tail.charAt(0)) || NO_END.test(head.charAt(head.length - 1)))) {
        tail = head.charAt(head.length - 1) + tail;
        head = head.slice(0, -1);
      }
      lines.push(head.trimEnd());
      line = tail.trimStart();
    } else {
      line += ch;
    }
  }
  if (line !== "") lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = ellipsize(ctx, kept[maxLines - 1], maxW);
  return kept;
}

// Square icon, cover-cropped, rounded. Falls back to initials when the image is missing.
export function drawIcon(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null | undefined,
  x: number,
  y: number,
  size: number,
  fallbackText: string
) {
  ctx.save();
  roundRectPath(ctx, x, y, size, size, size * 0.18);
  ctx.clip();
  if (img) {
    const s = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
    const sx = ((img.naturalWidth || img.width) - s) / 2;
    const sy = ((img.naturalHeight || img.height) - s) / 2;
    ctx.drawImage(img, sx, sy, s, s, x, y, size, size);
  } else {
    ctx.fillStyle = COLORS.raised;
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = COLORS.faint;
    ctx.font = `600 ${Math.round(size * 0.36)}px ${FONT_DISPLAY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(fallbackText.slice(0, 2).toUpperCase(), x + size / 2, y + size / 2);
  }
  ctx.restore();
}

export function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(ang) * rad;
    const y = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function todayText(): string {
  return new Date().toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

// Background, brand, title/subtitle and footer (disclaimer + site). Content goes inside contentRect(w, h).
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: { title: string; subtitle?: string; footnote?: string }
) {
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = COLORS.accent;
  ctx.fillRect(0, 0, w, 8);

  // brand + date
  roundRectPath(ctx, MARGIN, MARGIN + 4, 30, 30, 8);
  ctx.fillStyle = COLORS.accent;
  ctx.fill();
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.text;
  ctx.font = `600 30px ${FONT_DISPLAY}`;
  ctx.fillText("RovLab", MARGIN + 42, MARGIN + 31);
  ctx.textAlign = "right";
  ctx.fillStyle = COLORS.faint;
  ctx.font = `400 22px ${FONT_BODY}`;
  ctx.fillText(todayText(), w - MARGIN, MARGIN + 29);

  // title + subtitle
  const maxW = w - MARGIN * 2;
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.text;
  ctx.font = `600 56px ${FONT_DISPLAY}`;
  ctx.fillText(fitText(ctx, opts.title, maxW), MARGIN, MARGIN + 100);
  if (opts.subtitle) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = `500 26px ${FONT_BODY}`;
    ctx.fillText(fitText(ctx, opts.subtitle, maxW), MARGIN, MARGIN + 142);
  }

  // footer
  ctx.fillStyle = COLORS.border;
  ctx.fillRect(MARGIN, h - MARGIN - 98, maxW, 2);
  if (opts.footnote) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = `400 22px ${FONT_BODY}`;
    ctx.fillText(fitText(ctx, opts.footnote, maxW), MARGIN, h - MARGIN - 62);
  }
  const host = window.location.host;
  ctx.textAlign = "right";
  ctx.fillStyle = COLORS.accent;
  ctx.font = `500 22px ${FONT_BODY}`;
  ctx.fillText(host, w - MARGIN, h - MARGIN - 24);
  const hostW = ctx.measureText(host).width;
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.faint;
  ctx.font = `400 20px ${FONT_BODY}`;
  ctx.fillText(
    fitText(ctx, "ไม่ใช่ผลิตภัณฑ์ทางการของเกม · ภาพและชื่อฮีโร่เป็นของเจ้าของเกม", maxW - hostW - 24),
    MARGIN,
    h - MARGIN - 24
  );
  ctx.textAlign = "left";
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("สร้างไฟล์รูปไม่สำเร็จ"))), "image/png");
    } catch (e) {
      // SecurityError when an image without CORS tainted the canvas
      reject(e);
    }
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function canShareImage(blob: Blob, filename: string): boolean {
  try {
    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
    if (typeof nav.share !== "function" || typeof nav.canShare !== "function") return false;
    return nav.canShare({ files: [new File([blob], filename, { type: "image/png" })] });
  } catch {
    return false;
  }
}

// Opens the device share sheet with the image when supported, otherwise downloads the PNG.
// Call from a click handler with an already-generated blob (share needs a fresh user gesture).
export async function shareOrSave(blob: Blob, filename: string, title: string): Promise<"shared" | "downloaded" | "cancelled"> {
  if (canShareImage(blob, filename)) {
    try {
      await navigator.share({ files: [new File([blob], filename, { type: "image/png" })], title });
      return "shared";
    } catch (e) {
      if ((e as { name?: string } | null)?.name === "AbortError") return "cancelled";
      // share failed for another reason: fall through to download
    }
  }
  downloadBlob(blob, filename);
  return "downloaded";
}
