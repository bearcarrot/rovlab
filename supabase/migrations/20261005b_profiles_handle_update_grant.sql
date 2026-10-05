-- ให้ผู้ใช้ที่ล็อกอินแก้ชื่อผู้ใช้สำหรับ @แท็ก (profiles.handle) ของตัวเองได้
-- 20261004000000_community_v2.sql สร้างคอลัมน์ handle + หน้าแก้ไขใน Profile (HandleCard) แต่ไม่ได้ GRANT UPDATE ให้คอลัมน์นี้
-- ตาราง profiles จำกัดสิทธิ์เขียนเป็นรายคอลัมน์ จึงขึ้น 42501 "ไม่มีสิทธิ์ทำรายการนี้ (ต้องล็อกอิน)" ทั้งที่ล็อกอินอยู่
-- RLS "own profile update" ยังบังคับว่าแก้ได้เฉพาะแถวของตัวเอง · รูปแบบ/ซ้ำ/คำหยาบ ตรวจโดย check constraint, unique index, trigger profiles_filter
-- (แอปพลาย migration นี้บน DB จริงแล้ว ไฟล์นี้เก็บไว้ให้ repo ตรงกับ DB)
grant update (handle) on public.profiles to authenticated;
