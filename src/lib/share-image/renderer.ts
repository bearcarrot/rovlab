import { loadImages } from "./assets";
import { ensureFonts } from "./fonts";
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

function paint<T>(template: ImageTemplate<T>, data: T, images: ImageStore, scale: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(template.width * scale);
  canvas.height = Math.round(template.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("เบราว์เซอร์ไม่รองรับ Canvas");
  ctx.scale(scale, scale);
  ctx.imageSmoothingQuality = "high";
  template.draw({ ctx, width: template.width, height: template.height, images }, data);
  return canvas;
}

/**
 * Input → Template → Canvas → PNG Blob
 * ลำดับ: โหลดรูป → โหลดฟอนต์ → วาด → export
 * รูปโหลดไม่ได้ = placeholder (ไม่ล้มทั้งงาน); ถ้า export ล้มเพราะ canvas ถูก taint จะวาดใหม่แบบไม่ใช้รูปภายนอก
 */
export async function renderImage<T>(template: ImageTemplate<T>, data: T, opts: RenderOptions = {}): Promise<RenderResult> {
  const scale = opts.scale ?? 1;
  const [images, fontsReady] = await Promise.all([
    loadImages(template.collectImageUrls(data), { timeoutMs: opts.imageTimeoutMs }),
    ensureFonts(undefined, opts.fontTimeoutMs),
  ]);
  const missingImages = [...images.values()].filter((v) => v === null).length;

  try {
    const blob = await canvasToBlob(paint(template, data, images, scale));
    return { blob, width: Math.round(template.width * scale), height: Math.round(template.height * scale), missingImages, fontsReady };
  } catch {
    // สำรอง: วาดซ้ำโดยไม่ใส่รูปภายนอกเลย (placeholder ทั้งหมด) ดีกว่าไม่ได้รูป
    const blob = await canvasToBlob(paint(template, data, new Map(), scale));
    return {
      blob,
      width: Math.round(template.width * scale),
      height: Math.round(template.height * scale),
      missingImages: images.size,
      fontsReady,
    };
  }
}
