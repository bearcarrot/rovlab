# RovLab — RoV Companion App

Stack: React + TypeScript + Vite + Tailwind + shadcn-style UI + Lucide + React Router.
Backend: Supabase (Postgres + Auth + RLS + Storage + Edge Functions); deploy target Vercel.

## สถานะปัจจุบัน (อัปเดต 1 ต.ค. 2026)

จำนวนแถวด้านล่างนับจากฐานข้อมูล Supabase จริง ณ วันที่ดังกล่าว ส่วนการสรุปพฤติกรรมของแอปอ่านจากโค้ดบน `main`

### ใช้ข้อมูลจริงจาก Supabase แล้ว
| ส่วน | สถานะ |
|---|---|
| ฮีโร่ (`heroes`) | 129 ตัว มีไอคอนครบ รองรับหลายตำแหน่ง/หลายเลนต่อฮีโร่ (`roles` / `lanes`, ตาราง `hero_roles` / `hero_lanes`) |
| สกิล (`hero_abilities`) | 516 แถว แสดงใน Hero Detail — UI รองรับไอคอนสกิลแล้ว แต่ `icon_url` ยังว่างทั้ง 516 แถว (อัปโหลดผ่านหน้า `/admin`) |
| สถิติ (`hero_stats`) | 258 แถว (Win/Pick/Ban Rate, Tier) อ่านเฉพาะแพตช์ล่าสุด (`patches.released_at`) ตาม rank ที่เลือกผ่านปุ่ม All / High ทั่วแอป — ถ้าฮีโร่ไม่มีแถวใน rank นั้นจะแสดง N/A (ไม่สลับไปใช้ rank อื่น) |
| ชนะทาง/แพ้ทาง (`hero_counters`) | 387 แถว ใช้ใน Hero Detail, Counter Pick และคะแนนแนะนำใน Draft Assistant |
| ซินเนอร์จี้ (`hero_synergies`) | อ่านจริงและใช้ใน Draft Assistant แต่ตอนนี้มีแค่ 1 แถว — การ์ด "ฮีโร่ที่คอมโบกับ {ชื่อฮีโร่} ได้ดี" ส่วนใหญ่จะยังว่าง |
| ไอเทม (`items`) | 112 รายการ มีรูปครบ แสดงในหน้า Item Build (ชื่ออังกฤษในแอดมิน/บิลด์ ชื่อไทยใน DB เป็นการแปลเครื่องจึงใช้เป็นหลักไม่ได้) |
| รูน (`arcana`) | 30 รูนเลเวล 3 ครบ มีสี (red / purple / green) รูป และสเตตัสต่อ 1 ช่องใน `description` |
| บิลด์แนะนำ (`item_builds`, `item_build_items`, `item_build_arcana`) | Item Build อ่านจาก DB ก่อน ถ้าฮีโร่ไม่มีไอเทมใน DB จะสลับไปบิลด์ heuristic ตาม Role (มี label กำกับ) — ตอนนี้มีข้อมูล 2 บิลด์ / 10 ไอเทม / 7 แถวรูน รูนแยกเป็น 3 สี พร้อมจำนวนช่อง (x/10 ต่อสี) |
| Stats / Tier List | คำนวณจาก `hero_stats` (คอลัมน์ `tier`) ตามแพตช์ล่าสุดและ rank ที่เลือก |
| Auth | Email + Google, Guest browsing ได้ |
| Favorites / Profile | บันทึกลง Supabase (ต้องล็อกอิน) — แก้โปรไฟล์ อัปโหลดรูปโปรไฟล์ (ผ่าน Edge Function `avatar` + ตรวจรูปด้วย Gemini) ฮีโร่โปรด และหน้าโปรไฟล์สาธารณะ `/players/:id` |
| ความคิดเห็นชุมชน (`comments`) | คอมเมนต์ในหน้า Hero Detail ใช้งานได้ (ต้องล็อกอิน) |
| Admin (`/admin`) | แก้ข้อมูลได้ทุกตารางหลักจากหน้าเว็บ (UI แบบ mobile-first) อัปโหลดรูปเข้า bucket `hero-icons` แท็บ "รูนในบิลด์" สรุปจำนวนช่องต่อสีและเตือนเมื่อเกิน 10 — สิทธิ์แอดมินเช็กจาก RPC `is_admin()` (ตาราง `admin_users`) และบังคับจริงที่ RLS |
| AI Coach (Gemini) | Edge Function `ai-coach` ต่อกับ 5 หน้า: Hero Detail, Counter Pick, Matchup, Draft Assistant, Item Build |

### ยังค้าง / ยังเป็น mock
| เรื่อง | รายละเอียด |
|---|---|
| Matchup | `services/matchups.ts` ยังใช้ mock + heuristic (มี TODO ต่อ Supabase) — ตาราง `matchups` ว่าง (0 แถว) แม้ใน `/admin` จะมีแท็บใส่ข้อมูลแล้ว |
| คู่มือ (`/learn`, `/learn/:slug`) | หน้าเว็บพร้อมแล้ว แต่ `services/guides.ts` อ่านจาก mock — ตาราง `guides`, `guide_categories` ว่าง (0 แถว) |
| Home insights | `services/insights.ts` ยังเป็น mock (TODO: derive จากประวัติแมตช์ของผู้ใช้) |
| บันทึกดราฟต์/บิลด์ | ตาราง `saved_builds`, `saved_drafts` ว่าง — ยังไม่มีการใช้งานใน UI |
| Draft Assistant | ยังใช้ heuristic พื้นฐานตาม Role (`ROLE_TAGS`) เพราะยังไม่มี tag ดาเมจ/CC/มือถือระดับสกิลจริง แต่เพิ่มโหมด First Pick และคะแนนจาก counter/synergy จริงแล้ว |
| บิลด์แนะนำใน DB | มีแค่ 2 บิลด์ ฮีโร่ส่วนใหญ่ได้บิลด์ heuristic และยังไม่มีรูนแนะนำ (จะขึ้น "ยังไม่มีข้อมูลรูน") ต้องใส่ผ่าน `/admin` |
| `tier_lists` / `tier_list_entries` | มีข้อมูล (12 / 516 แถว) แต่ไม่ได้ถูกอ่านโดยหน้า Tier List ในโค้ดปัจจุบัน (หน้านั้นใช้ `hero_stats.tier`) |
| ตัวกรอง Role/Lane ใน Tier List และ Stats | หน้าเหล่านี้ยังเทียบกับ `role` / `lane` หลักตัวเดียว ยังไม่ใช้ `roles` / `lanes` หลายตำแหน่งที่เพิ่งเพิ่มในฮีโร่ (ตรวจจากโค้ด `src/pages/TierList.tsx`, `src/pages/Stats.tsx`) |
| Schema ใน repo ไม่ครบ | ตารางหลายตัวถูกสร้าง/แก้ผ่าน Supabase โดยตรง (เช่น `admin_users`, `hero_roles`, `hero_lanes`, `item_build_arcana`, คอลัมน์ `arcana.color`) ไฟล์ใน `supabase/migrations/` มีแค่ 2 ไฟล์ ยังไม่ได้ตรวจว่า `supabase/schema.sql` ตรงกับ DB ปัจจุบัน สร้างโปรเจกต์ใหม่จากไฟล์ใน repo อย่างเดียวอาจได้ฐานข้อมูลไม่ครบ |
| ตารางที่ไม่ได้ใช้ | มีตาราง `kv_store_b2992ca8` ใน DB ที่ไม่มีโค้ดในแอปใช้งาน |
| ตรวจสอบก่อนปล่อยจริง | ยังไม่ได้รัน `npm run build` และทดสอบบนเบราว์เซอร์ครบทุกหน้า โดยเฉพาะรูปไอคอนไอเทม/รูนที่ hotlink จากเว็บภายนอก (ดูหมายเหตุด้านล่าง) และตัวกรอง Role/Lane แบบหลายตำแหน่ง |

### AI Coach — ขอบเขตปัจจุบัน
- ต่อกับ Hero Detail, Counter Pick, Matchup, Draft Assistant (ประเมินดราฟต์ + การ์ดแนะนำตัวถัดไป) และ Item Build
- ยังไม่ต่อกับ Home เพราะข้อมูล insights ยังเป็น mock (AI จะแค่พูดซ้ำข้อมูล mock ให้ดูน่าเชื่อถือ)
- คำตอบมาจากโมเดลโดยอ้างอิงเฉพาะข้อมูลที่ส่งไปในแต่ละหน้า (รวมถึงข้อมูล heuristic) ไม่ใช่ข้อมูลยืนยัน — UI มีข้อความกำกับว่าเป็นคำแนะนำจาก AI

## หน้าในแอป (routes)
| Path | หน้า |
|---|---|
| `/` | Home Dashboard: Insight cards, Quick actions, Hero rows (Win Rate / Ban Rate สูงสุด) |
| `/heroes`, `/heroes/:slug` | Hero Database (ค้นหา + กรอง Role/Lane) และ Hero Detail (สถิติ สกิล จุดแข็ง/อ่อน แพ้ทางใครบ้าง/ชนะทางใครได้ ซินเนอร์จี้ คอมเมนต์ ปุ่มรายการโปรด ถามโค้ช AI) แสดงตำแหน่ง/เลนทั้งหมดของฮีโร่ |
| `/tier-list` | จัดกลุ่มตาม Tier พร้อมเหตุผลสั้น ๆ ต่อฮีโร่ กรอง Role/Lane |
| `/stats` | Win / Pick / Ban Rate เรียงจากมากไปน้อย กรอง Lane |
| `/counter-pick` | เลือกฮีโร่ศัตรู → ดูฮีโร่ที่ชนะทางพร้อมไอคอน เหตุผล และคำแนะนำเลน (จาก `hero_counters`) |
| `/matchup` | เทียบฮีโร่ 2 ตัว — ข้อมูลเจาะจง (curated) หรือ heuristic จาก Win Rate (label ชัดเจนทั้งสองแบบ) |
| `/draft` | Draft Assistant: เลือกทีมทีละช่อง วิเคราะห์ดาเมจ/แนวหน้า/CC/Mobility/Sustain/Early-Late แนะนำตัวถัดไปพร้อมเหตุผล รองรับโหมด First Pick และคะแนนจาก counter/synergy |
| `/build` | Item Build: บิลด์แยกตามช่วงเกมพร้อมเหตุผล + หน้ารูนแยก 3 สี (label curated vs heuristic) |
| `/learn`, `/learn/:slug` | คู่มือ (ยังเป็น mock) |
| `/favorites`, `/profile`, `/players/:id`, `/login` | รายการโปรด / โปรไฟล์ตัวเอง / โปรไฟล์ผู้เล่นสาธารณะ / เข้าสู่ระบบ |
| `/admin` | แอดมิน (เฉพาะบัญชีใน `admin_users`) |

## โครงสร้างโค้ด
- `src/pages/*` — หน้าตาม routes, `src/features/*` — คอมโพเนนต์/ตรรกะตามฟีเจอร์ (auth, build, comments, dashboard, draft, favorites, heroes, profile, stats, tierlist)
- Service layer (`src/services/*`) แยกจาก UI — ส่วนที่ยังเป็น mock (`matchups`, `guides`, `insights`) สลับไป Supabase ได้โดยไม่แตะ component
- ชนิดข้อมูลใน `src/types/*` ออกแบบให้ตรงกับ schema ใน Supabase mock อยู่ที่ `src/data/*.mock.ts` และใช้เป็น fallback เมื่อไม่ได้ตั้งค่า Supabase
- Loading / Empty / Error state ใช้ pattern เดียวกันทั้งแอป (`useAsync` + `Skeleton` / `EmptyState` / `ErrorState`)
- คอมโพเนนต์ที่ใช้ร่วม: `AskCoach` (ปุ่มถามโค้ช AI), `HeroIcon` (ไอคอนพร้อม fallback ตัวอักษรย่อ), `HeroFilterBar` + `useHeroFilters` (chip กรอง Role/Lane)
- Edge Functions: `supabase/functions/ai-coach`, `supabase/functions/avatar`

## รันโปรเจกต์
```bash
npm install
npm run dev
```
สร้างไฟล์ `.env` ที่รากโปรเจกต์ก่อนรัน (repo ยังไม่มี `.env.example`):
```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```
ถ้าไม่ใส่ค่า Supabase แอปจะใช้ Guest browsing กับ mock ทั้งหมด (หน้า Login จะขึ้น "ยังไม่ได้เชื่อม Supabase" แทนที่จะพัง)

## ตั้งค่า Supabase
1. สร้างโปรเจกต์ใหม่ใน Supabase
2. รัน `supabase/schema.sql` และไฟล์ใน `supabase/migrations/` ใน SQL editor — **อย่างไรก็ตาม ตาราง/คอลัมน์บางส่วนที่แอปใช้อยู่ (ดู "Schema ใน repo ไม่ครบ" ด้านบน) อาจไม่ถูกสร้างจากไฟล์เหล่านั้น** ควรเทียบกับโปรเจกต์ Supabase จริงก่อน
3. ใส่ `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` ใน `.env`
4. Storage: สร้าง bucket `hero-icons` (รูปจากหน้า `/admin`) และ `avatars` (รูปโปรไฟล์ เขียนผ่าน Edge Function `avatar` เท่านั้น)
5. เปิด Google provider ใน Supabase Auth (ต้องใช้ OAuth Client ID/Secret จาก Google Cloud Console):
   - Google Cloud → Credentials → OAuth Client (Web) → ใส่ Authorized redirect URI เป็น `https://<project-ref>.supabase.co/auth/v1/callback` (ถ้าไม่ตรงจะขึ้น `redirect_uri_mismatch`)
   - Supabase → Authentication → URL Configuration → ใส่ Site URL และ Redirect URLs (เช่น `http://localhost:5173/**` และโดเมน production)
6. แต่งตั้งแอดมิน: เพิ่มแถวในตาราง `admin_users` ด้วย `user_id` ของบัญชีนั้น (ฟังก์ชัน `is_admin()` เช็กจากตารางนี้) แล้วไปที่ `/admin`
7. Seed ข้อมูลลงตาราง `heroes` / `hero_stats` / `hero_counters` / `items` / `arcana` ฟีเจอร์ที่ยังเป็น mock (`matchups`, `guides`, `insights`) ยังต้องเขียน service ให้เรียก Supabase ก่อน

## ตั้งค่า AI Coach และตรวจรูปโปรไฟล์ (Gemini free tier)
ทั้ง Edge Function `ai-coach` และ `avatar` ใช้ secrets ชุดเดียวกัน:
1. สร้าง API key ที่ https://aistudio.google.com/apikey
2. Supabase Dashboard → Edge Functions → Secrets เพิ่ม:
   - `GEMINI_API_KEY` = key ที่สร้าง
   - `GEMINI_MODEL` = ชื่อรุ่นที่ใช้ free tier ได้ (เช่น `gemini-3.8-flash`) — ตรวจรุ่นและโควต้าล่าสุดใน AI Studio เพราะเปลี่ยนบ่อย
   - `GEMINI_FALLBACK_MODEL` (ไม่บังคับ) = รุ่นสำรองเมื่อรุ่นหลักยุ่งหรือโควต้าเต็ม ค่าเริ่มต้นคือ `gemini-3.5-flash-lite`
3. Deploy: `supabase functions deploy ai-coach` และ `supabase functions deploy avatar` (โค้ดอยู่ที่ `supabase/functions/<name>/index.ts` ทั้งสองตัวตรวจว่าเป็นผู้ใช้ที่ล็อกอินจริง)
4. `ai-coach` จะลองซ้ำ 1 ครั้งเมื่อเจอ 500/503/504 แล้วสลับไปรุ่นสำรอง; ถ้ายังไม่ผ่านจะแสดงข้อความภาษาไทย (เช่น "Gemini กำลังมีคนใช้เยอะ")
5. `avatar`: ตรวจขนาด (≤ 500 KB) และชนิดไฟล์ (JPEG/PNG/WebP) แล้วให้ Gemini ตรวจเนื้อหาก่อนบันทึก — ถ้าตรวจไม่ได้จะปฏิเสธ (fail closed) และมี cooldown 20 วินาทีต่อผู้ใช้ ไม่ให้ใช้ `GEMINI_API_KEY` เต็มโควต้า
6. อย่าใส่ API key ใน `VITE_*` เด็ดขาด — ตัวแปรกลุ่มนี้ถูกฝังใน bundle ฝั่งเบราว์เซอร์
7. ข้อควรระวัง: free tier มี rate limit ต่อโปรเจกต์ (เจอ 429 ได้) และ Google อาจนำเนื้อหาที่ส่งไปใช้ปรับปรุงผลิตภัณฑ์ — ห้ามส่งข้อมูลส่วนตัวผู้ใช้เข้า prompt (รูปโปรไฟล์ที่อัปโหลดจะถูกส่งไปให้ Gemini ตรวจ)

## หมายเหตุเรื่องข้อมูล
- ข้อมูลฮีโร่ สกิล สถิติ ชนะทาง/แพ้ทาง ไอเทม และรูนมาจาก Supabase จริงเมื่อตั้งค่า `.env` ส่วนที่ยังเป็น mock ที่ label ไว้ชัดเจน (`src/data/*.mock.ts`) คือ matchup, Home insights และเนื้อหาคู่มือ ถ้าไม่ตั้งค่า Supabase แอปจะ fallback เป็น mock ทั้งหมด
- **แหล่งรูปภาพ:** ไอคอนไอเทมอ้างจาก `lienquan.garena.vn` และไอคอนรูนอ้างจาก CDN ของ Garena Thailand (`cdn-webth.garenanow.com`) โดยตรง (hotlink) ไม่ได้อัปโหลดเก็บเอง ถ้าเจ้าของเปลี่ยน URL หรือบล็อก hotlink รูปจะแสดงเป็นตัวอักษรย่อแทน (fallback ของ `HeroIcon`) และควรพิจารณาย้ายไปเก็บใน Supabase Storage และตรวจสิทธิ์การใช้งานงานศิลป์เกม
- **ค่าสเตตัสรูน** (`arcana.description`) คือค่าเลเวล 3 จากแหล่งข้อมูลของบุคคลที่สาม (ปี 2019) ยังไม่ได้เทียบกับแพตช์ปัจจุบันของเกม
- **ชื่อไอเทม** ภาษาอังกฤษในคอลัมน์ `items.name` ไม่น่าเชื่อถือทุกแถว (บางแถวชื่อไม่ตรงกับชนิดไอเทม) ควรตรวจทานบางแถวก่อนขึ้นบิลด์จริง
