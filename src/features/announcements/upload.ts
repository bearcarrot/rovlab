// Client-side image checks and naming for announcement uploads (spec section 8). Pure: no runtime imports.
// Server enforcement is the bucket config + storage policies in the migration; these checks give fast, friendly feedback.
export const MAX_IMAGE_BYTES = 2_097_152;
export type ImageMime = "image/jpeg" | "image/png" | "image/webp";

const EXT: Record<ImageMime, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const OWN_URL_RE = /^https:\/\/[^/?#]+\/storage\/v1\/object\/public\/announcements\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp))(?:[?#].*)?$/;

const startsWith = (b: Uint8Array, sig: number[], at = 0): boolean => b.length >= at + sig.length && sig.every((v, i) => b[at + i] === v);

export function sniffImageType(head: Uint8Array): ImageMime | null {
  if (startsWith(head, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(head, [0x52, 0x49, 0x46, 0x46]) && startsWith(head, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp"; // "RIFF"....."WEBP"
  return null;
}

// null = acceptable; otherwise a Thai message for the admin
export function checkImageFile(file: { type: string; size: number }, head: Uint8Array): string | null {
  if (!(file.type in EXT)) return "รองรับเฉพาะไฟล์ JPEG, PNG หรือ WebP";
  if (file.size <= 0) return "ไฟล์ว่างเปล่า";
  if (file.size > MAX_IMAGE_BYTES) return "ไฟล์ต้องมีขนาดไม่เกิน 2 MB";
  if (sniffImageType(head) !== file.type) return "เนื้อไฟล์ไม่ตรงกับชนิดไฟล์ที่เลือก";
  return null;
}

// extension comes from the validated MIME type, never from the user's file name
export function objectName(mime: ImageMime, uuid: string): string {
  return `${uuid}.${EXT[mime]}`;
}

// only objects that follow our own naming scheme in our own bucket may ever be deleted
export function objectNameFromUrl(url: string): string | null {
  const m = OWN_URL_RE.exec(url.trim());
  return m ? m[1] : null;
}
