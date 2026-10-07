import { roundRectPath } from "./draw";
import { COLORS, LOGO_URL } from "./theme";
import type { ImageStore } from "./types";

/**
 * วาดโลโก้ RovLab ลงกรอบ size×size (คงอัตราส่วน ไม่ crop)
 * ถ้าโหลดโลโก้ไม่ได้ จะวาดกรอบสีหลักแทน เพื่อให้ตำแหน่งหัวรูปไม่เพี้ยน
 */
export function drawLogo(ctx: CanvasRenderingContext2D, images: ImageStore, x: number, y: number, size: number) {
  const img = images.get(LOGO_URL);
  if (!img) {
    roundRectPath(ctx, x, y, size, size, Math.round(size * 0.2));
    ctx.fillStyle = COLORS.accent;
    ctx.fill();
    return;
  }
  const w = "naturalWidth" in img ? img.naturalWidth : img.width;
  const h = "naturalHeight" in img ? img.naturalHeight : img.height;
  const s = Math.min(size / w, size / h);
  const dw = w * s;
  const dh = h * s;
  ctx.drawImage(img, x + (size - dw) / 2, y + (size - dh) / 2, dw, dh);
}
