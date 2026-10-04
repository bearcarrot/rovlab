# RoV LAB (RovLab) — RoV Companion App

Stack: React 18 + TypeScript + Vite 5 + Tailwind 3 + shadcn-style UI (Radix) + Lucide + React Router 6.
Backend: Supabase (Postgres + Auth + RLS + Storage + Edge Functions). Deploy: Vercel จาก `main` (SPA — `vercel.json` rewrite ทุก path ไป `index.html`).
Supabase project: **RoV Draft & Tier List System** (`project_id` = `mttcdaiwuasnkqlxbeqs`)

> **README นี้คือเอกสารกลางของโปรเจกต์** มีหลายคนและหลาย AI (Claude หลายตัว) แก้โค้ดและฐานข้อมูลพร้อมกัน อ่านหัวข้อ "กติกาการทำงานร่วมกัน" และ "ค้างอยู่ / เสี่ยง" ก่อนแก้อะไร
> สถานะด้านล่างตรวจจาก `main` ที่ PR #81 และฐานข้อมูลจริง เมื่อ **4 ต.ค. 2026** ตัวเลขแถวเปลี่ยนตลอดเพราะมีการแก้ข้อมูลผ่าน `/admin` ให้ใช้เป็นขนาดโดยประมาณ และ query DB จริงเมื่อต้องใช้ตัวเลขที่แน่นอน
> ถ้าคุณแก้อะไรที่ทำให้ข้อมูลในไฟล์นี้ไม่จริงอีกต่อไป ให้แก้ README ใน PR เดียวกัน

## กติกาการทำงานร่วมกัน

1. **อ่านของจริงก่อนแก้ และแตก branch จาก `main` ล่าสุดเสมอ** ก่อนแก้ไฟล์ให้เปิดเวอร์ชันล่าสุดบน `main` อย่าเขียนทั้งไฟล์ทับจากสำเนาเก่า เคยเกิดเหตุจริง: PR #63 เขียน `src/pages/Admin.tsx` ทับจากเวอร์ชันเก่า ชนกับ #56 แบบที่ Git รวมให้ได้โดยไม่ฟ้อง แต่โค้ดสองฝั่งเข้ากันไม่ได้ (ต้องแก้ใน #64) แก้เท่าที่จำเป็นแล้วดู diff ก่อน merge
2. **เช็ก PR ที่เปิดอยู่ก่อนแตะไฟล์ที่ชนกันง่าย** (`Admin.tsx`, `HeroFilters.tsx`, `services/heroes.ts`, `App.tsx`, `AppShell.tsx`, `types/*`) ตอนนี้มี PR #74 เปิดค้างอยู่ (ดู "ค้างอยู่ / เสี่ยง")
3. **`npm run build` ไม่ตรวจ type** (สคริปต์คือ `vite build`) และ `npm run lint` เรียก `eslint .` ทั้งที่ไม่มี eslint ใน `devDependencies` จึงรันไม่ได้ ก่อนเปิด PR ให้รัน `npx tsc --noEmit` เอง (ยังไม่เคยยืนยันว่า type ผ่านทั้งโปรเจกต์) แล้วดู Vercel preview ของ PR
4. **ฐานข้อมูลจริงคือความจริง** `supabase/schema.sql` ไม่ตรงกับ DB จริง และ migration หลายตัวถูกรันผ่าน Supabase โดยตรงโดยไม่มีไฟล์ใน repo (ดูหัวข้อ "Migration") ทุกการเปลี่ยน schema ต้อง: (ก) ตรวจ schema จริงก่อน (ข) เก็บไฟล์ใน `supabase/migrations/` (ค) อัปเดตหัวข้อ "Migration" ในไฟล์นี้ (ง) เขียนในหัวไฟล์ให้ชัดว่า **รันกับ DB จริงแล้วหรือยัง** และ **อย่ารัน migration ที่ยังไม่ผ่านการรีวิวของเจ้าของโปรเจกต์**
5. **ลำดับ deploy:** โค้ดที่อ่านคอลัมน์/ฟังก์ชันใหม่ต้องรอ migration ถูกรันก่อน ไม่งั้นหน้านั้นพังทันทีที่ Vercel deploy `main` (เกิดแล้วกับ `guides.sort_id` — ดู "ค้างอยู่ / เสี่ยง")
6. **รหัส (code) กับชื่อที่แสดง (label) แยกกัน** รหัสตำแหน่ง/เลนผูกกับ CHECK ใน DB (`heroes.role/roles/lane/lanes`, `hero_roles.code`, `hero_lanes.code`) ชื่อที่แสดง ลำดับ และไอคอนมาจาก `hero_roles` / `hero_lanes` (`label`, `sort_order`, `icon_url`) ผ่าน `services/filterIcons.ts` อย่า hardcode ชื่อในหน้าใหม่ ใช้ `useFilterLabels()` / `RoleFilterRow` / `LaneFilterRow` ใน `features/heroes/HeroFilters.tsx` การเปลี่ยนรหัสต้องทำพร้อมกันทุกจุด: migration + `types/hero.ts` + `ROLE_OPTIONS`/`LANE_OPTIONS` + ตัวเลือกใน `/admin` + `ROLE_TAGS` (`features/draft/heroTags.ts`) + `data/heroes.mock.ts` ที่เคยเปลี่ยนแล้ว: เลน `support` → `roaming`, ตำแหน่ง `marksman` → `carry` (**ตำแหน่ง `support` ยังเป็น `support`**) ค่าที่จำใน sessionStorage อาจเป็นรหัสเก่า ต้องตรวจก่อนใช้
7. **ข้อมูลต้องบอกที่มา** ไม่ทำให้ข้อมูล mock / heuristic / AI / ประมาณการ ดูเป็นข้อมูลทางการของเกม แก้ [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md) เมื่อที่มาเปลี่ยน
8. **ความลับอยู่ฝั่งเซิร์ฟเวอร์เท่านั้น** ห้ามใส่ API key ใน `VITE_*` (ถูกฝังใน bundle) service-role key ใช้ได้เฉพาะใน Edge Function
9. **UI:** mobile-first, ใช้ Tailwind token / คอมโพเนนต์เดิม, ข้อความบนหน้าจอเป็นภาษาไทย, ต้องมี loading / empty / error state, ห้ามทำให้ route เดิมและ auth พัง ตัวกรองที่ต้องจำค่าใช้ `usePersistedState` (sessionStorage) คีย์ขึ้นต้น `admin:` และ `rovlab:filter:`
10. **Commit / PR:** แยก PR ตามเรื่อง ชื่อแบบ Conventional (`feat:`, `fix:`, `docs:`, `chore:`, `data:`) ถ้าไม่ได้รัน build หรือไม่ได้ทดสอบบนเบราว์เซอร์ให้เขียนบอกใน PR ตรง ๆ รายละเอียดเพิ่มที่ [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md)

## ค้างอยู่ / เสี่ยง (อ่านก่อนรัน migration หรือ merge)

| # | เรื่อง | รายละเอียด |
|---|---|---|
| 1 | **คู่มือ `/learn` น่าจะพังบนเว็บจริง** | `main` ที่ #78–#81 ให้ `services/guides.ts` อ่าน `guides.sort_id` และ `guide_categories.sort_id` แต่ **DB จริงยังไม่มีสองคอลัมน์นี้** (migration `supabase/migrations/20261004_guides_sort_id.sql` ยังไม่ได้รัน) query จะ error และหน้า Learn ขึ้น error state ไฟล์ migration เป็นแบบเพิ่มคอลัมน์ `default 0` อย่างเดียว แต่ต้องให้เจ้าของโปรเจกต์อนุมัติก่อนรัน |
| 2 | **Auth migration ยังไม่ได้รัน** | `supabase/migrations/20261004_auth_username_verification.sql` (มากับ #71 ซึ่ง merge แล้ว) ระบุในไฟล์ว่ายังไม่ได้รันกับ Supabase ใด ๆ และ DB จริงยังไม่มี `profiles.username` / `username_available()` / `is_email_verified()` ผลตอนนี้: สมัครสมาชิกได้แต่ username ไม่ถูกบันทึกและไม่ถูกตรวจซ้ำที่ DB, policy `insert own comments` ยังไม่บังคับ `email_confirmed_at` นอกจากนี้ต้องตั้งค่าที่ Supabase Dashboard ตาม [`docs/auth-setup.md`](docs/auth-setup.md) |
| 3 | **PR #74 (เปิดค้าง) ชนกับระบบเดิมและ migration ข้อ 2** | `feat/community-comments`: ตอบกลับ, like/dislike, @mention, กระดิ่งแจ้งเตือน, รายงาน, ติดตาม, ฟีด, ตัวกรองคำหยาบ (รายละเอียดใน `docs/community.md` บน branch นั้น) migration ของมัน `20261004000000_community.sql` ยังไม่ได้รัน และ **ควรแก้ก่อนรัน**: (ก) สร้างตาราง `admins` ใหม่ + ฟังก์ชัน `is_admin(uuid)` ที่อ่าน `admins` ทั้งที่ระบบจริงใช้ `admin_users` + `is_admin()` (ไม่มีพารามิเตอร์) ซึ่งถูกใช้ใน RLS ทุกตาราง หน้าแอดมิน และ RPC นำเข้า — จะมีแหล่งความจริงของแอดมินสองที่ (ข) เพิ่ม `profiles.handle` ซ้อนกับ `profiles.username` ของข้อ 2 (ค) สร้าง policy `insert own comments` ใหม่โดยไม่มี `is_email_verified()` ถ้ารันหลัง migration ข้อ 2 เงื่อนไขยืนยันอีเมลของคอมเมนต์จะหาย (ลำดับที่ Supabase CLI รันสองไฟล์นี้ยังไม่ได้ยืนยัน) ต้องตกลงออกแบบให้เป็นชุดเดียวกันก่อนรันทั้งสองไฟล์ |
| 4 | **Edge Function ที่ deploy แล้วแต่ไม่มีซอร์สใน repo** | `mirror-hero-icons` (ดาวน์โหลดไอคอนฮีโร่จากภายนอกทีละ 20 ตัวไปเก็บใน bucket `hero-icons` แล้วแก้ `heroes.icon_url`), `import-rov-item-builds` (ดึงชุดไอเทมจาก `rov.in.th` เขียน `item_builds` / `item_build_items`) และ `make-server-b2992ca8` (เศษจาก template เดิม คู่กับตาราง `kv_store_b2992ca8`) ทั้งสามใช้ service role และตั้ง `verify_jwt = true` ซึ่งตรวจแค่ว่าเป็น JWT ของโปรเจกต์ — anon key ผ่านด้วย จึงควรถือว่าใครก็เรียกได้ ถ้าเลิกใช้แล้วควรลบ หรือเพิ่มการตรวจแอดมินและเก็บซอร์สไว้ใน `supabase/functions/` |
| 5 | **`hero_abilities.effect_tags`** | คอลัมน์ `jsonb` (ฮีล/โล่/บัฟ) ถูกเพิ่มใน DB จริงแล้ว (migration `20261004042921`) ตอนตรวจยังไม่พบไฟล์ migration นี้บน `main` ให้เช็กว่ามีใน PR ใดหรือยัง |
| 6 | **ไอคอนส่วนใหญ่เป็น hotlink** | ไอคอนฮีโร่ 109/129 ตัวชี้ไป `kg-camp.mobagarena.com` (มี 20 ตัวที่ถูกคัดลอกเข้า bucket `hero-icons`), ไอคอนสกิลชี้ไป `cdn-webth.garenanow.com` และ `kg-camp.mobagarena.com`, ไอคอนไอเทมชี้ไป `lienquan.garena.vn` (106) และ `cdn-webth.garenanow.com` (16), ไอคอนรูนชี้ไป `cdn-webth.garenanow.com` ถ้าเจ้าของ URL เปลี่ยนหรือบล็อก รูปจะหาย (UI fallback เป็นตัวอักษรย่อ) และควรตรวจสิทธิ์การใช้งานงานศิลป์เกม |
| 7 | **เอกสารบางไฟล์ล้าสมัย** | `docs/ARCHITECTURE.md` ยังระบุ `/build` เป็นหน้าหนึ่งของแอป (ตอนนี้ redirect ไปหน้าแรก) และ `docs/DATABASE.md` เป็นสแนปช็อตตัวเลขเก่า ใช้ไฟล์นี้และ DB จริงเป็นหลัก |
| 8 | **ของตกค้างใน repo** | โฟลเดอร์ `components/` ที่ root (`layout`, `ui/card.tsx`, `ui/progress.tsx`) alias `@` ชี้ไปที่ `src` จึงดูเหมือนไม่ถูกใช้ (ยังไม่ได้ตรวจทุก import), ยังไม่มี `.env.example` |

## สถานะปัจจุบัน

### ใช้ข้อมูลจริงจาก Supabase แล้ว
| ส่วน | สถานะ |
|---|---|
| ฮีโร่ (`heroes`) | 129 ตัว ทุกตัวมี `source = 'liquipedia'` และ `hero_id` (รหัสฮีโร่ในเกม ใช้จับคู่ตอนนำเข้าสถิติ) รองรับหลายตำแหน่ง/เลน: `roles` / `lanes` เป็นอาเรย์ และ trigger `heroes_sync_primary` ตั้ง `role` / `lane` = ตัวแรกของอาเรย์ให้เอง |
| ตำแหน่ง / เลน | ตำแหน่ง `assassin`, `fighter`, `mage`, `carry`, `support`, `tank` และเลน `slayer`, `jungle`, `mid`, `abyssal`, `roaming` (ชื่อไทย/อังกฤษที่แสดง ลำดับ ไอคอน อยู่ใน `hero_roles` / `hero_lanes`) |
| สกิล (`hero_abilities`) | ~560 แถว แสดงใน Hero Detail มีคอลัมน์ `icon_url` และ `effect_tags` |
| สถิติ (`hero_stats`) | 516 แถว = 2 แพตช์ (27.09, 13.08) × 2 แรงก์ (`all`, `high`) × 129 ฮีโร่ แอปอ่านแพตช์ล่าสุด (`patches.released_at`) ตามแรงก์ที่เลือกจากปุ่ม ทั้งหมด / Commander+ บน Header ฮีโร่ที่ไม่มีแถวในแรงก์นั้นขึ้น N/A นำเข้าได้จาก `/admin` → นำเข้าสถิติ (การนำเข้าไม่ทับ `tier` ที่แอดมินจัดไว้) |
| Tier List (แอดมินจัดเอง) | `tier_lists` 12 ลิสต์ (แพตช์ 27.09 × แรงก์ `all`/`high` × 5 เลน + ลิสต์ทุกเลน) และ `tier_list_entries` ~540 แถว หน้า `/tier-list` และ `hero.stat.tier` ใช้ลิสต์นี้ก่อน ลำดับ fallback: ลิสต์ของเลนหลักของฮีโร่ → ลิสต์ทุกเลน → `hero_stats.tier` ถ้ามีลิสต์ที่แอดมินจัด หน้า Tier List แสดงเฉพาะฮีโร่ในลิสต์นั้น |
| ชนะทาง / แพ้ทาง (`hero_counters`) | ~390 แถว ใช้ใน Hero Detail, Counter Pick และคะแนนแนะนำใน Draft Assistant แถวที่ระบบสร้างจากการนำเข้าสถิติมี `reason` รูปแบบ "ชนะทางอันดับ N ตามสถิติแรงก์จริง" (นำเข้าครั้งถัดไปจะอัปเดต/ลบเฉพาะแถวรูปแบบนี้ ไม่แตะแถวที่แอดมินเขียนเอง) |
| ซินเนอร์จี้ (`hero_synergies`) | 2 แถว การ์ด "ฮีโร่ที่คอมโบกับ {ชื่อ} ได้ดี" ส่วนใหญ่จึงยังว่าง |
| ปรับสมดุล (`hero_balance_changes`) | 10 แถว (buff / nerf / rework) แสดงไอคอนที่มุมขวาล่างของการ์ดฮีโร่ หน้ารายละเอียด Tier List และ Stats นำเข้าได้จาก `/admin` → นำเข้าปรับสมดุล |
| คู่มือ (`guides`, `guide_categories`) | 24 คู่มือ / 9 หมวด อ่านจาก Supabase (เรียงตาม `sort_id` แล้วระดับความยาก) ถ้าไม่ได้ตั้งค่า Supabase ใช้ mock — **ดูข้อ 1 ในตาราง "ค้างอยู่ / เสี่ยง"** |
| ไอเทม / รูน / บิลด์ | `items` ~120, `arcana` 30 (สี red/purple/green), `item_builds` 107 (ทั้งหมด `source = 'curated'` แต่ถูกนำเข้าจาก `rov.in.th` ผ่าน Edge Function ไม่ใช่ทีมงานคัดเอง), `item_build_items` ~640, `item_build_arcana` 4 **ข้อมูลอยู่ใน DB และแก้ได้ใน `/admin` แต่หน้า Item Build ถูกนำออกจากเว็บแล้ว (2 ต.ค. — `/build` redirect ไปหน้าแรก)** |
| Auth | อีเมล (ยืนยันอีเมล) + Google, สมัคร / ลืมรหัสผ่าน / ตั้งรหัสผ่านใหม่, `RequireAuth` กัน `/favorites` และ `/profile`, Guest ดูข้อมูลได้ (username ยังไม่ทำงานเต็ม — ข้อ 2) |
| Favorites / Profile | บันทึกลง Supabase (ต้องล็อกอิน) แก้โปรไฟล์ อัปโหลดรูปโปรไฟล์ผ่าน Edge Function `avatar` (ย่อรูนฝั่งไคลเอนต์ + ตรวจเนื้อหาด้วย Gemini) ฮีโร่ที่ถนัด และหน้าโปรไฟล์สาธารณะ `/players/:id` (RPC `get_public_profile`) |
| คอมเมนต์ (`comments`) | คอมเมนต์ระดับเดียวในหน้า Hero Detail ต้องล็อกอิน มี rate limit ที่ DB (trigger `comments_rate_limit_trg`) เวอร์ชันใหม่อยู่ใน PR #74 ยังไม่ merge |
| Admin (`/admin`) | `AdminHub` สลับ 3 โหมด: แก้ไขข้อมูล / นำเข้าสถิติ (`getranklist.json`) / นำเข้าปรับสมดุล (`getlatestadjustlist.json`) โหมดแก้ไขแก้ได้ 17 แท็บแบบบันทึกอัตโนมัติ: ฮีโร่, ไอคอนตำแหน่ง, ไอคอนเลน, สกิล, เคาน์เตอร์, ซินเนอร์จี้, Matchup, ไอเทม, รูน, บิลด์, ไอเทมในบิลด์, รูนในบิลด์, สถิติ, Tier List, แพตช์, คู่มือ, หมวดคู่มือ — การ์ดฮีโร่แสดงตำแหน่ง/เลน/ความยากโดยไม่ต้องกางการ์ด, แท็บที่อ้างอิงฮีโร่/ไอเทม/รูนแสดงไอคอน (สกิลและรูนเป็นวงกลม), ค้นหาชื่อฮีโร่ไทย/อังกฤษและกรองตำแหน่ง/เลนในแท็บสถิติและ Tier List, Tier List เลือกแรงก์ + แพตช์ + เลน และมีปุ่มสร้างลิสต์ที่ยังไม่มี, จำแท็บและตัวกรองที่เปิดอยู่เมื่อรีเฟรช, เลย์เอาต์ 2 คอลัมน์บนจอกว้าง อัปโหลดรูปเข้า bucket `hero-icons` สิทธิ์แอดมินเช็กจาก RPC `is_admin()` (ตาราง `admin_users`) และบังคับจริงที่ RLS |
| AI Coach (Gemini) | Edge Function `ai-coach` (v4) ต่อกับ 4 หน้า: Hero Detail, Counter Pick, Matchup, Draft Assistant (Item Build เดิมถูกนำออกพร้อมหน้า) ดู [`docs/AI_COACH.md`](docs/AI_COACH.md) |
| UX ทั่วแอป | ตัวกรองตำแหน่ง/เลน/Tier จำค่าเมื่อสลับแรงก์หรือรีเฟรช (`usePersistedState`), `ErrorBoundary` ครอบเนื้อหาหน้าและ root (กันจอดำ), กันคลิกขวา/กดค้าง/ลากรูป, ปุ่มย้อนกลับ + breadcrumb ใน route ลูก, scroll-to-top เมื่อเปลี่ยนหน้า |

### ยังเป็น mock / ยังไม่ต่อ DB
| เรื่อง | รายละเอียด |
|---|---|
| Matchup | `services/matchups.ts` ใช้ `data/matchups.mock.ts` + heuristic จาก Win Rate (มี label ทั้งสองแบบ) ตาราง `matchups` มี 1 แถวแต่ไม่ถูกอ่าน |
| Home insights | `services/insights.ts` + `data/insights.mock.ts` (การ์ด "ควรปรับปรุงอะไรก่อน") |
| บันทึกดราฟต์ / บิลด์ | `saved_drafts`, `saved_builds` ว่าง ไม่มีโค้ดใน UI ใช้ |
| Draft Assistant | ยังใช้ heuristic ตามตำแหน่ง (`ROLE_TAGS`) เป็นฐาน เพราะยังไม่มี tag ดาเมจ/CC/มือถือระดับสกิล (กำลังเริ่มมี `effect_tags` ของสกิล) เสริมด้วยคะแนนจาก counter / synergy จริงและโหมด First Pick |
| ตารางไม่ใช้ | `kv_store_b2992ca8` (ว่าง) |

## หน้าในแอป (routes)
| Path | หน้า |
|---|---|
| `/` | Home: เมต้า/แพตช์ปัจจุบัน, insight cards (mock), ทางลัด, ฮีโร่ Win Rate สูงสุด / ถูกแบนมากสุด |
| `/heroes`, `/heroes/:slug` | รายชื่อฮีโร่ (ค้นหา + กรองตำแหน่ง/เลนแบบหลายค่า) และรายละเอียด (สถิติ สกิล จุดแข็ง/อ่อน แพ้ทางใครบ้าง/ชนะทางใครได้ ฮีโร่ที่คอมโบด้วย คอมเมนต์ ปุ่มรายการโปรด ถามโค้ช AI) |
| `/tier-list` | ไอคอนล้วนจัดตาม Tier เรียง A–Z กรองตำแหน่ง/เลน/Tier ใช้ลิสต์ที่แอดมินจัด (fallback จากสถิติ) |
| `/stats` | Win / Pick / Ban Rate กรองตำแหน่ง/เลน |
| `/counter-pick` | เลือกฮีโร่ศัตรู → ฮีโร่ที่ชนะทางพร้อมเหตุผลและคำแนะนำเลน (`hero_counters`) |
| `/matchup` | เทียบฮีโร่ 2 ตัว (mock + heuristic) |
| `/draft` | Draft Assistant: เลือกทีมทีละช่อง ประเมินดาเมจ/แนวหน้า/CC/Mobility/Sustain/Early-Late แนะนำตัวถัดไป โหมด First Pick |
| `/learn`, `/learn/:slug` | คู่มือ (จาก Supabase) |
| `/favorites`, `/profile` | รายการโปรด / โปรไฟล์ตัวเอง (ต้องล็อกอิน) |
| `/players/:id` | โปรไฟล์สาธารณะ |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Auth |
| `/admin` | แอดมิน (เฉพาะบัญชีใน `admin_users`) |
| `/privacy`, `/terms`, `/disclaimer`, `/data-sources`, `/community-guidelines` | หน้ากฎหมาย/ที่มาข้อมูล |
| `/build` | redirect ไป `/` (หน้า Item Build ถูกนำออก) |

## ฐานข้อมูล (Supabase)

ทุกตารางใน schema `public` เปิด RLS ตารางเนื้อหามี policy อ่านสาธารณะ + เขียนเฉพาะแอดมิน (migration `admin_write_policies_*`) ตารางผู้ใช้ (`profiles`, `favorites`, `comments`, `saved_*`) เป็นของเจ้าของแถว `admin_users` ไม่มี policy (เข้าถึงผ่าน `is_admin()` เท่านั้น) ก่อนแก้ policy ให้ query `pg_policies` จริงเสมอ

| กลุ่ม | ตาราง |
|---|---|
| ฮีโร่ | `heroes`, `hero_roles`, `hero_lanes`, `hero_abilities` |
| สถิติ / Tier | `patches`, `hero_stats`, `tier_lists`, `tier_list_entries`, `hero_balance_changes` |
| ความสัมพันธ์ฮีโร่ | `hero_counters`, `hero_synergies`, `matchups` |
| ไอเทม / รูน / บิลด์ | `items`, `arcana`, `item_builds`, `item_build_items`, `item_build_arcana` |
| คู่มือ | `guides`, `guide_categories` |
| ผู้ใช้ | `profiles`, `favorites`, `comments`, `saved_builds`, `saved_drafts` |
| แอดมิน | `admin_users` |
| ไม่ใช้ | `kv_store_b2992ca8` |

**ฟังก์ชัน (public):** `is_admin()`, `get_public_profile(uuid)`, `list_hero_comments(text, int)`, `handle_new_user()` (trigger สร้างโปรไฟล์), `heroes_sync_primary()` (trigger), `comments_rate_limit()` (trigger), `admin_import_rank_list(patch, rank, rows, counters)` และ `admin_import_balance_changes(patch, rows)` (security definer, ตรวจ `is_admin()` ในตัว)

**Storage:** `avatars` (public, ≤ 500 KB, เขียนผ่าน Edge Function `avatar` เท่านั้น), `hero-icons` (public, ≤ 2 MB, policy `admin write hero-icons`)

**Edge Functions ที่ deploy อยู่:** `ai-coach`, `avatar` (ซอร์สอยู่ใน `supabase/functions/`), `mirror-hero-icons`, `import-rov-item-builds`, `make-server-b2992ca8` (ไม่มีซอร์สใน repo — ดูข้อ 4 ด้านบน)

### Migration
live = รันกับ DB จริงแล้ว (ดูใน `supabase_migrations.schema_migrations`), repo = มีไฟล์ใน `supabase/migrations/`

| Migration | live | repo |
|---|---|---|
| `rovlab_initial_schema`, `rovlab_rls_missed_tables`, `secure_handle_new_user`, `add_item_icon_url`, `admin_setup`, `admin_write_policies_all_content`, `admin_write_policies_builds`, `add_icon_url_abilities_arcana_and_admin_storage`, `arcana_color_and_build_arcana`, `heroes_multi_roles_lanes`, `add_hero_roles_and_lanes_icon_tables`, `heroes_game_hero_id_and_import_rpc`, `hero_balance_changes` | ✅ | ❌ ไม่มีไฟล์ (drift) |
| `comments_hardening`, `profiles_public_profile_and_avatars` (30 ก.ย.) | ✅ | ✅ |
| `import_rank_list_keep_tier`, `rename_lane_support_to_roaming`, `rename_role_marksman_to_carry` (3 ต.ค.) | ✅ | ✅ |
| `hero_abilities_effect_tags` (4 ต.ค.) | ✅ | ❌ ตอนตรวจยังไม่พบบน `main` |
| `20261004_auth_username_verification.sql` | ❌ | ✅ |
| `20261004_guides_sort_id.sql` | ❌ | ✅ |
| `20261004000000_community.sql` (PR #74 ยังไม่ merge) | ❌ | ❌ (อยู่บน branch) |

ดูโดเมนและกติกา RLS เพิ่มที่ [`docs/DATABASE.md`](docs/DATABASE.md) (ตัวเลขในไฟล์นั้นเป็นสแนปช็อตเก่า)

## โครงสร้างโค้ด
- `src/pages/*` หน้าตาม routes (`AdminHub` ห่อ `Admin` / `AdminImport` / `AdminImportBalance`)
- `src/features/*` ตรรกะ + คอมโพเนนต์ตามฟีเจอร์: `auth`, `balance`, `build` (เหลือ `BuildItemRow` ที่ไม่ได้ใช้ใน route ไหน), `comments`, `dashboard`, `draft`, `favorites`, `heroes`, `profile`, `stats`, `tierlist`
- `src/services/*` data access แยกจาก UI (`heroes`, `tierlist`, `abilities`, `balance`, `guides`, `profile`, `comments`, `favorites`, `filterIcons`, `ai`, `draft`, `items`, `matchups`, `insights`, `meta`) ส่วนที่ยังเป็น mock สลับไป Supabase ได้โดยไม่แตะคอมโพเนนต์
- `src/hooks/*`: `useAsync` (loading/error/success), `usePersistedState` (sessionStorage, ใช้ร่วมกันได้ข้ามคอมโพเนนต์), `useFavorites`
- `src/lib/*`: `supabase` (client + `isSupabaseConfigured`), `rank` (แรงก์ทั้งหมด/Commander+ จากปุ่ม Header — เปลี่ยนแล้วหน้าถูก remount), `heroPositions` (`heroRoles()` / `heroLanes()`), `image`, `functionError`, `myAvatarStore`, `siteConfig`
- `src/components/*`: `ErrorBoundary`, `AskCoach`, `HeroIcon`, `UserAvatar`, `layout/*` (Sidebar, Header, BottomNav, MobileDrawer, Footer, PageNav, ScrollToTop, ฯลฯ), `ui/*`
- `src/layouts/AppShell.tsx` กรอบหลัก (sidebar เดสก์ท็อป, header, bottom nav + drawer มือถือ, footer)
- `src/types/*` ชนิดข้อมูลให้ตรงกับ schema, `src/data/*.mock.ts` ข้อมูลตัวอย่างและ fallback เมื่อไม่ตั้งค่า Supabase
- `supabase/` `schema.sql` (ไม่ตรงกับ DB จริง), `migrations/`, `functions/ai-coach`, `functions/avatar`
- `docs/` เอกสารประกอบ: `ARCHITECTURE`, `CONTRIBUTING`, `DATABASE`, `DATA_POLICY`, `DATA_SOURCES`, `AI_COACH`, `LEGAL`, `ROADMAP`, `auth-setup`
- แอดมินเป็นแบบ config-driven: ตาราง `CFG` ใน `src/pages/Admin.tsx` กำหนดแท็บ/คอลัมน์/ตัวกรอง เพิ่มแท็บหรือคอลัมน์ใหม่ที่นั่น

## รันโปรเจกต์
```bash
npm install
npm run dev        # vite
npm run build      # vite build (ไม่ตรวจ type)
npx tsc --noEmit   # ตรวจ type เอง (ยังไม่มี script)
```
สร้างไฟล์ `.env` ที่รากโปรเจกต์ก่อนรัน (repo ยังไม่มี `.env.example`):
```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```
ถ้าไม่ใส่ค่า Supabase แอปจะใช้ Guest browsing กับ mock ทั้งหมด (หน้า Login จะขึ้น "ยังไม่ได้เชื่อม Supabase" แทนที่จะพัง)

## ตั้งค่า Supabase (สร้างโปรเจกต์ใหม่)
การสร้างจากไฟล์ใน repo อย่างเดียวจะได้ฐานข้อมูลไม่ครบ (ดูตาราง Migration) ถ้าต้องสร้างใหม่ให้เทียบกับโปรเจกต์จริงก่อน

1. สร้างโปรเจกต์ใหม่ใน Supabase
2. รัน `supabase/schema.sql` แล้วไฟล์ใน `supabase/migrations/` ตามลำดับ และเติมส่วนที่ขาด (ตาราง/คอลัมน์/ฟังก์ชันในตาราง Migration ที่ไม่มีไฟล์)
3. ใส่ `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` ใน `.env`
4. Storage: สร้าง bucket `hero-icons` (รูปจากหน้า `/admin`) และ `avatars` (รูปโปรไฟล์ เขียนผ่าน Edge Function `avatar` เท่านั้น)
5. Auth: ตั้งค่าตาม [`docs/auth-setup.md`](docs/auth-setup.md) (Confirm email, Redirect URLs, SMTP, Rate limits) และเปิด Google provider:
   - Google Cloud → Credentials → OAuth Client (Web) → ใส่ Authorized redirect URI เป็น `https://<project-ref>.supabase.co/auth/v1/callback` (ถ้าไม่ตรงจะขึ้น `redirect_uri_mismatch`)
   - Supabase → Authentication → URL Configuration → ใส่ Site URL และ Redirect URLs (เช่น `http://localhost:5173/**` และโดเมน production)
6. แต่งตั้งแอดมิน: เพิ่มแถวในตาราง `admin_users` ด้วย `user_id` ของบัญชีนั้น (ฟังก์ชัน `is_admin()` เช็กจากตารางนี้) แล้วไปที่ `/admin`
7. ใส่ข้อมูลผ่าน `/admin` (นำเข้าสถิติ / ปรับสมดุล / แก้ทีละแท็บ) หรือ seed ตรงเข้าตาราง

## ตั้งค่า AI Coach และตรวจรูปโปรไฟล์ (Gemini free tier)
ทั้ง Edge Function `ai-coach` และ `avatar` ใช้ secrets ชุดเดียวกัน:
1. สร้าง API key ที่ https://aistudio.google.com/apikey
2. Supabase Dashboard → Edge Functions → Secrets เพิ่ม:
   - `GEMINI_API_KEY` = key ที่สร้าง
   - `GEMINI_MODEL` = ชื่อรุ่นที่ใช้ free tier ได้ — ตรวจรุ่นและโควต้าล่าสุดใน AI Studio เพราะเปลี่ยนบ่อย
   - `GEMINI_FALLBACK_MODEL` (ไม่บังคับ) = รุ่นสำรองเมื่อรุ่นหลักยุ่งหรือโควต้าเต็ม
3. Deploy: `supabase functions deploy ai-coach` และ `supabase functions deploy avatar` (โค้ดอยู่ที่ `supabase/functions/<name>/index.ts` ทั้งสองตัวตรวจว่าเป็นผู้ใช้ที่ล็อกอินจริง)
4. `ai-coach` จะลองซ้ำ 1 ครั้งเมื่อเจอ 500/503/504 แล้วสลับไปรุ่นสำรอง; ถ้ายังไม่ผ่านจะแสดงข้อความภาษาไทย (เช่น "Gemini กำลังมีคนใช้เยอะ")
5. `avatar`: ตรวจขนาด (≤ 500 KB) และชนิดไฟล์ (JPEG/PNG/WebP) แล้วให้ Gemini ตรวจเนื้อหาก่อนบันทึก — ถ้าตรวจไม่ได้จะปฏิเสธ (fail closed) และมี cooldown 20 วินาทีต่อผู้ใช้
6. อย่าใส่ API key ใน `VITE_*` เด็ดขาด — ตัวแปรกลุ่มนี้ถูกฝังใน bundle ฝั่งเบราว์เซอร์
7. ข้อควรระวัง: free tier มี rate limit ต่อโปรเจกต์ (เจอ 429 ได้) และ Google อาจนำเนื้อหาที่ส่งไปใช้ปรับปรุงผลิตภัณฑ์ — ห้ามส่งข้อมูลส่วนตัวผู้ใช้เข้า prompt (รูปโปรไฟล์ที่อัปโหลดจะถูกส่งไปให้ Gemini ตรวจ)

### AI Coach — ขอบเขตปัจจุบัน
- ต่อกับ Hero Detail, Counter Pick, Matchup และ Draft Assistant (ประเมินดราฟต์ + การ์ดแนะนำตัวถัดไป)
- ยังไม่ต่อกับ Home เพราะข้อมูล insights ยังเป็น mock
- คำตอบอ้างอิงเฉพาะข้อมูลที่ส่งไปในแต่ละหน้า (รวมถึงข้อมูล heuristic) ไม่ใช่ข้อมูลยืนยันจากเกม — UI มีข้อความกำกับว่าเป็นคำแนะนำจาก AI และ context ที่ส่งไปไม่รวม Tier C ที่เป็นค่าเริ่มต้น (#62)

## หมายเหตุเรื่องข้อมูล
- ข้อมูลฮีโร่ สกิล สถิติ ชนะทาง/แพ้ทาง Tier List ปรับสมดุล คู่มือ ไอเทม และรูนมาจาก Supabase จริงเมื่อตั้งค่า `.env` ส่วนที่ยังเป็น mock (`src/data/*.mock.ts`) คือ matchup และ Home insights (คู่มือใช้ mock เฉพาะตอนไม่ตั้งค่า Supabase)
- `heroes.source = 'liquipedia'` ทุกแถว; สถิติรายแรงก์และข้อมูลปรับสมดุลนำเข้าจากไฟล์ JSON ของเกม (`getranklist.json`, `getlatestadjustlist.json`) ผ่านหน้า `/admin`; ชุดไอเทมนำเข้าจาก `rov.in.th` ดูที่มาและสถานะเพิ่มที่ [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md)
- **ค่าสเตตัสรูน** (`arcana.description`) คือค่าเลเวล 3 จากแหล่งข้อมูลของบุคคลที่สาม (ปี 2019) ยังไม่ได้เทียบกับแพตช์ปัจจุบันของเกม
- **ชื่อไอเทม** ภาษาอังกฤษใน `items.name` ไม่น่าเชื่อถือทุกแถว (บางแถวชื่อไม่ตรงกับชนิดไอเทม) ชื่อไทยใน DB เป็นการแปลเครื่อง ควรตรวจทานก่อนนำบิลด์กลับมาแสดงบนเว็บ
