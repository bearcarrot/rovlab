# Community comments (Hero Detail)

สถานะ: โค้ดฝั่งแอป + migration อยู่ใน PR นี้ แต่ **migration ยังไม่ได้รันกับ Supabase จริง**

## ติดตั้ง
1. รีวิวแล้วรัน `supabase/migrations/20261004000000_community.sql` (SQL editor หรือ `supabase db push`)
2. ตั้งแอดมิน (ทำใน SQL editor เท่านั้น):
   ```sql
   insert into admins (user_id) values ('<uuid ของผู้ใช้>');
   ```
3. เพิ่มคำที่ต้องกรอง (**DATA SOURCE REQUIRED** — ตารางว่างตามค่าเริ่มต้น ไม่ได้ใส่ลิสต์ให้):
   ```sql
   insert into banned_words (word, lang) values ('<คำไทย>', 'th'), ('<english word>', 'en');
   ```
   - `th`: จับแบบ substring หลังตัดวรรณยุกต์/ช่องว่าง/สัญลักษณ์ และยอมให้อักษรซ้ำ
   - `en`: จับทั้งคำ (กัน false positive แบบ "class"), แปลง leetspeak `@$0134!`, ยอมให้อักษรซ้ำ
   - ไม่ต้องใส่วรรณยุกต์ในคำไทย
4. ผู้ใช้เดิมจะได้ `handle` อัตโนมัติ (`user_xxxxxxxx`) แก้ได้ที่หน้าโปรไฟล์

## ฟีเจอร์
- ตอบกลับ 1 ระดับ (ตอบ reply จะผูกกับคอมเมนต์หลัก + แท็กคนที่ตอบ), แก้ไข/ลบ (soft delete)
- Like/Dislike + อีโมจิ 🔥😂👏, เรียงตามยอดนิยม/ใหม่สุด
- @แท็ก (autocomplete) → แจ้งเตือน; ตอบกลับ/ถูกใจ/ติดตาม ก็แจ้งเตือน (ไม่แจ้งตัวเอง, ไม่แจ้งคนที่ถูกบล็อก)
- กระดิ่งใน Header (ซ้ายของไอคอนโปรไฟล์) อัปเดตสดผ่าน Supabase Realtime
- รายงาน (ซ่อนอัตโนมัติเมื่อมี 3 รายงาน), บล็อกผู้ใช้, แอดมินปักหมุด/ซ่อน
- ติดตามผู้ใช้, โปรไฟล์สาธารณะ `/u/:handle`, ฟีด `/feed`, แชร์ลิงก์คอมเมนต์ (Web Share / LINE / Facebook / X)

## ความปลอดภัย
- ตัวกรองคำหยาบ, rate limit (5 คอมเมนต์/นาที), ความยาว ≤ 1000 ตัวอักษร บังคับที่ DB (trigger) ไม่ใช่แค่ฝั่งเบราว์เซอร์
- ไคลเอนต์เขียนได้แค่ `user_id, hero_slug, guide_id, body, parent_id` (column grants) — แก้ยอด like / pinned / hidden เองไม่ได้
- `profiles` ยังเป็น owner-only; ข้อมูลสาธารณะผ่าน view `public_profiles` (เฉพาะ `id, handle, avatar_url`) เพราะ `display_name` ถูกสร้างจากอีเมล

## ข้อจำกัดที่รู้
- TikTok / Instagram ไม่มี web share intent สำหรับลิงก์ → ใช้ปุ่ม "คัดลอกลิงก์" แทน (ไม่ได้ฝัง/ล็อกอินกับแพลตฟอร์มเหล่านั้น)
- แก้ไขคอมเมนต์ไม่แจ้งเตือน @แท็กใหม่
- ตัวกรองเป็น regex ตามลิสต์ ไม่ใช่ AI — คำสะกดแปลก/เว้นวรรคแทรกในคำอังกฤษอาจหลุดได้
- Supabase advisor อาจเตือนเรื่อง view `public_profiles` (ทำงานแบบ definer) และฟังก์ชัน `is_admin` ที่ anon เรียกได้ — ตั้งใจ
- `supabase/schema.sql` ยังไม่ได้อัปเดต (เดิม drift กับ DB จริงอยู่แล้ว) ใช้ไฟล์ใน `supabase/migrations/` เป็นหลัก
