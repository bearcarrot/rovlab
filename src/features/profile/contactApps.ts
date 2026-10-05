import type { ContactAppId, ContactLink } from "@/types/profile";

// Preset apps and their OFFICIAL hosts. Keep in sync with public.contact_url_ok() in
// supabase/migrations/20261005_profile_contact_links.sql — the DB is the final gate.
export interface ContactApp {
  id: ContactAppId;
  label: string;
  hosts: string[];
  placeholder: string;
}

export const CONTACT_APPS: ContactApp[] = [
  { id: "line", label: "LINE", hosts: ["line.me", "lin.ee"], placeholder: "https://line.me/ti/p/~ไอดีของคุณ" },
  {
    id: "facebook",
    label: "Facebook",
    hosts: ["facebook.com", "www.facebook.com", "m.facebook.com", "fb.com", "www.fb.com", "fb.me"],
    placeholder: "https://www.facebook.com/ชื่อผู้ใช้",
  },
  { id: "discord", label: "Discord", hosts: ["discord.gg", "discord.com", "www.discord.com"], placeholder: "https://discord.gg/รหัสเชิญ" },
  { id: "instagram", label: "Instagram", hosts: ["instagram.com", "www.instagram.com"], placeholder: "https://www.instagram.com/ชื่อผู้ใช้" },
  { id: "tiktok", label: "TikTok", hosts: ["tiktok.com", "www.tiktok.com"], placeholder: "https://www.tiktok.com/@ชื่อผู้ใช้" },
  {
    id: "youtube",
    label: "YouTube",
    hosts: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"],
    placeholder: "https://www.youtube.com/@ชื่อช่อง",
  },
  { id: "x", label: "X (Twitter)", hosts: ["x.com", "www.x.com", "twitter.com", "www.twitter.com"], placeholder: "https://x.com/ชื่อผู้ใช้" },
  { id: "twitch", label: "Twitch", hosts: ["twitch.tv", "www.twitch.tv"], placeholder: "https://www.twitch.tv/ชื่อผู้ใช้" },
  { id: "telegram", label: "Telegram", hosts: ["t.me", "telegram.me"], placeholder: "https://t.me/ชื่อผู้ใช้" },
];

export const CONTACT_URL_MAX = 200;

const BY_ID = new Map<string, ContactApp>(CONTACT_APPS.map((a) => [a.id, a]));

export function getContactApp(id: ContactAppId): ContactApp {
  return BY_ID.get(id) as ContactApp;
}

export function isContactAppId(v: string): v is ContactAppId {
  return BY_ID.has(v);
}

// Reads the jsonb column defensively (unknown shape -> only well-formed entries).
export function parseContactLinks(raw: unknown): ContactLink[] {
  if (!Array.isArray(raw)) return [];
  const out: ContactLink[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { app, url } = item as Record<string, unknown>;
    if (typeof app === "string" && typeof url === "string" && isContactAppId(app)) out.push({ app, url });
  }
  return out;
}

export type ContactUrlResult = { ok: true; url: string } | { ok: false; error: string };

const PATH_RE = /^[A-Za-z0-9._~%@:+=,/-]+$/;
const PATH_START_RE = /^\/+[A-Za-z0-9@%~]/;
const FB_HOST_RE = /^(www\.|m\.)?facebook\.com$/;

// Accepts only https URLs on the app's official hosts that point at a path (not the home page).
// No port, userinfo, #fragment or ?query (blocks redirect shims) — except Facebook profile.php?id=<digits>.
// Returns the normalized URL to store.
export function validateContactUrl(appId: ContactAppId, raw: string): ContactUrlResult {
  const app = getContactApp(appId);
  const fail = (error: string): ContactUrlResult => ({ ok: false, error });

  let s = raw.trim();
  if (!s) return fail("กรุณาวางลิงก์");
  if (/\s/.test(s)) return fail("ลิงก์ต้องไม่มีช่องว่าง");
  if (s.length > CONTACT_URL_MAX) return fail(`ลิงก์ยาวเกิน ${CONTACT_URL_MAX} ตัวอักษร`);
  if (/^http:\/\//i.test(s)) return fail("ลิงก์ต้องขึ้นต้นด้วย https://");
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`;

  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return fail("รูปแบบลิงก์ไม่ถูกต้อง");
  }

  if (u.protocol !== "https:") return fail("ลิงก์ต้องขึ้นต้นด้วย https://");
  if (u.username || u.password) return fail("ลิงก์ต้องไม่มีชื่อผู้ใช้หรือรหัสผ่านแฝงอยู่");
  if (u.port) return fail("ลิงก์ต้องไม่ระบุพอร์ต");
  if (!app.hosts.includes(u.hostname)) {
    return fail(`ต้องเป็นลิงก์ทางการของ ${app.label} เท่านั้น (${app.hosts.join(", ")})`);
  }
  if (u.hash) return fail("ลิงก์ต้องไม่มี # ต่อท้าย ให้ตัดส่วนนั้นออก");

  if (app.id === "facebook" && FB_HOST_RE.test(u.hostname) && u.pathname === "/profile.php") {
    const id = u.searchParams.get("id");
    const keys = Array.from(u.searchParams.keys());
    if (!id || !/^\d{5,25}$/.test(id) || keys.length !== 1) {
      return fail("ลิงก์โปรไฟล์ Facebook แบบ profile.php ต้องมีเฉพาะ ?id=ตัวเลข");
    }
    return { ok: true, url: `https://${u.hostname}/profile.php?id=${id}` };
  }

  if (u.search) return fail("ลิงก์ต้องไม่มี ? และพารามิเตอร์ต่อท้าย ให้ตัดส่วนนั้นออก");
  if (!PATH_RE.test(u.pathname) || !PATH_START_RE.test(u.pathname)) {
    return fail(`ลิงก์ต้องชี้ไปที่โปรไฟล์หรือห้องของคุณใน ${app.label} ไม่ใช่หน้าแรก`);
  }

  const url = `https://${u.hostname}${u.pathname}`;
  if (url.length > CONTACT_URL_MAX) return fail(`ลิงก์ยาวเกิน ${CONTACT_URL_MAX} ตัวอักษร`);
  return { ok: true, url };
}
