// ชนิดข้อมูลกลางของระบบสร้างรูปแชร์ (ทำงานฝั่ง Browser ล้วน ไม่มี Server)

export type ImageSource = ImageBitmap | HTMLImageElement;

/** รูปที่โหลดแล้ว: url → รูป หรือ null เมื่อโหลดไม่ได้ (เทมเพลตต้องวาด placeholder แทน) */
export type ImageStore = ReadonlyMap<string, ImageSource | null>;

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  images: ImageStore;
}

export interface ImageTemplate<T> {
  id: string;
  width: number;
  height: number;
  /** url ของรูปที่เทมเพลตจะวาด (ใช้โหลดล่วงหน้า) */
  collectImageUrls(data: T): string[];
  draw(rc: RenderContext, data: T): void;
}

export interface RenderOptions {
  /** ตัวคูณความละเอียด (ค่าเริ่มต้น 1 → 1080×1350 พอดี) */
  scale?: number;
  imageTimeoutMs?: number;
  fontTimeoutMs?: number;
}

export interface RenderResult {
  blob: Blob;
  width: number;
  height: number;
  /** จำนวนรูปที่โหลดไม่ได้และถูกแทนด้วย placeholder */
  missingImages: number;
  /** false = ฟอนต์บางตัวโหลดไม่ทัน ข้อความอาจใช้ฟอนต์สำรอง */
  fontsReady: boolean;
}

export type ShareOutcome = "shared" | "downloaded" | "cancelled" | "blocked";

/** ฮีโร่แบบย่อที่เทมเพลตต้องใช้ (ไม่ผูกกับ HeroSummary เพื่อให้โมดูลนี้อิสระ) */
export interface ShareHero {
  id: string;
  name: string;
  icon: string;
}
