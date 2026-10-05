-- สีป้ายของแท็กสกิล (hero_abilities.effect_tags) แก้ได้จากหน้าแอดมิน แท็บ "แท็กและสี"
-- name ต้องตรงกับชื่อแท็กที่ใช้ใน effect_tags ของสกิล · tag_type = รหัสแท็กของเกม (ใช้ตอนเพิ่มแท็กให้สกิลเอง)
-- แท็กที่ไม่มีแถวในตารางนี้ แอปใช้สีเริ่มต้นตามกลุ่มใน src/lib/effectTags.ts
create table if not exists public.effect_tag_styles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  tag_type int,
  color text not null default '#94a3b8' check (color ~* '^#[0-9a-f]{6}$'),
  created_at timestamptz not null default now()
);

alter table public.effect_tag_styles enable row level security;

drop policy if exists "public read effect_tag_styles" on public.effect_tag_styles;
create policy "public read effect_tag_styles" on public.effect_tag_styles for select using (true);

drop policy if exists "admin write effect_tag_styles" on public.effect_tag_styles;
create policy "admin write effect_tag_styles" on public.effect_tag_styles
  for all to authenticated using (is_admin()) with check (is_admin());

insert into public.effect_tag_styles (name, tag_type, color) values
  ('กายภาพ', 1, '#ef4444'), ('เวท', 2, '#3b82f6'), ('จริง', 3, '#94a3b8'),
  ('เพิ่มความเร็ว', 4, '#10b981'), ('ป้องกัน', 5, '#14b8a6'), ('เคลื่อนที่', 6, '#10b981'),
  ('ควบคุม', 7, '#eab308'), ('ฮีล', 8, '#22c55e'), ('ต้านความเสียหาย', 9, '#14b8a6'),
  ('ลดความเร็ว', 10, '#06b6d4'), ('ความเสียหายหมู่', 11, '#f97316'), ('คืนชีพ', 12, '#22c55e'),
  ('ล่องหน', 13, '#94a3b8'), ('ต้านสถานะ', 15, '#14b8a6'), ('บัฟ', 16, '#ec4899'),
  ('สถานะ', 17, '#94a3b8'), ('ความเสียหาย', 18, '#94a3b8'), ('วาร์ป', 19, '#10b981'),
  ('แปลงร่าง', 20, '#94a3b8'), ('ไม่ตกเป็นเป้าหมาย', 22, '#14b8a6'), ('เปิดแผนที่', 23, '#94a3b8'),
  ('ลดความเสียหาย', 24, '#14b8a6'), ('เพิ่มความเสียหาย', 25, '#ec4899'), ('ซัมม่อน', 26, '#94a3b8'),
  ('เพิ่มความเร็วโจมตี', 27, '#ec4899'), ('ป้องกันตาย', 28, '#14b8a6'), ('สิงร่าง', 29, '#94a3b8'),
  ('ล้างสถานะ', 30, '#14b8a6'), ('สตั๊น', 31, '#eab308'), ('ลอยขึ้น', 32, '#eab308'),
  ('ผลักถอยหลัง', 33, '#eab308'), ('ใบ้', 34, '#eab308'), ('แช่แข็ง', 35, '#eab308'),
  ('ยั่วยุ', 37, '#eab308'), ('ล็อคตัว', 38, '#eab308'), ('จำกัด', 39, '#eab308'),
  ('หยุดนิ่ง', 41, '#eab308'), ('ดูดกลืน', 43, '#eab308'), ('พิเศษ', 44, '#94a3b8'),
  ('ความเสียหายผสม', 45, '#a855f7'), ('กันกายภาพ', 46, '#14b8a6'), ('ย้อนกลับ', 48, '#94a3b8')
on conflict (name) do nothing;
