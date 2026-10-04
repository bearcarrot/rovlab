-- ลำดับการแสดงผลของคู่มือและหมวดคู่มือ (ตัวเลขน้อย = แสดงก่อน)
-- ค่าเริ่มต้น 0 ทั้งหมด → ถ้ายังไม่ได้ตั้งค่า หน้าเว็บจะเรียงตามระดับความยาก (ง่าย → ยาก) แล้วตามใหม่สุดเหมือนเดิม
-- ต้องรัน migration นี้ใน Supabase ก่อน deploy โค้ดที่อ่านคอลัมน์ sort_id

alter table guides add column if not exists sort_id int not null default 0;
alter table guide_categories add column if not exists sort_id int not null default 0;
