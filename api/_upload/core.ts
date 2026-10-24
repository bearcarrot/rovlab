// Upload logic for /api/upload (R2). Pure + dependency-injected so it can be tested without R2 or Supabase.
// Security model: every request needs a Supabase session that is_admin(); keys are built here (never taken from the client);
// only announcements/<uuid>.<ext> may be deleted. Avatars do NOT go through here (supabase/functions/avatar owns them).

export type Mime = "image/jpeg" | "image/png" | "image/webp" | "image/svg+xml";
const EXT: Record<Mime, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/svg+xml": "svg" };

// Folder names = the admin table names the old Supabase uploads used under the hero-icons bucket.
export const CATALOG_FOLDERS = new Set([
  "heroes", "hero_roles", "hero_lanes", "hero_abilities", "items", "rune", "guides",
  "challenger_spells", "enchantments", "enchantment_trees",
]);
// shortcut: Vercel functions cap request bodies at ~4.5 MB, so catalog images stop at 4 MB; move to presigned PUT if larger files are needed.
export const MAX_CATALOG_BYTES = 4_000_000;
export const MAX_ANNOUNCEMENT_BYTES = 2_097_152;

export type AdminCheck = "admin" | "member" | "anon" | "error";
export type Deps = {
  publicBase: string; // https://assets.rovlab.app
  checkAdmin(token: string): Promise<AdminCheck>; // Supabase is_admin() called with the caller's own JWT
  put(key: string, body: Uint8Array, contentType: string): Promise<boolean>; // false = failed or key already exists
  remove(key: string): Promise<boolean>;
  now(): number;
  uuid(): string;
};

const MESSAGE: Record<string, string> = {
  UNAUTHENTICATED: "กรุณาเข้าสู่ระบบใหม่",
  FORBIDDEN: "ไม่มีสิทธิ์อัปโหลด (ต้องเป็นแอดมิน)",
  BAD_REQUEST: "คำขอไม่ถูกต้อง",
  BAD_TYPE: "รองรับเฉพาะไฟล์ JPEG, PNG, WebP หรือ SVG",
  BAD_CONTENT: "เนื้อไฟล์ไม่ตรงกับชนิดไฟล์ที่เลือก",
  TOO_LARGE: "ไฟล์ใหญ่เกินไป",
  EMPTY: "ไฟล์ว่างเปล่า",
  NOT_OWN_URL: "URL นี้ไม่ใช่รูปที่ระบบจัดการ",
  UPLOAD_FAILED: "อัปโหลดรูปไม่สำเร็จ",
  AUTH_UNAVAILABLE: "ตรวจสอบสิทธิ์ไม่สำเร็จ ลองใหม่อีกครั้ง",
};
const STATUS: Record<string, number> = {
  UNAUTHENTICATED: 401, FORBIDDEN: 403, BAD_REQUEST: 400, BAD_TYPE: 415, BAD_CONTENT: 415,
  TOO_LARGE: 413, EMPTY: 400, NOT_OWN_URL: 400, UPLOAD_FAILED: 502, AUTH_UNAVAILABLE: 503,
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const fail = (code: string) => json(STATUS[code] ?? 500, { error: code, message: MESSAGE[code] ?? code });

const startsWith = (b: Uint8Array, sig: number[], at = 0) => b.length >= at + sig.length && sig.every((v, i) => b[at + i] === v);
export function sniff(b: Uint8Array): Mime | null {
  if (startsWith(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}
// SVG is allowed for admin catalog icons only (the old flow accepted it). Reject anything that can run script.
const SVG_OK = /^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*(?:<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i;
const SVG_BAD = /<script|javascript:|<foreignObject|<iframe|<embed|\son[a-z]+\s*=/i;
export const svgIsSafe = (text: string) => SVG_OK.test(text) && !SVG_BAD.test(text);

// File name part of the key: letters, digits, _ and - only (no dots/slashes), extension comes from the validated MIME type.
export function safeStem(name: string | null): string {
  const stem = (name ?? "").replace(/\.[^.]*$/, "").replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
  return stem || "image";
}

const enc = (key: string) => key.split("/").map(encodeURIComponent).join("/");
export const publicUrl = (base: string, key: string) => `${base.replace(/\/+$/, "")}/${enc(key)}`;

const ANN_RE = /^\/(announcements\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp))$/;
// Only our own domain + our own announcement naming scheme can ever map to a deletable key.
export function announcementKeyFromUrl(url: string, base: string): string | null {
  try {
    const u = new URL(url.trim());
    if (u.origin !== new URL(base).origin) return null;
    return ANN_RE.exec(u.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function handleUpload(req: Request, d: Deps): Promise<Response> {
  if (req.method !== "POST" && req.method !== "DELETE") return json(405, { error: "METHOD_NOT_ALLOWED" });
  const token = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!token) return fail("UNAUTHENTICATED");
  const who = await d.checkAdmin(token); // authorise BEFORE looking at the body so strangers learn nothing about validation
  if (who === "anon") return fail("UNAUTHENTICATED");
  if (who === "error") return fail("AUTH_UNAVAILABLE");
  if (who !== "admin") return fail("FORBIDDEN");

  const q = new URL(req.url).searchParams;

  if (req.method === "DELETE") {
    const key = announcementKeyFromUrl(q.get("url") ?? "", d.publicBase);
    if (key === null) return fail("NOT_OWN_URL");
    return json(200, { removed: await d.remove(key).catch(() => false) });
  }

  const kind = q.get("kind");
  const folder = q.get("folder") ?? "";
  if (kind !== "catalog" && kind !== "announcement") return fail("BAD_REQUEST");
  if (kind === "catalog" && !CATALOG_FOLDERS.has(folder)) return fail("BAD_REQUEST");

  const max = kind === "catalog" ? MAX_CATALOG_BYTES : MAX_ANNOUNCEMENT_BYTES;
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > max) return fail("TOO_LARGE");
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length === 0) return fail("EMPTY");
  if (bytes.length > max) return fail("TOO_LARGE");

  const claimed = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase() as Mime;
  if (!(claimed in EXT) || (kind === "announcement" && claimed === "image/svg+xml")) return fail("BAD_TYPE");
  const actual = claimed === "image/svg+xml" ? (svgIsSafe(new TextDecoder().decode(bytes)) ? claimed : null) : sniff(bytes);
  if (actual !== claimed) return fail("BAD_CONTENT");

  const ext = EXT[claimed];
  const key =
    kind === "catalog"
      ? `hero-icons/${folder}/${d.now()}-${safeStem(q.get("name"))}.${ext}` // same folder + <timestamp>-<name> scheme the Supabase bucket used
      : `announcements/${d.uuid()}.${ext}`;

  if (!(await d.put(key, bytes, claimed).catch(() => false))) return fail("UPLOAD_FAILED"); // never return a URL for an object that is not there
  return json(200, { url: publicUrl(d.publicBase, key) });
}
