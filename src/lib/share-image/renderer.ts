import { imageFailure, loadImages } from "./assets";
import { ensureFonts } from "./fonts";
import { LOGO_URL } from "./theme";
import type { ImageStore, ImageTemplate, RenderOptions, RenderResult } from "./types";

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))), "image/png");
    } catch (e) {
      reject(e);
    }
  });
}

function paint<T>(template: ImageTemplate<T>, data: T, images: ImageStore, scale: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(template.width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("เบราว์เซอร์ไม่รองรับ Canvas");
  ctx.scale(scale, scale);
  ctx.imageSmoothingQuality = "high";
  template.draw({ ctx, width: template.width, height, images }, data);
  return canvas;
}

/**
 * Input → Template → Canvas → PNG Blob
 * ลำดับ: โหลดรูป → โหลดฟอนต์ → วาด → export
 * รูปโหลดไม่ได้ = placeholder (ไม่ล้มทั้งงาน); ถ้า export ล้มเพราะ canvas ถูก taint จะวาดใหม่แบบไม่ใช้รูปภายนอก
 * โลโก้ RoV LAB โหลดให้ทุก template เสมอ (same-origin จึงไม่ทำให้ canvas taint และคงอยู่ในรูปสำรองด้วย)
 * ความสูงรูป = template.heightFor(data) ถ้ามี ไม่งั้น template.height
 * รูปที่โหลดไม่ได้จะ console.warn หนึ่งครั้งต่อการ export (host+path+สาเหตุ ไม่มี query string)
 */
export async function renderImage<T>(template: ImageTemplate<T>, data: T, opts: RenderOptions = {}): Promise<RenderResult> {
  const scale = opts.scale ?? 1;
  const height = template.heightFor?.(data) ?? template.height;
  const [images, fontsReady] = await Promise.all([
    loadImages([LOGO_URL, ...template.collectImageUrls(data)], { timeoutMs: opts.imageTimeoutMs }),
    ensureFonts(undefined, opts.fontTimeoutMs),
  ]);
  const failed = [...images].filter(([url, v]) => url !== LOGO_URL && v === null).map(([url]) => url);
  const missingImages = failed.length;
  if (missingImages) {
    console.warn(`[share-image] ${missingImages} image(s) fell back to placeholder`, failed.slice(0, 5).map(imageFailure));
  }

  try {
    const blob = await canvasToBlob(paint(template, data, images, scale, height));
    return { blob, width: Math.round(template.width * scale), height: Math.round(height * scale), missingImages, fontsReady };
  } catch (e) {
    console.warn("[share-image] export failed (canvas tainted?); re-rendering without remote images", e);
    // สำรอง: วาดซ้ำโดยไม่ใส่รูปภายนอกเลย (placeholder ทั้งหมด แต่คงโลโก้ไว้) ดีกว่าไม่ได้รูป
    const logoOnly: ImageStore = new Map([[LOGO_URL, images.get(LOGO_URL) ?? null]]);
    const blob = await canvasToBlob(paint(template, data, logoOnly, scale, height));
    return {
      blob,
      width: Math.round(template.width * scale),
      height: Math.round(height * scale),
      missingImages: Math.max(0, images.size - 1),
      fontsReady,
    };
  }
}
