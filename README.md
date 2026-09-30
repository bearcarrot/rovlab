# RovLab — RoV Companion App

Stack: React + TypeScript + Vite + Tailwind + shadcn-style UI + Lucide + React Router.
Backend: Supabase (Postgres + Auth + RLS + Edge Functions) — เชื่อมแล้วบางส่วน ดูตาราง "สถานะปัจจุบัน" ด้านล่าง; deploy target Vercel.

## สถานะปัจจุบัน (อัปเดต 30 ก.ย. 2026)

### เสร็จแล้วและใช้ข้อมูลจริงจาก Supabase
| ส่วน | สถานะ |
|---|---|
| ฮีโร่ (`heroes`) | 129 ตัว มีไอคอนครบทุกตัว — หน้า Heroes / Hero Detail / Counter Pick / Draft ฯลฯ อ่านจากตารางนี้ |
| สกิล (`hero_abilities`) | 516 แถว แสดงในหน้า Hero Detail |
| สถิติ (`hero_stats`) | 258 แถว (Win/Pick/Ban Rate, Tier) |
| ตัวสวน (`hero_counters`) | 387 แถว ใช้ทั้งหน้า Hero Detail ("ใครสวน / สวนใคร") และ Counter Pick |
| ไอเทม (`items`) | 112 รายการ (ใช้แสดงรายละเอียดไอเทมในหน้า Item Build) |
| Auth | Email + Google, Guest browsing ได้ |
| Favorites / Profile | บันทึกลง Supabase (ต้องล็อกอิน) |
| AI Coach (Gemini) | Edge Function `ai-coach` ต่อกับ 5 หน้า: Hero Detail, Counter Pick, Matchup, Draft Assistant, Item Build |

### ยังค้าง / ยังเป็น mock
| เรื่อง | รายละเอียด |
|---|---|
| Matchup | `services/matchups.ts` ยังใช้ mock + heuristic (มี TODO ต่อ Supabase) — ตาราง `matchups` ยังว่าง (0 แถว) |
| Item Build (บิลด์แนะนำ) | `services/items.ts` ส่วน `getBuildForHero` ยังใช้ mock + heuristic — ตาราง `item_builds`, `item_build_items`, `arcana` ยังว่าง (รายการไอเทมเองพร้อมแล้ว) |
| ฮีโร่เข้าคู่ | ตาราง `hero_synergies` ว่าง (0 แถว) การ์ด "ฮีโร่ที่เข้าคู่ดี" ใน Hero Detail จึงขึ้น "ยังไม่มีข้อมูล" |
| Home insights | `services/insights.ts` ยังเป็น mock (TODO: derive จากประวัติแมตช์ของผู้ใช้) |
| `/stats` | ยังเป็น placeholder — รอ schema สถิติแมตช์จริง |
| `/learn` / คู่มือ | ยังเป็น placeholder — ตาราง `guides`, `guide_categories` ว่าง |
| ความคิดเห็นชุมชน | ยังเป็น placeholder — ตาราง `comments` ว่าง (Auth พร้อมแล้ว เหลือต่อ UI/service) |
| บันทึกดราฟต์/บิลด์ | ตาราง `saved_builds`, `saved_drafts` ว่าง — ยังไม่มีการใช้งาน |
| Draft Assistant | ยังใช้ heuristic ตาม Role (`ROLE_TAGS`) เพราะยังไม่มี tag ดาเมจ/CC/มือถือระดับสกิลจริง |
| `hero_stats` หลายแถวต่อฮีโร่ | 258 แถวสำหรับ 129 ฮีโร่ แต่ `fetchStatsByHeroId` เลือก "แถวแรกที่เจอ" — ควรกำหนดให้ชัดว่าใช้ patch/rank ไหน ไม่งั้นค่าที่แสดงอาจไม่ตรงกับที่ตั้งใจ |
| Tier List | ยังไม่ได้ตรวจว่าอ่านจากตาราง `tier_lists` / `tier_list_entries` (มีข้อมูล 12 / 516 แถวแล้ว) หรือคำนวณเองจาก `hero_stats` |
| ไอคอนไอเทม | ยังไม่ได้ตรวจว่า `items.icon_url` มีรูปครบหรือไม่ |
| ตรวจสอบก่อนปล่อยจริง | ยังไม่ได้รัน `npm run build` / ทดสอบบนเบราว์เซอร์กับฟีเจอร์ AI Coach, ไอคอนในรายการตัวสวน, Counter Pick ที่ใช้ข้อมูลจริง และตัวกรอง Role/Lane บนทุกหน้า |

### AI Coach — ขอบเขตปัจจุบัน
- ต่อกับ Hero Detail, Counter Pick, Matchup, Draft Assistant (ประเมินดราฟต์ + การ์ดแนะนำตัวถัดไป) และ Item Build
- ยังไม่ต่อกับ Home, Stats, Tier List เพราะข้อมูลตรงนั้นยังเป็น mock (AI จะแค่พูดซ้ำข้อมูล mock ให้ดูน่าเชื่อถือ)
- คำตอบมาจากโมเดลโดยอ้างอิงเฉพาะข้อมูลที่ส่งไปในแต่ละหน้า (รวมถึงข้อมูล heuristic) ไม่ใช่ข้อมูลยืนยัน — UI มีข้อความกำกับว่าเป็นคำแนะนำจาก AI

## ฟีเจอร์ในแอป
- Vite/TS/Tailwind config พร้อม design tokens (สี/ฟอนต์/รัศมีขอบ) — ดู `tailwind.config.ts`
- App shell: Sidebar (desktop), Header, Bottom Nav + Slide-out Drawer (mobile)
- Routing ตาม IA — `/heroes`, `/tier-list`, `/counter-pick`, `/matchup`, `/draft`, `/build`, `/favorites`, `/profile`, `/login` ใช้งานได้ (`/stats`, `/learn` ยังเป็น placeholder)
- Home Dashboard: Insight cards (what/why/fix/practice), Quick actions, Hero rows (Win Rate สูงสุด / Ban Rate สูงสุด)
- Hero Database: ค้นหา + กรอง Role/Lane
- Hero Detail: สถิติ, สกิล, จุดแข็ง/จุดอ่อน, ใครสวนได้/สวนใครได้ (พร้อมเหตุผลและไอคอนฮีโร่, เรียงจากสวนได้ดีที่สุด), ฮีโร่เข้าคู่, ปุ่มรายการโปรด, ปุ่มถามโค้ช AI
- Tier List: จัดกลุ่มตาม Tier พร้อมเหตุผลสั้น ๆ ต่อฮีโร่, กรอง Role/Lane
- Counter Pick: เลือกฮีโร่ศัตรู → ดูตัวสวนพร้อมไอคอน เหตุผล และคำแนะนำเลน (ข้อมูลจริงจาก `hero_counters`), กรอง Role/Lane, ปุ่มถามโค้ช AI
- Matchup: เทียบฮีโร่ 2 ตัว — ข้อมูลเจาะจง (curated) หรือ heuristic จาก Win Rate (label ชัดเจนทั้งสองแบบ), กรอง Role/Lane แยกต่อฝั่ง, ปุ่มถามโค้ช AI
- Draft Assistant: เลือกทีมทีละช่อง วิเคราะห์ดาเมจ/แนวหน้า/CC/Mobility/Sustain/Early-Late และแนะนำตัวถัดไปพร้อมดาว เหตุผล และไอคอน (label ว่าเป็น Heuristic เสมอ), กรอง Role/Lane ในแผงเลือกฮีโร่, ปุ่มถามโค้ช AI ทั้งระดับทีมและระดับการ์ด
- Item Build: เลือกฮีโร่ → บิลด์แนะนำแยกตามช่วงเกมพร้อมเหตุผล + Arcana (label curated vs heuristic), กรอง Role/Lane, ปุ่มถามโค้ช AI
- Auth: Supabase Auth (Email + Google) พร้อม Guest browsing — ถ้ายังไม่ตั้งค่า `.env` ระบบจะโชว์สถานะ "ยังไม่ได้เชื่อม Supabase" แทนที่จะพัง
- Favorites: กดหัวใจที่การ์ดฮีโร่/หน้า Hero Detail บันทึกลง Supabase (ต้องล็อกอิน), มีหน้ารวมรายการโปรด
- Profile: แก้ Role ที่ถนัด, ออกจากระบบ
- Supabase schema พร้อม RLS — `supabase/schema.sql` (heroes, hero_stats, hero_counters, hero_synergies, items, item_builds, matchups, tier_lists, guides, profiles, favorites, saved_builds, saved_drafts, comments)
- Service layer (`src/services/*`) แยกจาก UI แล้วทุกฟีเจอร์ — ส่วนที่ยังเป็น mock สลับไป Supabase ได้โดยไม่แตะ component
- Loading / Empty / Error state ใช้ pattern เดียวกันทั้งแอป (`useAsync` hook + `Skeleton`/`EmptyState`/`ErrorState`)
- คอมโพเนนต์ที่ใช้ร่วมกัน: `AskCoach` (ปุ่มถามโค้ช AI), `HeroIcon` (ไอคอนพร้อม fallback ตัวอักษรย่อ), `HeroFilterBar` + `useHeroFilters` (chip กรอง Role/Lane)

## รันโปรเจกต์
```bash
npm install
cp .env.example .env   # ใส่ค่า Supabase เพื่อเปิด Auth/Favorites/Profile/ข้อมูลฮีโร่จริง (ไม่ใส่ก็ใช้ Guest browsing กับ mock ได้)
npm run dev
```

## ตั้งค่า Supabase
1. สร้างโปรเจกต์ใหม่ใน Supabase
2. รัน `supabase/schema.sql` ใน SQL editor
3. ใส่ `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` ใน `.env`
4. เปิด Google provider ใน Supabase Auth (ต้องใช้ OAuth Client ID/Secret จาก Google Cloud Console):
   - Google Cloud → Credentials → OAuth Client (Web) → ใส่ Authorized redirect URI เป็น `https://<project-ref>.supabase.co/auth/v1/callback` (ถ้าไม่ตรงจะขึ้น `redirect_uri_mismatch`)
   - Supabase → Authentication → URL Configuration → ใส่ Site URL และ Redirect URLs (เช่น `http://localhost:5173/**` และโดเมน production)
5. Seed ข้อมูลลงตาราง `heroes` / `hero_stats` / `hero_counters` / `items` ฯลฯ (โปรเจกต์ปัจจุบัน seed ส่วนที่ระบุในตาราง "สถานะปัจจุบัน" แล้ว) จากนั้นสลับ service ที่ยังเป็น mock (`matchups`, `getBuildForHero`, `insights`, `guides`) ให้เรียก Supabase

## ตั้งค่า AI Coach (Gemini free tier)
1. สร้าง API key ที่ https://aistudio.google.com/apikey
2. Supabase Dashboard → Edge Functions → Secrets เพิ่ม:
   - `GEMINI_API_KEY` = key ที่สร้าง
   - `GEMINI_MODEL` = ชื่อรุ่นที่ใช้ free tier ได้ (เช่น `gemini-3.8-flash`) — ตรวจรุ่นและโควต้าล่าสุดใน AI Studio เพราะเปลี่ยนบ่อย
   - `GEMINI_FALLBACK_MODEL` (ไม่บังคับ) = รุ่นสำรองเมื่อรุ่นหลักยุ่งหรือโควต้าเต็ม ค่าเริ่มต้นคือ `gemini-3.5-flash-lite`
3. Deploy: `supabase functions deploy ai-coach` (โค้ดอยู่ที่ `supabase/functions/ai-coach/index.ts`, เปิด `verify_jwt` และตรวจว่าเป็นผู้ใช้ที่ล็อกอินจริง)
4. ตัว function จะลองซ้ำ 1 ครั้งเมื่อเจอ 500/503/504 แล้วสลับไปรุ่นสำรอง; ถ้ายังไม่ผ่านจะแสดงข้อความภาษาไทย (เช่น "Gemini กำลังมีคนใช้เยอะ")
5. อย่าใส่ API key ใน `VITE_*` เด็ดขาด — ตัวแปรกลุ่มนี้ถูกฝังใน bundle ฝั่งเบราว์เซอร์
6. ข้อควรระวัง: free tier มี rate limit ต่อโปรเจกต์ (เจอ 429 ได้) และ Google อาจนำเนื้อหาที่ส่งไปใช้ปรับปรุงผลิตภัณฑ์ — ห้ามส่งข้อมูลส่วนตัวผู้ใช้เข้า prompt

## หมายเหตุเรื่องข้อมูล
ข้อมูลฮีโร่ สกิล สถิติ ตัวสวน และรายการไอเทมมาจาก Supabase จริงเมื่อตั้งค่า `.env` ส่วนที่ยังเป็น mock ที่ label ไว้ชัดเจน (`src/data/*.mock.ts`) คือ matchup, บิลด์แนะนำ, Home insights และเนื้อหาคู่มือ โครงสร้างชนิดข้อมูล (`src/types/*`) ออกแบบให้ตรงกับ schema ใน Supabase (`supabase/schema.sql`) เพื่อให้สลับจาก mock → ของจริงได้โดยไม่ต้องรื้อ UI ถ้าไม่ตั้งค่า Supabase แอปจะ fallback เป็น mock ทั้งหมด
