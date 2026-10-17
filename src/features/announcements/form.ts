import type { MediaType, Priority } from "./types";

// No runtime imports: media/time helpers are injected so this module stays testable with node --experimental-strip-types.
export type FormValues = {
  title: string;
  content: string;
  mediaType: MediaType;
  mediaUrl: string;
  linkUrl: string;
  linkLabel: string;
  priority: Priority;
  isDismissible: boolean;
  startsLocal: string; // "YYYY-MM-DDTHH:mm" in Asia/Bangkok, "" = none
  endsLocal: string;
};

// Parameters of admin_save_announcement without p_id.
export type SaveInput = {
  title: string;
  content: string;
  mediaType: MediaType;
  mediaUrl: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  priority: Priority;
  isDismissible: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

export type FormDeps = {
  mediaError: (i: { mediaType: MediaType; mediaUrl: string | null; linkUrl: string | null; linkLabel: string | null }) => string | null;
  bangkokLocalToIso: (local: string) => string;
};

export type FormResult = { ok: true; input: SaveInput } | { ok: false; errors: Partial<Record<keyof FormValues, string>> };

export const ERROR_TH: Record<string, string> = {
  FORBIDDEN: "คุณไม่มีสิทธิ์ทำรายการนี้",
  NOT_FOUND: "ไม่พบประกาศ",
  INVALID_TITLE: "ชื่อประกาศต้องมี 1–120 ตัวอักษร",
  INVALID_CONTENT: "เนื้อหายาวเกิน 4000 ตัวอักษร",
  INVALID_PRIORITY: "ระดับความสำคัญไม่ถูกต้อง",
  INVALID_SCHEDULE: "เวลาไม่ถูกต้อง หรือเวลาสิ้นสุดไม่อยู่หลังเวลาเริ่ม",
  INVALID_STATUS: "สถานะไม่ถูกต้อง",
  INVALID_TRANSITION: "เปลี่ยนสถานะแบบนี้ไม่ได้ (กู้คืนเป็นฉบับร่างก่อน)",
  ALREADY_EXPIRED: "ประกาศนี้หมดอายุแล้ว",
  TOO_MANY_IDS: "จำนวนรายการมากเกินไป",
  MEDIA_NOT_ALLOWED: "ประกาศแบบไม่มีสื่อห้ามใส่ลิงก์สื่อ",
  MEDIA_URL_REQUIRED: "ต้องระบุลิงก์สื่อ",
  MEDIA_URL_INVALID: "ลิงก์ต้องเป็น https:// ที่ถูกต้อง",
  VIDEO_UNSUPPORTED: "รองรับเฉพาะ YouTube, Vimeo หรือไฟล์ .mp4/.webm/.ogv",
  LINK_URL_NOT_ALLOWED: "ประกาศแบบลิงก์ใช้ปลายทางจากช่องลิงก์สื่อเท่านั้น",
  LABEL_WITHOUT_LINK: "มีข้อความปุ่มแต่ไม่มีลิงก์",
  LABEL_TOO_LONG: "ข้อความปุ่มยาวเกิน 40 ตัวอักษร",
};

const TITLE_MAX = 120;
const CONTENT_MAX = 4000;

// Postgres char_length counts code points; JS .length counts UTF-16 units (emoji = 2). Always count code points.
export function codePointLength(s: string): number {
  return Array.from(s).length;
}

export function switchMediaType(v: FormValues, next: MediaType): FormValues {
  const out = { ...v, mediaType: next };
  if (next === "none") out.mediaUrl = "";
  if (next === "link") out.linkUrl = "";
  return out;
}

const orNull = (s: string): string | null => (s.trim() === "" ? null : s.trim());

export function validateForm(v: FormValues, deps: FormDeps): FormResult {
  const errors: Partial<Record<keyof FormValues, string>> = {};
  const title = v.title.trim();
  const content = v.content.trim();
  const mediaUrl = orNull(v.mediaUrl);
  const linkUrl = orNull(v.linkUrl);
  const linkLabel = orNull(v.linkLabel);

  if (codePointLength(title) < 1 || codePointLength(title) > TITLE_MAX) errors.title = ERROR_TH.INVALID_TITLE;
  if (codePointLength(content) > CONTENT_MAX) errors.content = ERROR_TH.INVALID_CONTENT;

  const code = deps.mediaError({ mediaType: v.mediaType, mediaUrl, linkUrl, linkLabel });
  if (code !== null) {
    const message = ERROR_TH[code] ?? code;
    if (code === "LINK_URL_NOT_ALLOWED") errors.linkUrl = message;
    else if (code === "LABEL_WITHOUT_LINK" || code === "LABEL_TOO_LONG") errors.linkLabel = message;
    else if (code === "MEDIA_URL_INVALID" && deps.mediaError({ mediaType: v.mediaType, mediaUrl, linkUrl: null, linkLabel: null }) === null) errors.linkUrl = message;
    else errors.mediaUrl = message;
  }

  let startsAt: string | null = null;
  let endsAt: string | null = null;
  if (v.startsLocal.trim() !== "") {
    try { startsAt = deps.bangkokLocalToIso(v.startsLocal.trim()); } catch { errors.startsLocal = ERROR_TH.INVALID_SCHEDULE; }
  }
  if (v.endsLocal.trim() !== "") {
    try { endsAt = deps.bangkokLocalToIso(v.endsLocal.trim()); } catch { errors.endsLocal = ERROR_TH.INVALID_SCHEDULE; }
  }
  if (startsAt !== null && endsAt !== null && Date.parse(endsAt) <= Date.parse(startsAt)) errors.endsLocal = ERROR_TH.INVALID_SCHEDULE;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    input: { title, content, mediaType: v.mediaType, mediaUrl, linkUrl, linkLabel, priority: v.priority, isDismissible: v.isDismissible, startsAt, endsAt },
  };
}
