// Hero/catalog icons stored in Supabase Storage (bucket hero-icons) are served through the same-origin /img/* rewrite in vercel.json:
// it keeps them off Supabase's API Gateway log and lets Vercel's CDN cache them (immutable: admin uploads use unique timestamped keys, upsert:false).
// Everything that shows OR draws an icon should go through this helper so the page, the share canvas and the browser cache all use ONE URL per icon.
// Non-Supabase URLs (e.g. Cloudflare R2 https://assets.rovlab.app/...) are returned unchanged.
export const STORAGE_PREFIX = "https://mttcdaiwuasnkqlxbeqs.supabase.co/storage/v1/object/public/hero-icons/";

export const viaVercel = (url: string): string => (url.startsWith(STORAGE_PREFIX) ? `/img/${url.slice(STORAGE_PREFIX.length)}` : url);
