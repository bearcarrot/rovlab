-- แต้มความแข็งแกร่งช่วงเกมของฮีโร่ (ต้น/กลาง/ท้ายเกม) ต่อเลน — แอดมินกรอกเองที่แท็บ "ช่วงเกม"
-- แต้ม 1-10 ต่อช่วง ต่อ (ฮีโร่, เลน) เพราะฮีโร่ตัวเดียวกันแรงไม่เท่ากันในแต่ละเลน
-- ฮีโร่/เลนที่ไม่มีแถว = แอปประเมินจาก Role (heuristic) เหมือนเดิม
-- หมายเหตุ: ตารางนี้ไม่ได้เพิ่มลงใน supabase/schema.sql (ไฟล์นั้นเป็น MVP เก่า ตารางหลังๆ อยู่ใน migrations)
create table if not exists public.hero_phase_points (
  id uuid primary key default gen_random_uuid(),
  hero_id uuid not null references public.heroes(id) on delete cascade,
  lane text not null check (lane in ('slayer','jungle','mid','abyssal','roaming')),
  early smallint not null check (early between 1 and 10),
  mid smallint not null check (mid between 1 and 10),
  late smallint not null check (late between 1 and 10),
  created_at timestamptz not null default now(),
  unique (hero_id, lane)
);

alter table public.hero_phase_points enable row level security;

drop policy if exists "public read hero_phase_points" on public.hero_phase_points;
create policy "public read hero_phase_points" on public.hero_phase_points for select using (true);

drop policy if exists "admin write hero_phase_points" on public.hero_phase_points;
create policy "admin write hero_phase_points" on public.hero_phase_points
  for all to authenticated using (is_admin()) with check (is_admin());
