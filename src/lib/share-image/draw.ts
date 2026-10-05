import { COLORS, FONT_BODY, FONT_DISPLAY } from "./theme";
import type { ImageSource, ImageStore } from "./types";

type Ctx = CanvasRenderingContext2D;

export const font = (weight: number, size: number, family: "display" | "body" = "body") =>
  `${weight} ${size}px ${family === "display" ? FONT_DISPLAY : FONT_BODY}`;

export function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function fillRound(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

export function text(
  ctx: Ctx,
  value: string,
  x: number,
  y: number,
  opts: { font: string; color: string; align?: CanvasTextAlign; baseline?: CanvasTextBaseline; maxWidth?: number }
) {
  ctx.font = opts.font;
  ctx.fillStyle = opts.color;
  ctx.textAlign = opts.align ?? "left";
  ctx.textBaseline = opts.baseline ?? "alphabetic";
  const v = opts.maxWidth ? truncate(ctx, value, opts.maxWidth) : value;
  ctx.fillText(v, x, y);
}

export function truncate(ctx: Ctx, value: string, maxWidth: number): string {
  if (ctx.measureText(value).width <= maxWidth) return value;
  const chars = [...value];
  while (chars.length > 1 && ctx.measureText(chars.join("") + "…").width > maxWidth) chars.pop();
  return chars.join("") + "…";
}

/** ลดขนาดฟอนต์ลงจนข้อความพอดีความกว้าง (ใช้กับชื่อ Tier List ที่ผู้ใช้ตั้งเอง) */
export function fitFontSize(ctx: Ctx, value: string, maxWidth: number, weight: number, max: number, min: number): number {
  for (let size = max; size > min; size -= 2) {
    ctx.font = font(weight, size, "display");
    if (ctx.measureText(value).width <= maxWidth) return size;
  }
  return min;
}

// ภาษาไทยไม่มีเว้นวรรคระหว่างคำ — ใช้ Intl.Segmenter ตัดคำถ้ามี ไม่มีก็ตัดทีละตัวอักษร
function segments(value: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) return [...new Seg("th", { granularity: "word" }).segment(value)].map((s) => s.segment);
  return [...value];
}

export function wrapLines(ctx: Ctx, value: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  for (const para of value.split("\n")) {
    let line = "";
    for (const seg of segments(para)) {
      const next = line + seg;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line.trimEnd());
        line = seg.trimStart();
      } else {
        line = next;
      }
    }
    lines.push(line.trimEnd());
    if (lines.length >= maxLines) break;
  }
  if (lines.length > maxLines || (lines.length === maxLines && value.split("\n").join("").length > lines.join("").length + 2)) {
    const cut = lines.slice(0, maxLines);
    cut[maxLines - 1] = truncate(ctx, cut[maxLines - 1] + "…", maxWidth);
    return cut;
  }
  return lines.slice(0, maxLines);
}

export function drawHeroIcon(
  ctx: Ctx,
  images: ImageStore,
  hero: { name: string; icon: string },
  x: number,
  y: number,
  size: number,
  radius = Math.round(size * 0.18)
) {
  const img: ImageSource | null | undefined = hero.icon ? images.get(hero.icon) : null;
  ctx.save();
  roundRectPath(ctx, x, y, size, size, radius);
  ctx.clip();
  if (img) {
    // cover: crop ให้เต็มช่องสี่เหลี่ยมจัตุรัส
    const w = "naturalWidth" in img ? img.naturalWidth : img.width;
    const h = "naturalHeight" in img ? img.naturalHeight : img.height;
    const side = Math.min(w, h);
    ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, x, y, size, size);
  } else {
    ctx.fillStyle = COLORS.raised;
    ctx.fillRect(x, y, size, size);
    text(ctx, hero.name.slice(0, 2).toUpperCase(), x + size / 2, y + size / 2, {
      font: font(600, Math.max(12, Math.round(size * 0.34)), "display"),
      color: COLORS.faint,
      align: "center",
      baseline: "middle",
    });
  }
  ctx.restore();
  roundRectPath(ctx, x, y, size, size, radius);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.stroke();
}

export function drawEmptySlot(ctx: Ctx, x: number, y: number, size: number) {
  ctx.save();
  roundRectPath(ctx, x, y, size, size, Math.round(size * 0.18));
  ctx.setLineDash([6, 5]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = COLORS.border;
  ctx.stroke();
  ctx.restore();
}

function starPath(ctx: Ctx, cx: number, cy: number, outer: number) {
  const inner = outer * 0.45;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** วาดดาวด้วย path (ไม่พึ่งอักษร ★ ที่บางฟอนต์ไม่มี) */
export function drawStars(ctx: Ctx, x: number, y: number, filled: number, total = 5, size = 11) {
  for (let i = 0; i < total; i++) {
    starPath(ctx, x + size + i * (size * 2 + 3), y, size);
    if (i < filled) {
      ctx.fillStyle = COLORS.accent;
      ctx.fill();
    } else {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = COLORS.border;
      ctx.stroke();
    }
  }
}

export function drawBackground(ctx: Ctx, w: number, h: number) {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w * 0.85, 0, 0, w * 0.85, 0, w * 0.9);
  g.addColorStop(0, "rgba(232,163,61,0.16)");
  g.addColorStop(1, "rgba(232,163,61,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
