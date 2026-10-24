import { supabase } from "@/lib/supabase";

// Client side of /api/upload (docs/r2-uploads.md). The server authorises (is_admin), validates and builds the key;
// this only sends the file with the user's own session token and returns the canonical https://assets.rovlab.app/... URL.
export class UploadError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "UploadError";
    this.code = code;
  }
}

async function authHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new UploadError("UNAUTHENTICATED", "กรุณาเข้าสู่ระบบใหม่");
  return `Bearer ${token}`;
}

async function post(kind: "catalog" | "announcement", file: File, folder?: string): Promise<string> {
  const qs = new URLSearchParams({ kind, name: file.name });
  if (folder) qs.set("folder", folder);
  const res = await fetch(`/api/upload?${qs}`, {
    method: "POST",
    headers: { Authorization: await authHeader(), "Content-Type": file.type },
    body: file,
  });
  const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string; message?: string };
  if (!res.ok || typeof j.url !== "string") throw new UploadError(j.error ?? "UPLOAD_FAILED", j.message ?? "อัปโหลดรูปไม่สำเร็จ");
  return j.url;
}

// Admin catalog icons (hero-icons/<folder>/...). folder = admin table name.
export const uploadCatalogImage = (file: File, folder: string) => post("catalog", file, folder);
export const uploadAnnouncementFile = (file: File) => post("announcement", file);

// true = the object was removed. Server only accepts our own announcements/<uuid>.<ext> URLs.
export async function removeAnnouncementFile(url: string): Promise<boolean> {
  const res = await fetch(`/api/upload?${new URLSearchParams({ url })}`, { method: "DELETE", headers: { Authorization: await authHeader() } });
  if (!res.ok) return false;
  return ((await res.json().catch(() => ({}))) as { removed?: boolean }).removed === true;
}
