import { font, text } from "./draw";
import { COLORS, LOGO_URL, SITE_LABEL } from "./theme";
import type { ImageStore } from "./types";

/**
 * วาดโลโก้ RoV LAB (แนวกว้าง) โดยกำหนด "ความสูง" ส่วนความกว้างคำนวณจากอัตราส่วนจริง (ไม่ crop ไม่บีบ)
 * คืนค่าความกว้างที่วาดจริง เพื่อให้ผู้เรียกวางข้อความถัดไปต่อท้ายได้
 * ถ้าโหลดโลโก้ไม่ได้ จะวาดข้อความ "RoV LAB" สีหลักแทน เพื่อให้หัวรูปยังมีชื่อแบรนด์และตำแหน่งไม่เพี้ยน
 */
export function drawLogo(ctx: CanvasRenderingContext2D, images: ImageStore, x: number, y: number, height: number): number {
  const img = images.get(LOGO_URL);
  if (!img) {
    const f = font(700, 30, "display");
    ctx.font = f;
    const w = Math.ceil(ctx.measureText(SITE_LABEL).width);
    text(ctx, SITE_LABEL, x, y + height * 0.62, { font: f, color: COLORS.accent });
    return w;
  }
  const w = "naturalWidth" in img ? img.naturalWidth : img.width;
  const h = "naturalHeight" in img ? img.naturalHeight : img.height;
  const dh = height;
  const dw = (w / h) * height;
  ctx.drawImage(img, x, y, dw, dh);
  return Math.ceil(dw);
}
