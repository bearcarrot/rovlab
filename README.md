# RovLab — RoV Companion App

Stack: React + TypeScript + Vite + Tailwind + shadcn-style UI + Lucide + React Router.
Backend: Supabase (Postgres + Auth + RLS + Edge Functions), deploy target Vercel.

## สถานะปัจจุบัน

### ใช้ข้อมูลจริงจาก Supabase แล้ว
- **ฮีโร่** (`heroes`, 129 ตัว) พร้อมไอคอน และสกิล (`hero_abilities`)
- **สถิติฮีโร่** (`hero_stats`) — Win/Pick/Ban Rate และ Tier ของ patch ล่าสุด (ดูจาก `patches.released_at`) แยก 2 ช่วงแรงก์: `all` (ทุกแรงก์) และ `high` (Commander ขึ้นไป)
- **ตัวสวน** (`hero_counters`) — แต่ละฮีโร่มี 3 ตัวที่ชนะทางได้ดีที่สุดตามสถิติจริง (อันดับ 1 = สวนได้ดีที่สุด, อันดับ 2–3 = สวนได้ดี) ข้อมูลชุดนี้ไม่มี rank/patch จึงไม่เปลี่ยนตามตัวสลับแรงก์ และไม่ได้ครอบคลุมทุกฮีโร่ (ฮีโร่ที่ไม่ติดอันดับของใครจะไม่มีรายการตัวสวน ไม่ได้แปลว่าไม่มีใครสวนได้)
- **Tier List / Stats / Home** อ่านจาก `hero_stats` และแสดง patch + ช่วงแรงก์ที่ใช้อยู่จริง

### ตัวสลับแรงก์ (all / high)
ปุ่มใน Header ใช้ทั้งแอป — ค่าตั้งต้น `all` จำไว้ใน localStorage และรับ `?rank=high` ใน URL ได้ (เปิดหน้าใหม่ด้วยแรงก์ที่ระบุ) ตัวสลับไม่ fallback ข้ามช่วงเงียบ ๆ: ถ้าฮีโร่ไม่มีสถิติในช่วงที่เลือกจะแสดง N/A โค้ดอยู่ที่ `src/lib/rank.ts`, `src/components/layout/RankToggle.tsx` และ `src/services/heroes.ts`

### ฟีเจอร์ในแอป
- App shell: Sidebar (desktop), Header, Bottom Nav + Slide-out Drawer (mobile)
- Home Dashboard: Insight cards (ตัวอย่าง), Quick actions, Hero rows (Win Rate / Ban Rate สูงสุด)
- Hero Database: ค้นหา + กรอง Role/Lane
- Hero Detail: สถิติ, จุดแข็ง/จุดอ่อน, สกิล, ใครสวนได้/สวนใครได้, ปุ่มรายการโปรด, ถามโค้ช AI
- Tier List: จัดกลุ่มตาม Tier พร้อมเหตุผลสั้น ๆ (คำนวณจาก Win/Ban/Pick Rate), กรอง Role/Lane
- Stats: จัดอันดับ Win/Pick/Ban Rate กรอง Lane
- Counter Pick: เลือกฮีโร่ศัตรู → ดูตัวสวน (ข้อมูลจริง), กรอง Role/Lane
- Matchup: เทียบฮีโร่ 2 ตัว — curated หรือ heuristic จาก Win Rate (label ชัดเจนทั้งสองแบบ)
- Draft Assistant: เลือกทีมทีละช่อง วิเคราะห์ดาเมจ/แนวหน้า/CC/Mobility/Sustain/Early-Late และแนะนำตัวถัดไป (Heuristic ตาม Role — label เสมอ ไม่อ้างความแม่นยำเกินจริง)
- Item Build: บิลด์แนะนำแยกตามช่วงเกม + Arcana (label curated vs heuristic)
- Learn (`/learn`): รายการคู่มือและหน้าอ่าน (เนื้อหาตัวอย่าง)
- Auth: Supabase Auth (Email + Google) พร้อม Guest browsing — ถ้ายังไม่ตั้งค่า `.env` จะโชว์ "ยังไม่ได้เชื่อม Supabase" แทนที่จะพัง
- Favorites และ Profile (แก้ Role ที่ถนัด, ออกจากระบบ) — ต้องล็อกอิน
- **AI Coach (Gemini)**: ปุ่ม "ถามโค้ช AI" ผ่าน `AskCoach` ใน Counter Pick, Matchup, Draft (`RecommendedPickCard`), Item Build และ Hero Detail เรียกผ่าน Supabase Edge Function `ai-coach` (ซ่อน API key ฝั่งเซิร์ฟเวอร์, ต้องล็อกอิน) จาก `askCoach()` ใน `src/services/ai.ts`
- Service layer (`src/services/*`) แยกจาก UI — มี fallback เป็น mock เมื่อไม่ได้ตั้งค่า Supabase
- Loading / Empty / Error state pattern เดียวกันทั้งแอป (`useAsync` + `Skeleton`/`EmptyState`/`ErrorState`)

## รันโปรเจกต์
```bash
npm install
cp .env.example .env   # ใส่ค่า Supabase เพื่อเปิดข้อมูลจริง/Auth/Favorites/Profile (ไม่ใส่ก็ใช้ Guest + mock ได้)
npm run dev
```

## ตั้งค่า Supabase
โปรเจกต์นี้ใช้ Supabase project เดียวกับระบบ RoV Draft & Tier List เดิม (มีข้อมูลฮีโร่/สถิติอยู่แล้ว) ถ้าตั้งใหม่:
1. สร้างโปรเจกต์ใน Supabase
2. รัน `supabase/schema.sql` ใน SQL editor (**หมายเหตุ:** ไฟล์นี้อาจไม่ตรงกับ DB จริงทั้งหมด เพราะ DB เดิมมีการปรับหลัง seed — ตรวจเทียบก่อนใช้กับโปรเจกต์ที่มีข้อมูลอยู่แล้ว)
3. ใส่ `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` ใน `.env`
4. เปิด Google provider ใน Supabase Auth (ต้องใช้ OAuth Client ID/Secret จาก Google Cloud Console):
   - Google Cloud → Credentials → OAuth Client (Web) → ใส่ Authorized redirect URI เป็น `https://<project-ref>.supabase.co/auth/v1/callback` (ถ้าไม่ตรงจะขึ้น `redirect_uri_mismatch`)
   - Supabase → Authentication → URL Configuration → ใส่ Site URL และ Redirect URLs (เช่น `http://localhost:5173/**` และโดเมน production)

## ตั้งค่า AI Coach (Gemini free tier)
1. สร้าง API key ที่ https://aistudio.google.com/apikey
2. Supabase Dashboard → Edge Functions → Secrets เพิ่ม:
   - `GEMINI_API_KEY` = key ที่สร้าง
   - `GEMINI_MODEL` = ชื่อรุ่นที่ใช้ free tier ได้ — ตรวจรุ่นและโควต้าล่าสุดใน AI Studio เพราะเปลี่ยนบ่อย (ถ้าเจอ 429 บ่อยให้ลองรุ่นที่เบากว่า)
3. Deploy: `supabase functions deploy ai-coach` (โค้ดอยู่ที่ `supabase/functions/ai-coach/index.ts`, เปิด `verify_jwt`)
4. อย่าใส่ API key ใน `VITE_*` เด็ดขาด — ตัวแปรกลุ่มนี้ถูกฝังใน bundle ฝั่งเบราว์เซอร์

## Known limitations / ขั้นตอนถัดไป

**ยังใช้ mock (ตารางใน DB ว่างหรือยังไม่ได้ต่อ)**
- **Item Build / ไอเทม:** โค้ดยังอ่านจาก `src/data/items.mock.ts` (curated แค่ Florentino) ทั้งที่ตาราง `items` ใน DB มีข้อมูลแล้ว ส่วน `item_builds` ยังว่าง — ต้องต่อ `services/items.ts` เข้ากับ Supabase
- **Matchup:** ตาราง `matchups` ว่าง ใช้ mock + heuristic จาก Win Rate
- **Guides (`/learn`):** ตาราง `guides` ว่าง ใช้ mock
- **Hero synergies:** ตาราง `hero_synergies` ว่าง
- **Insight บน Home:** เป็นข้อมูลตัวอย่างทั้งหมด (`src/data/insights.mock.ts`) รอระบบวิเคราะห์แมตช์ของผู้ใช้

**ยังไม่ได้ทำ**
- Community comments ในหน้า Hero Detail ยังเป็น placeholder
- ตาราง `saved_builds` / `saved_drafts` มีแล้วแต่ยังไม่มี service/หน้าจอ
- Admin panel สำหรับเติมข้อมูล
- ไอเทมยังไม่มีไอคอน (ใช้ตัวอักษรย่อ)
- ระบบวิเคราะห์แมตช์ผู้เล่น (RoV Coach): ยังอยู่ในขั้นออกแบบ ยังไม่มีโค้ด

**ข้อควรระวัง**
- Draft Assistant ใช้ heuristic ตาม Role (`ROLE_TAGS`) เพราะยังไม่มี tag ดาเมจ/CC/mobility ระดับสกิลจริง
- Matchup/Counter/Build ที่ไม่มีข้อมูล curated จะ fallback เป็น heuristic ที่ label ไว้ชัดเจนเสมอ ไม่ปะปนกับข้อมูลจริง
- free tier ของ Gemini มี rate limit ต่อโปรเจกต์ (เจอ 429 ได้) และ Google อาจนำเนื้อหาที่ส่งไปใช้ปรับปรุงผลิตภัณฑ์ — ห้ามส่งข้อมูลส่วนตัวผู้ใช้เข้า prompt
- คำตอบจาก AI เป็นข้อความที่โมเดลสร้างจากข้อมูลที่ส่งไป ไม่ใช่ข้อมูลยืนยัน — ต้อง label ในหน้าจอว่าเป็นคำแนะนำจาก AI

## หมายเหตุเรื่องข้อมูล
ข้อมูลฮีโร่, สถิติ (`hero_stats`) และตัวสวน (`hero_counters`) เป็นข้อมูลจริงจาก Supabase ส่วนที่ยังเป็น mock อยู่ที่ `src/data/*.mock.ts` และใช้เป็น fallback เมื่อไม่ได้ตั้งค่า Supabase โครงสร้างชนิดข้อมูล (`src/types/*`) ออกแบบให้ตรงกับ schema เพื่อสลับ mock → ของจริงได้โดยไม่ต้องรื้อ UI
