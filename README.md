# RovLab — RoV Companion App (MVP scaffold)

Stack: React + TypeScript + Vite + Tailwind + shadcn-style UI + Lucide + React Router.
Backend (not wired yet): Supabase (Postgres + Auth + RLS), deploy target Vercel.

## สิ่งที่มีในรอบนี้ (ครบทุก Step ของ MVP)
- Vite/TS/Tailwind config พร้อม design tokens (สี/ฟอนต์/รัศมีขอบ) — ดู `tailwind.config.ts`
- App shell: Sidebar (desktop), Header, Bottom Nav + Slide-out Drawer (mobile)
- Routing ครบทุกหมวดตาม IA — `/heroes`, `/tier-list`, `/counter-pick`, `/matchup`, `/draft`, `/build`, `/favorites`, `/profile`, `/login` ใช้งานได้จริง (`/stats`, `/learn` ยังเป็น placeholder)
- Home Dashboard: Insight cards (what/why/fix/practice), Quick actions, Hero rows (Win Rate สูงสุด / Ban Rate สูงสุด)
- Hero Database: ค้นหา + กรอง Role/Lane
- Hero Detail: สถิติ, จุดแข็ง/จุดอ่อน, ใครสวนได้/สวนใครได้ (พร้อมเหตุผลทุกรายการ), ฮีโร่เข้าคู่, ปุ่มรายการโปรด
- Tier List: จัดกลุ่มตาม Tier พร้อมเหตุผลสั้น ๆ ต่อฮีโร่ (คำนวณจาก Win/Ban/Pick Rate), กรอง Role/Lane
- Counter Pick: เลือกฮีโร่ศัตรู → ดูตัวสวนพร้อมเหตุผลและคำแนะนำเลน
- Matchup: เทียบฮีโร่ 2 ตัว — ข้อมูลเจาะจง (curated) หรือ heuristic จาก Win Rate เมื่อยังไม่มีข้อมูล (label ชัดเจนทั้งสองแบบ)
- Draft Assistant: เลือกทีมทีละช่อง วิเคราะห์ดาเมจ/แนวหน้า/CC/Mobility/Sustain/Early-Late และแนะนำตัวถัดไปพร้อมดาว+เหตุผล (label ว่าเป็น Heuristic เสมอ ไม่อ้างความแม่นยำเกินจริง)
- AI Coach (Gemini): ปุ่ม "ถามโค้ช AI" ใน `RecommendedPickCard` อธิบายเหตุผลการแนะนำฮีโร่ผ่าน Supabase Edge Function `ai-coach` (ซ่อน API key ไว้ฝั่งเซิร์ฟเวอร์, ต้องล็อกอินก่อนถึงจะเรียกได้, กดถามทีละการ์ดเพื่อประหยัดโควต้า free tier) — เรียกจากโค้ดผ่าน `askCoach()` ใน `src/services/ai.ts`
- Item Build: เลือกฮีโร่ → บิลด์แนะนำแยกตามช่วงเกมพร้อมเหตุผล + Arcana (label curated vs heuristic)
- Auth: Supabase Auth (Email + Google) พร้อม Guest browsing — ถ้ายังไม่ตั้งค่า `.env` ระบบจะโชว์สถานะ "ยังไม่ได้เชื่อม Supabase" แทนที่จะพัง
- Favorites: กดหัวใจที่การ์ดฮีโร่/หน้า Hero Detail บันทึกลง Supabase (ต้องล็อกอิน), มีหน้ารวมรายการโปรด
- Profile: แก้ Role ที่ถนัด, ออกจากระบบ
- Supabase schema เต็มรูปแบบพร้อม RLS — `supabase/schema.sql` (heroes, hero_stats, hero_counters, hero_synergies, items, item_builds, matchups, tier_lists, guides, profiles, favorites, saved_builds, saved_drafts, comments)
- Service layer (`src/services/*`) แยกจาก UI แล้วทุกฟีเจอร์ — สลับจาก mock ไป Supabase ได้โดยไม่แตะ component
- Loading / Empty / Error state ใช้ pattern เดียวกันทั้งแอป (`useAsync` hook + `Skeleton`/`EmptyState`/`ErrorState`)

## รันโปรเจกต์
```bash
npm install
cp .env.example .env   # ใส่ค่า Supabase เพื่อเปิด Auth/Favorites/Profile (ไม่ใส่ก็ใช้ Guest browsing ได้ปกติ)
npm run dev
```

## ตั้งค่า Supabase (เมื่อพร้อม)
1. สร้างโปรเจกต์ใหม่ใน Supabase
2. รัน `supabase/schema.sql` ใน SQL editor
3. ใส่ `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` ใน `.env`
4. เปิด Google provider ใน Supabase Auth (ต้องใช้ OAuth Client ID/Secret จาก Google Cloud Console):
   - Google Cloud → Credentials → OAuth Client (Web) → ใส่ Authorized redirect URI เป็น `https://<project-ref>.supabase.co/auth/v1/callback` (ถ้าไม่ตรงจะขึ้น `redirect_uri_mismatch`)
   - Supabase → Authentication → URL Configuration → ใส่ Site URL และ Redirect URLs (เช่น `http://localhost:5173/**` และโดเมน production)
5. Seed ข้อมูลฮีโร่จริงลงตาราง `heroes`/`hero_stats`/ฯลฯ แล้วสลับ `src/services/*.ts` จาก mock ไปเรียก Supabase จริง (โครงสร้างพร้อมรับอยู่แล้ว)

## ตั้งค่า AI Coach (Gemini free tier)
1. สร้าง API key ที่ https://aistudio.google.com/apikey
2. Supabase Dashboard → Edge Functions → Secrets เพิ่ม:
   - `GEMINI_API_KEY` = key ที่สร้าง
   - `GEMINI_MODEL` = ชื่อรุ่นที่ใช้ free tier ได้ (เช่น `gemini-3.8-flash`, หรือ `gemini-3.5-flash-lite` ถ้าเจอ 429 บ่อย) — ตรวจรุ่นและโควต้าล่าสุดใน AI Studio เพราะเปลี่ยนบ่อย
3. Deploy: `supabase functions deploy ai-coach` (โค้ดอยู่ที่ `supabase/functions/ai-coach/index.ts`, เปิด `verify_jwt`)
4. อย่าใส่ API key ใน `VITE_*` เด็ดขาด — ตัวแปรกลุ่มนี้ถูกฝังใน bundle ฝั่งเบราว์เซอร์

## Known limitations / ขั้นตอนถัดไป
- `/stats` และ `/learn` ยังเป็น placeholder — รอ schema สถิติแมตช์จริงและระบบคู่มือ
- Community comments ในหน้า Hero Detail ยังเป็น placeholder (ต้องรอ auth จริงต่อกับ Supabase ก่อนถึงจะเปิดใช้ตาราง `comments`)
- `heroes.icon`/`items.icon` ยังไม่มีรูปจริง ใช้ตัวอักษรย่อแทนไปก่อน — ใส่ URL รูปเมื่อมี asset
- Draft Assistant ใช้ heuristic ตาม Role (`ROLE_TAGS`) เพราะยังไม่มี tag ดาเมจ/CC/มือถือระดับสกิลจริงในข้อมูล — แม่นยำขึ้นเมื่อมีข้อมูลเจาะจงต่อฮีโร่
- Matchup/Counter/Build ที่ไม่มีข้อมูล curated จะ fallback เป็น heuristic ที่ label ไว้ชัดเจนเสมอ ไม่ปะปนกับข้อมูลจริง
- AI Coach ตอนนี้ต่อกับ `RecommendedPickCard` เท่านั้น — หน้าอื่น (Stats, Matchup) ยังไม่ต่อ และ `/stats` ยังเป็น mock
- free tier ของ Gemini มี rate limit ต่อโปรเจกต์ (เจอ 429 ได้) และ Google อาจนำเนื้อหาที่ส่งไปใช้ปรับปรุงผลิตภัณฑ์ — ห้ามส่งข้อมูลส่วนตัวผู้ใช้เข้า prompt
- คำตอบจาก AI เป็นข้อความที่โมเดลสร้างจากข้อมูล heuristic/mock ที่ส่งไป ไม่ใช่ข้อมูลยืนยัน — ควร label ในหน้าจอให้ชัดเจนว่าเป็นคำแนะนำจาก AI

## หมายเหตุเรื่องข้อมูล
ข้อมูลฮีโร่/สถิติทั้งหมดตอนนี้เป็น **mock data ที่ label ไว้ชัดเจน** (`src/data/*.mock.ts`) โครงสร้างชนิดข้อมูล (`src/types/*`) ออกแบบให้ตรงกับ schema ใน Supabase (`supabase/schema.sql`) เพื่อให้สลับจาก mock → ของจริงได้โดยไม่ต้องรื้อ UI
