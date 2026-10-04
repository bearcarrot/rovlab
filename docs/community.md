# Community comments v2 (Hero Detail)

ต่อยอดจากระบบคอมเมนต์เดิม (`comments`, `list_hero_comments`, `comments_rate_limit_trg`, `is_admin()` / `admin_users`, การบังคับยืนยันอีเมล) — ไม่ได้สร้างของซ้ำ

## ติดตั้ง
1. รีวิวแล้วรัน `supabase/migrations/20261004000000_community_v2.sql` (additive ทั้งหมด) — **ยังไม่ได้รันกับ DB จริง** แต่ผม dry-run ทั้งไฟล์ใน transaction ที่ rollback บนโปรเจกต์จริงแล้ว: mention/reply/like/follow notification ถูกสร้าง, นับ like/dislike/emoji/reply ถูกต้อง, `list_comments` คืนค่าถูก, client แก้ยอด like เองไม่ได้ (permission denied), แก้ไขคอมเมนต์ตั้ง `edited_at`, ตัวกรองคำหยาบบล็อกไทย/อังกฤษได้ (เทสต์ตัวกรองแยกอีกรอบหลังแก้)
2. แอดมินใช้ `admin_users` เดิม (ไม่มีตารางใหม่)
3. เพิ่มคำที่ต้องกรอง (**DATA SOURCE REQUIRED** — ตารางว่างตามค่าเริ่มต้น ไม่ได้ใส่ลิสต์ให้) จาก SQL editor หรือด้วยบัญชีแอดมิน:
   ```sql
   insert into banned_words (word, lang) values ('<คำไทย>', 'th'), ('<english word>', 'en');
   ```
   - `th`: substring หลังตัดวรรณยุกต์/ช่องว่าง/สัญลักษณ์ ยอมให้อักษรซ้ำ (ไม่ต้องใส่วรรณยุกต์ในคำ)
   - `en`: ทั้งคำ (กัน false positive เช่น "class" ไม่โดนคำว่า "ass") ยอมให้อักษรซ้ำและ leetspeak (`sh!t`, `$hit`, `badw0rd`)

## สิ่งที่เพิ่ม
- ตอบกลับ 1 ระดับ, Like/Dislike, อีโมจิ 🔥😂👏, เรียง ยอดนิยม/ใหม่สุด, แก้ไข/ลบของตัวเอง
- `@handle` พร้อม autocomplete (`profiles.handle` ใหม่ สร้างอัตโนมัติ `user_xxxxxxxx` แก้ได้ที่หน้าโปรไฟล์) — ลิงก์ `/u/:handle` จะ redirect ไป `/players/:id` เดิม
- กระดิ่งใน Header (ซ้ายของรูปโปรไฟล์) + หน้า `/notifications` อัปเดตสดด้วย Realtime; แจ้งเตือน mention / reply / like / follow (ไม่แจ้งตัวเอง, ไม่แจ้งคนที่ถูกบล็อก)
- รายงาน (ซ่อนอัตโนมัติเมื่อครบ 3 คน), บล็อกผู้ใช้, แอดมินปักหมุด/ซ่อน, badge แอดมิน
- ติดตามผู้ใช้ (ปุ่มที่ `/players/:id`), ฟีด `/feed`, แชร์ลิงก์คอมเมนต์ (Web Share / LINE / Facebook / X / คัดลอก)

## ที่ต่างจากเดิม / ข้อจำกัด
- ความยาวคอมเมนต์ยังเป็น 500 ตัวอักษร และ rate limit เดิม 10 วินาที/คอมเมนต์ (ใช้ของเดิม)
- การลบยังเป็นลบจริง (ตาม policy เดิม): ลบคอมเมนต์หลัก = ตอบกลับทั้งหมดถูกลบตาม
- ต้องยืนยันอีเมลก่อนคอมเมนต์/ตอบกลับ (เหมือนเดิม — บังคับที่ UI; DB ยังไม่บังคับ) ส่วน Like/อีโมจิ/ติดตาม ทำได้เมื่อล็อกอิน
- `comments` ฝั่ง client เขียนได้เฉพาะ `user_id, hero_slug, guide_id, body, parent_id` (ยอด like / pinned / hidden เขียนเองไม่ได้); คอมเมนต์ที่ถูกซ่อนเห็นได้เฉพาะเจ้าของ/แอดมิน
- `display_name` ที่เปิดเผยผ่าน RPC เท่ากับที่ `list_hero_comments` เปิดเผยอยู่แล้ว (ชื่อ + รูป)
- TikTok / Instagram ไม่มี web share intent สำหรับลิงก์ → ใช้ "คัดลอกลิงก์" แทน
- แก้ไขคอมเมนต์ไม่แจ้งเตือน @แท็กใหม่; ตัวกรองเป็น regex ตามลิสต์ ไม่ใช่ AI
