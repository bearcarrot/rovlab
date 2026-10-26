// ชนิดข้อมูลกลางของระบบสร้างรูปแชร์ (ทำงานฝั่ง Browser ล้วน ไม่มี Server)

export type ImageSource = ImageBitmap | HTMLImageElement;

/** รูปที่โหลดแล้ว: url → รูป หรือ null เมื่อโหลดไม่ได้ (เทมเพลตต้องวาด placeholder แทน) */
export type ImageStore = ReadonlyMap<string, ImageSource | null>;

/** ขั้นที่รูปล้มเหลว — "timeout" = หมดเวลาโดยไม่รู้ผล (ไม่ได้แปลว่าเซิร์ฟเวอร์ปฏิเสธ) */
export type ImageFailCode =
  | "image-load-error" // <img>.onerror — เบราว์เซอร์ไม่บอกสาเหตุ (CORS/404/decode แยกไม่ได้)
  | "fetch-network-or-cors-error" // fetch() throw โดยไม่มี response — เครือข่าย หรือ CORS (เบราว์เซอร์ซ่อนสาเหตุ)
  | "fetch-unavailable"
  | "http-error" // มี response และ !ok เท่านั้น
  | "empty-response"
  | "blob-error"
  | "image-decode-error"
  | "timeout";

export interface ImageAttempt {
  method: "image" | "fetch";
  stage: "image" | "fetch" | "response" | "blob" | "decode";
  code: ImageFailCode;
  /** "TypeError: Failed to fetch" */
  error?: string;
  ok?: boolean;
  status?: number;
  statusText?: string;
  responseType?: string;
  /** เฉพาะเมื่อ redirect (ไม่มี query) */
  responseUrl?: string;
  contentType?: string;
  /** ผล fetch แบบ no-cors หลัง fetch แบบ cors ล้ม: reachable = โฮสต์ตอบกลับ (opaque) */
  probe?: "reachable" | "unreachable";
}

/** รูปที่โหลดไม่ได้ — url ไม่มี query/hash/credentials; attempts เรียงตามลำดับที่ลอง (อันสุดท้ายคือสาเหตุที่เจาะจงที่สุด) */
export interface ImageFailure {
  url: string;
  attempts: ImageAttempt[];
  /** มีค่าเมื่อเป็นผลที่แคชไว้จากรอบก่อน (ไม่ได้ลองใหม่) */
  cachedAgeMs?: number;
}

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
  /** ความสูงตามข้อมูล (ถ้ามี ใช้แทน height) สำหรับเทมเพลตที่ยาวขึ้นตามจำนวนฮีโร่ */
  heightFor?(data: T): number;
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
  /** รายละเอียดรูปที่โหลดไม่ได้ ใช้ debug เท่านั้น */
  failedImages?: ImageFailure[];
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
