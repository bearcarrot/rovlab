-- นำเข้าสถิติ Pro (Liquipedia RoV Pro League) → hero_stats.rank_tier = 'pro'
-- ไม่ต้องแก้ schema: hero_stats.rank_tier เป็น text ไม่มี check อยู่แล้ว ฝั่งเว็บอ่านด้วย .eq("rank_tier", rank)
-- แถวมาจาก Edge Function pro-stats: { name, picks, win_rate, pick_rate, ban_rate, tier } (tier ตัดจาก ∑ ฝั่ง function)
-- จับคู่ฮีโร่ด้วยชื่อ (ตัดอักขระที่ไม่ใช่ตัวอักษร/ตัวเลข ไม่สนตัวพิมพ์) — ชื่อที่หาไม่เจอคืนใน unmatched และถูกข้าม
-- รันซ้ำได้: อัปเดตทับแถว (hero, patch, 'pro') เดิม รวมถึง tier (Pro ตัดอัตโนมัติ ไม่ใช่แอดมินจัดเอง)
create or replace function public.admin_import_pro_stats(p_patch uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  n_stats int := 0;
  unmatched jsonb;
begin
  if not public.is_admin() then
    raise exception 'ต้องเป็นแอดมินเท่านั้น';
  end if;
  if not exists (select 1 from public.patches where id = p_patch) then
    raise exception 'ไม่พบแพตช์';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'ไม่มีข้อมูลสถิติ';
  end if;

  create temp table _pro on commit drop as
  select
    lower(regexp_replace(r->>'name', '[^[:alnum:]]', '', 'g')) as k,
    r->>'name'                 as name,
    (r->>'picks')::int         as m,
    (r->>'win_rate')::numeric  as wr,
    (r->>'pick_rate')::numeric as pr,
    (r->>'ban_rate')::numeric  as br,
    r->>'tier'                 as tier
  from jsonb_array_elements(p_rows) r;

  if exists (select 1 from _pro where k = '' or m < 0 or wr not between 0 and 100 or pr not between 0 and 100 or br not between 0 and 100) then
    raise exception 'ข้อมูลสถิติผิดรูปแบบ';
  end if;

  select coalesce(jsonb_agg(p.name order by p.name), '[]'::jsonb) into unmatched
  from _pro p
  where not exists (
    select 1 from public.heroes h where lower(regexp_replace(h.name, '[^[:alnum:]]', '', 'g')) = p.k
  );

  with up as (
    insert into public.hero_stats (hero_id, patch_id, rank_tier, win_rate, pick_rate, ban_rate, tier, matches)
    select h.id, p_patch, 'pro', p.wr, p.pr, p.br, p.tier, p.m
    from _pro p
    join public.heroes h on lower(regexp_replace(h.name, '[^[:alnum:]]', '', 'g')) = p.k
    on conflict (hero_id, patch_id, rank_tier) do update
      set win_rate = excluded.win_rate, pick_rate = excluded.pick_rate, ban_rate = excluded.ban_rate,
          tier = excluded.tier, matches = excluded.matches
    returning 1
  )
  select count(*) into n_stats from up;

  return jsonb_build_object('stats', n_stats, 'unmatched', unmatched);
end;
$function$;

-- เรียกได้เฉพาะผู้ล็อกอิน (ตัวฟังก์ชันเช็ก is_admin ซ้ำอีกชั้น)
revoke all on function public.admin_import_pro_stats(uuid, jsonb) from public, anon;
grant execute on function public.admin_import_pro_stats(uuid, jsonb) to authenticated;
