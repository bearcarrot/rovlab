// ช่วยจัดการ return URL (?next=) — รับเฉพาะ path ภายในเว็บ กัน open redirect
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  if (/^\/(login|register|forgot-password|reset-password)(\/|\?|$)/.test(raw)) return null;
  return raw;
}

// URL ที่ Supabase จะพากลับมาหลังยืนยันอีเมล / Google OAuth
export function authCallbackUrl(next?: string | null): string {
  const n = safeNext(next);
  return `${window.location.origin}/login${n ? `?next=${encodeURIComponent(n)}` : ""}`;
}

export function withNext(path: string, next: string | null): string {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}
