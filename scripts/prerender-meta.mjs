// Post-build: สร้าง dist/heroes/<slug>/index.html, dist/heroes/index.html และ dist/learn/<slug>/index.html
// โดยคัดลอก dist/index.html แล้วใส่ title/description/canonical/og ของแต่ละหน้า
// + เนื้อหา HTML จริง (h1, สกิล, ลิงก์ <a href>) ต่อท้าย #boot เพื่อให้ Google เห็นเนื้อหาและลิงก์โดยไม่ต้องรัน JavaScript
// (React createRoot แทนที่ #root ทั้งหมดตอนแอปเริ่มทำงาน จึงไม่มี hydration mismatch)
// และสร้าง dist/sitemap.xml ใหม่: คงหน้าใน public/sitemap.xml ไว้ แต่แทนรายการ /heroes/<slug> และ /learn/<slug> ด้วยข้อมูลจาก DB (ฮีโร่/บทความใหม่เข้า sitemap เองทุก build)
// สคริปต์นี้ไม่ทำให้ build ล้ม: ถ้าดึงข้อมูลไม่ได้จะข้ามไป (เว็บยังใช้ meta จาก JavaScript เหมือนเดิม)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const SITE = "https://rovlab.app";
const DIST = "dist";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function inject(html, { title, description, pathname, body }) {
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
    // เก็บ #boot ไว้ (สคริปต์กู้จอค้างใน index.html อ้างถึง) แล้วต่อเนื้อหา SEO ไว้ถัดไป
    (h) => (body ? h.replace(/(<div id="boot"[^>]*>[\s\S]*?<\/div>)/, (_m, a) => `${a}<main id="seo-static">${body}</main>`) : h),
  ].reduce((h, fn) => fn(h), html);
}

async function fetchRows(table, query) {
  const headers = { apikey: SUPABASE_KEY };
  // คีย์แบบใหม่ (sb_...) ไม่ใช่ JWT จึงห้ามส่งเป็น Bearer (ตรงกับ api/_share/supabase.ts)
  if (!SUPABASE_KEY.startsWith("sb_")) headers.Authorization = `Bearer ${SUPABASE_KEY}`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers });
  if (!res.ok) throw new Error(`${table}: HTTP ${res.status}`);
  return res.json();
}

async function writePage(template, pathname, meta) {
  const dir = path.join(DIST, pathname);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), inject(template, { ...meta, pathname }));
}

// ลิงก์ไปเครื่องมืออื่นของ RoV LAB (ชื่อหน้าตรงกับ RouteMeta)
const TOOL_LINKS = [
  ["/heroes", "ฮีโร่ทั้งหมด"],
  ["/tier-list", "RoV Tier List"],
  ["/counter-pick", "Counter Pick"],
  ["/matchup", "Matchup"],
  ["/draft", "Draft Assistant"],
  ["/stats", "สถิติ RoV"],
];
const toolNav = () =>
  `<nav aria-label="RoV LAB"><ul>${TOOL_LINKS.map(([href, label]) => `<li><a href="${href}">${label}</a></li>`).join("")}</ul></nav>`;

const list = (items) => (items?.length ? `<ul>${items.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : "");

// เฉพาะข้อมูลที่มีใน DB (heroes / hero_abilities) ไม่แต่งสถิติหรือข้อมูลเกมเพิ่ม
function heroBody(h, abilities, prev, next) {
  const abil = abilities.length
    ? `<h2>สกิลของ ${esc(h.name)}</h2><ul>${abilities
        .map((a) => `<li><strong>${esc(a.slot)} ${esc(a.name)}</strong>${a.description ? ` — ${esc(a.description)}` : ""}</li>`)
        .join("")}</ul>`
    : "";
  const pros = h.strengths?.length ? `<h2>จุดแข็ง</h2>${list(h.strengths)}` : "";
  const cons = h.weaknesses?.length ? `<h2>จุดอ่อน</h2>${list(h.weaknesses)}` : "";
  const pager = [
    prev ? `<a href="/heroes/${esc(prev.slug)}" rel="prev">${esc(prev.name)}</a>` : "",
    next ? `<a href="/heroes/${esc(next.slug)}" rel="next">${esc(next.name)}</a>` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return `<h1>${esc(h.name)}</h1>${h.description?.trim() ? `<p>${esc(h.description)}</p>` : ""}${abil}${pros}${cons}${pager ? `<p>${pager}</p>` : ""}${toolNav()}`;
}

function heroesIndexBody(heroes) {
  return `<h1>ฮีโร่ทั้งหมด</h1><ul>${heroes.map((h) => `<li><a href="/heroes/${esc(h.slug)}">${esc(h.name)}</a></li>`).join("")}</ul>${toolNav()}`;
}

// รายการ sitemap ของหน้าสาธารณะที่ยังไม่มีใน public/sitemap.xml (เติมให้เฉพาะที่ขาด)
const EXTRA_PAGES = [
  ["/build", "weekly", "0.6"],
  ["/game-data", "weekly", "0.6"],
  ["/contact", "yearly", "0.2"],
];

// heroes/guides = null หมายถึงดึงจาก DB ไม่สำเร็จ -> คงรายการเดิมของกลุ่มนั้นไว้ ไม่ลบทิ้ง
async function writeSitemap(heroes, guides) {
  let xml;
  try {
    xml = await readFile(path.join(DIST, "sitemap.xml"), "utf8");
  } catch {
    return false;
  }
  const entries = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];
  const isGroup = (e, group) => new RegExp(`<loc>[^<]*/${group}/[^<]+</loc>`).test(e);
  const keep = entries.filter((e) => !(heroes && isGroup(e, "heroes")) && !(guides && isGroup(e, "learn")));
  const has = (p) => keep.some((e) => e.includes(`<loc>${SITE}${p}</loc>`));
  const url = (p, rest) => `  <url><loc>${SITE}${esc(p)}</loc>${rest}</url>`;
  const out = [
    ...keep.map((e) => `  ${e}`),
    ...EXTRA_PAGES.filter(([p]) => !has(p)).map(([p, f, pr]) => url(p, `<changefreq>${f}</changefreq><priority>${pr}</priority>`)),
    ...(heroes ?? []).map((h) => url(`/heroes/${encodeURIComponent(h.slug)}`, "<priority>0.6</priority>")),
    ...(guides ?? []).map((g) => url(`/learn/${encodeURIComponent(g.slug)}`, "<priority>0.5</priority>")),
  ];
  await writeFile(
    path.join(DIST, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${out.join("\n")}\n</urlset>\n`,
  );
  return true;
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log("[prerender-meta] skipped: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set");
    return;
  }
  const template = await readFile(path.join(DIST, "index.html"), "utf8");
  let heroCount = 0;
  let guideCount = 0;
  let heroList = null;
  let guideList = null;

  try {
    const heroes = (await fetchRows("heroes", "select=id,slug,name,description,strengths,weaknesses&order=name.asc")).filter((h) => h.slug && h.name);
    heroList = heroes;
    // สกิลเป็นส่วนเสริม: ดึงไม่สำเร็จก็ยังสร้างหน้าได้ (shortcut: ~5 สกิล/ฮีโร่ ต่ำกว่าเพดาน 1000 แถวของ PostgREST, ถ้าเกินให้แบ่งหน้า)
    const abilitiesByHero = new Map();
    try {
      for (const a of await fetchRows("hero_abilities", "select=hero_id,slot,name,description&order=sort_order.asc&limit=1000")) {
        if (!abilitiesByHero.has(a.hero_id)) abilitiesByHero.set(a.hero_id, []);
        abilitiesByHero.get(a.hero_id).push(a);
      }
    } catch (e) {
      console.warn("[prerender-meta] abilities skipped:", e.message);
    }

    for (const [i, h] of heroes.entries()) {
      // HeroDetail.tsx แสดงชื่ออังกฤษ (name) ทั่วทั้งเว็บ จึงใช้ name อย่างเดียวให้ title/description ตรงกับที่ JS ตั้งภายหลัง
      await writePage(template, `/heroes/${h.slug}`, {
        title: `${h.name} \u2014 \u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14\u0e2e\u0e35\u0e42\u0e23\u0e48 RoV \u0e2a\u0e16\u0e34\u0e15\u0e34 \u0e2a\u0e01\u0e34\u0e25 \u0e04\u0e39\u0e48\u0e41\u0e1e\u0e49\u0e17\u0e32\u0e07 | RoV LAB`,
        description: `\u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14\u0e2e\u0e35\u0e42\u0e23\u0e48 ${h.name} \u0e43\u0e19 RoV: \u0e2a\u0e16\u0e34\u0e15\u0e34 Win/Pick/Ban Rate, \u0e2a\u0e01\u0e34\u0e25, \u0e08\u0e38\u0e14\u0e41\u0e02\u0e47\u0e07-\u0e08\u0e38\u0e14\u0e2d\u0e48\u0e2d\u0e19 \u0e41\u0e25\u0e30\u0e2e\u0e35\u0e42\u0e23\u0e48\u0e17\u0e35\u0e48\u0e0a\u0e19\u0e30\u0e17\u0e32\u0e07/\u0e41\u0e1e\u0e49\u0e17\u0e32\u0e07`,
        body: heroBody(h, abilitiesByHero.get(h.id) ?? [], heroes[i - 1], heroes[i + 1]),
      });
      heroCount++;
    }

    // หน้ารายชื่อ: ลิงก์ <a href> ถึงทุกฮีโร่ใน HTML ดิบ (ไม่ต้องรอ JS / ไม่ขึ้นกับตัวกรองใน localStorage)
    if (heroes.length > 0) {
      await writePage(template, "/heroes", {
        title: "ฮีโร่ RoV ทั้งหมด — สถิติ Win Rate Pick Rate Ban Rate | RoV LAB", // ตรงกับ RouteMeta
        description: "รวมฮีโร่ RoV ทุกตัว พร้อมสถิติ Win Rate, Pick Rate, Ban Rate ตำแหน่ง เลน และระดับความยาก",
        body: heroesIndexBody(heroes),
      });
    }
  } catch (e) {
    console.warn("[prerender-meta] heroes skipped:", e.message);
  }

  try {
    const guides = (await fetchRows("guides", "select=slug,title")).filter((g) => g.slug && g.title);
    guideList = guides;
    for (const g of guides) {
      await writePage(template, `/learn/${g.slug}`, {
        title: `${g.title} | RoV LAB`,
        description: `${g.title} \u2014 \u0e04\u0e39\u0e48\u0e21\u0e37\u0e2d RoV \u0e2a\u0e33\u0e2b\u0e23\u0e31\u0e1a\u0e1c\u0e39\u0e49\u0e40\u0e25\u0e48\u0e19`,
      });
      guideCount++;
    }
  } catch (e) {
    console.warn("[prerender-meta] guides skipped:", e.message);
  }

  // heroes ว่างเปล่า = น่าจะผิดปกติ (เช่น RLS/ตารางว่าง) จึงไม่แตะรายการฮีโร่เดิมใน sitemap
  const sitemapOk = await writeSitemap(heroList?.length ? heroList : null, guideList);
  console.log(`[prerender-meta] sitemap ${sitemapOk ? "updated" : "not found, left as is"}`);
  console.log(`[prerender-meta] wrote ${heroCount} hero pages, ${guideCount} guide pages`);
}

main().catch((e) => {
  console.warn("[prerender-meta] failed, continuing without prerendered meta:", e?.message ?? e);
});
