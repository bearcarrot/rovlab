-- แท็กชนิดสกิลจากเกม (skillEffectType + name เช่น 8 = ฮีล, 16 = บัฟ) ใช้ใน Draft Assistant
-- รูปแบบ: [{"type": 8, "name": "ฮีล"}, ...]
-- (ถูก apply กับฐานข้อมูลจริงแล้ว เก็บไฟล์นี้ไว้ให้ repo ตรงกับ DB)
alter table public.hero_abilities
  add column if not exists effect_tags jsonb not null default '[]'::jsonb;
