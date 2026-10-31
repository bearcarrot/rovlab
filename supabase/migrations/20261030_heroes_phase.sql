-- ช่วงเกมที่ฮีโร่แข็งที่สุด (early = ต้นเกม, mid = กลางเกม, late = เลทเกม) — แอดมินเลือกจาก dropdown ในหน้าแก้ไขฮีโร่ (ต่อจาก difficulty)
-- Draft Assistant ใช้คำนวณมิเตอร์ช่วงเกมของทีม; null = ประเมินจาก Role (heuristic) เหมือนเดิม
-- คอลัมน์เพิ่มในตาราง heroes เดิม → ไม่มี request ใหม่ และผ่าน CDN แคช /api/sb ได้เหมือนรายชื่อฮีโร่
-- หมายเหตุ: ไม่ได้เพิ่มใน supabase/schema.sql (ไฟล์นั้นเป็น MVP เก่า ตารางหลังๆ อยู่ใน migrations)
alter table public.heroes
  add column if not exists phase text check (phase in ('early','mid','late'));
