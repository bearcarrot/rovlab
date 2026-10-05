import { downloadBlob } from "./download";
import type { ShareOutcome } from "./types";

/**
 * แชร์ไฟล์ PNG ผ่าน Web Share API; ไม่รองรับ → ดาวน์โหลด
 * - ผู้ใช้กดยกเลิก (AbortError) = "cancelled" ไม่ดาวน์โหลดต่อ
 * - NotAllowedError (หมดสิทธิ์ user gesture เพราะสร้างรูปนาน เช่น iOS Safari) = "blocked"
 *   ให้ UI เก็บ blob ไว้แล้วให้ผู้ใช้แตะอีกครั้ง (เรียก shareImage ซ้ำภายใน gesture) โดยไม่ต้องสร้างรูปใหม่
 */
export async function shareImage(
  blob: Blob,
  filename: string,
  opts: { title?: string; text?: string; downloadOnBlocked?: boolean } = {}
): Promise<ShareOutcome> {
  const file = new File([blob], filename, { type: "image/png" });
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  const canShareFile = !!nav && typeof nav.share === "function" && typeof nav.canShare === "function" && nav.canShare({ files: [file] });

  if (canShareFile) {
    try {
      await nav!.share({ files: [file], title: opts.title, text: opts.text });
      return "shared";
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      if (name === "AbortError") return "cancelled";
      if (name === "NotAllowedError" && !opts.downloadOnBlocked) return "blocked";
      // ข้อผิดพลาดอื่น → ดาวน์โหลดแทน
    }
  }
  downloadBlob(blob, filename);
  return "downloaded";
}
