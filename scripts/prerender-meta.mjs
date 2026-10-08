// Post-build: สร้าง dist/heroes/<slug>/index.html และ dist/learn/<slug>/index.html
// โดยคัดลอก dist/index.html แล้วใส่ title/description/canonical/og ของแต่ละหน้า
// เพื่อให้ Google / ตัวพรีวิวลิงก์ (LINE, Facebook) เห็น meta ที่ถูกต้องทันทีโดยไม่ต้องรัน JavaScript
// สคริปต์นี้ไม่ทำให้ build ล้ม: ถ้าดึงข้อมูลไม่ได้จะข้ามไป (เว็บยังใช้ meta จาก JavaScript เหมือนเดิม)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const SITE = "https://rovlab.vercel.app";
const DIST = "dist";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function inject(html, { title, description, pathname }) {
  const url = SITE + pathname;
  const setContent = (re, value) => (h) => h.replace(re, (_m, a, b) => a + esc(value) + b);
  return [
    (h) => h.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(title)}</title>`),
    setContent(/(<meta name="description" content=")[^"]*(")/, description),
    (h) => h.replace(/(<link rel="canonical" href=")[^"]*(")/, (_m, a, b) => a + url + b),
    setContent(/(<meta property="og:title" content=")[^"]*(")/, title),
    setContent(/(<meta property="og:description" content=")[^"]*(")/, description),
    (h) => h.replace(/(<meta property="og:url" content=")[^"]*(")/, (_m, a, b) => a + url + b),
    setContent(/(<meta name="twitter:title" content=")[^"]*(")/, title),
    setContent(/(<meta name="twitter:description" content=")[^"]*(")/, description),
  ].reduce((h, fn) => fn(h), html);
}

async function fetchRows(table, select) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${select}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`${table}: HTTP ${res.status}`);
  return res.json();
}

async function writePage(template, pathname, meta) {
  const dir = path.join(DIST, pathname);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), inject(template, { ...meta, pathname }));
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log("[prerender-meta] skipped: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set");
    return;
  }
  const template = await readFile(path.join(DIST, "index.html"), "utf8");
  let heroCount = 0;
  let guideCount = 0;

  try {
    const heroes = await fetchRows("heroes", "slug,name,name_th");
    for (const h of heroes) {
      if (!h.slug) continue;
      // ถ้าชื่อไทยกับชื่ออังกฤษเหมือนกัน (เช่น Airi) ใส่แค่ครั้งเดียว (ต้องตรงกับ HeroDetail.tsx)
      const seoName = h.name_th && h.name_th !== h.name ? `${h.name_th} (${h.name})` : h.name;
      await writePage(template, `/heroes/${h.slug}`, {
        title: `${seoName} \u2014 \u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14\u0e2e\u0e35\u0e42\u0e23\u0e48 RoV \u0e2a\u0e16\u0e34\u0e15\u0e34 \u0e2a\u0e01\u0e34\u0e25 \u0e04\u0e39\u0e48\u0e41\u0e1e\u0e49\u0e17\u0e32\u0e07 | RovLab`,
        description: `\u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14\u0e2e\u0e35\u0e42\u0e23\u0e48 ${seoName} \u0e43\u0e19 RoV: \u0e2a\u0e16\u0e34\u0e15\u0e34 Win/Pick/Ban Rate, \u0e2a\u0e01\u0e34\u0e25, \u0e08\u0e38\u0e14\u0e41\u0e02\u0e47\u0e07-\u0e08\u0e38\u0e14\u0e2d\u0e48\u0e2d\u0e19 \u0e41\u0e25\u0e30\u0e2e\u0e35\u0e42\u0e23\u0e48\u0e17\u0e35\u0e48\u0e0a\u0e19\u0e30\u0e17\u0e32\u0e07/\u0e41\u0e1e\u0e49\u0e17\u0e32\u0e07`,
      });
      heroCount++;
    }
  } catch (e) {
    console.warn("[prerender-meta] heroes skipped:", e.message);
  }

  try {
    const guides = await fetchRows("guides", "slug,title");
    for (const g of guides) {
      if (!g.slug || !g.title) continue;
      await writePage(template, `/learn/${g.slug}`, {
        title: `${g.title} | RovLab`,
        description: `${g.title} \u2014 \u0e04\u0e39\u0e48\u0e21\u0e37\u0e2d RoV \u0e2a\u0e33\u0e2b\u0e23\u0e31\u0e1a\u0e1c\u0e39\u0e49\u0e40\u0e25\u0e48\u0e19`,
      });
      guideCount++;
    }
  } catch (e) {
    console.warn("[prerender-meta] guides skipped:", e.message);
  }

  console.log(`[prerender-meta] wrote ${heroCount} hero pages, ${guideCount} guide pages`);
}

main().catch((e) => {
  console.warn("[prerender-meta] failed, continuing without prerendered meta:", e?.message ?? e);
});
