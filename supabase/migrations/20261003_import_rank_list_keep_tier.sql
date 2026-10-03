-- นำเข้าสถิติ: ไม่ทับ tier ของแถวเดิม (แอดมินจัดเทียร์เอง) และไม่ทำลาย lane_tip ของเคาน์เตอร์
-- แถวใหม่ยังได้ tier เริ่มต้นจาก win rate เพราะคอลัมน์ tier เป็น NOT NULL
-- (ถูก apply กับฐานข้อมูลจริงแล้ว เก็บไฟล์นี้ไว้ให้ repo ตรงกับ DB)
create or replace function public.admin_import_rank_list(p_patch uuid, p_rank text, p_rows jsonb, p_counters boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  n_stats int := 0;
  n_counters int := 0;
  unmatched jsonb;
begin
  if not public.is_admin() then
    raise exception 'ต้องเป็นแอดมินเท่านั้น';
  end if;
  if p_rank not in ('all', 'high') then
    raise exception 'rank ไม่ถูกต้อง: %', p_rank;
  end if;
  if not exists (select 1 from public.patches where id = p_patch) then
    raise exception 'ไม่พบแพตช์';
  end if;

  create temp table _src on commit drop as
  select
    (r->>'id')::int            as game_id,
    r->>'name'                 as name,
    (r->>'win_rate')::numeric  as wr,
    (r->>'pick_rate')::numeric as pr,
    (r->>'ban_rate')::numeric  as br,
    coalesce((r->>'matches')::int, 0) as m,
    nullif(r->>'w1', '')::int  as w1,
    nullif(r->>'w2', '')::int  as w2,
    nullif(r->>'w3', '')::int  as w3
  from jsonb_array_elements(p_rows) r;

  select coalesce(jsonb_agg(jsonb_build_object('id', s.game_id, 'name', s.name) order by s.game_id), '[]'::jsonb)
    into unmatched
  from _src s
  where not exists (select 1 from public.heroes h where h.hero_id = s.game_id);

  with up as (
    insert into public.hero_stats (hero_id, patch_id, rank_tier, win_rate, pick_rate, ban_rate, tier, matches)
    select h.id, p_patch, p_rank, s.wr, s.pr, s.br,
           case when s.wr >= 52 then 'S+' when s.wr >= 50.5 then 'S' when s.wr >= 49 then 'A' when s.wr >= 47.5 then 'B' else 'C' end,
           s.m
    from _src s join public.heroes h on h.hero_id = s.game_id
    on conflict (hero_id, patch_id, rank_tier) do update
      set win_rate = excluded.win_rate, pick_rate = excluded.pick_rate, ban_rate = excluded.ban_rate,
          matches = excluded.matches   -- ไม่แตะ tier เดิม
    returning 1
  )
  select count(*) into n_stats from up;

  if p_counters then
    -- hero_id = ฮีโร่ที่โดนชนะ (winrateNHero), counter_hero_id = ฮีโร่ในไฟล์ที่ชนะทาง
    create temp table _pairs on commit drop as
    select v.id as victim, w.id as winner, p.rk
    from (
      select s.game_id as target, s.w1 as lost_to_target, 1 as rk from _src s where s.w1 is not null
      union all select s.game_id, s.w2, 2 from _src s where s.w2 is not null
      union all select s.game_id, s.w3, 3 from _src s where s.w3 is not null
    ) p
    join public.heroes w on w.hero_id = p.target
    join public.heroes v on v.hero_id = p.lost_to_target;

    -- อัปเดตเฉพาะแถวที่ระบบสร้างจากสถิติ (คง lane_tip) แถวที่แอดมินเขียนเองไม่แตะ
    with ins as (
      insert into public.hero_counters (hero_id, counter_hero_id, strength, reason)
      select pr.victim, pr.winner,
             case pr.rk when 1 then 'best' when 2 then 'good' else 'situational' end,
             'ชนะทางอันดับ ' || pr.rk || ' ตามสถิติแรงก์จริง'
      from _pairs pr
      on conflict (hero_id, counter_hero_id) do update
        set strength = excluded.strength, reason = excluded.reason
        where public.hero_counters.reason like 'ชนะทางอันดับ _ ตามสถิติแรงก์จริง'
      returning 1
    )
    select count(*) into n_counters from ins;

    -- ลบคู่เก่าที่หลุด top-3 แล้ว (เฉพาะแถวอัตโนมัติ)
    delete from public.hero_counters hc
    where hc.reason like 'ชนะทางอันดับ _ ตามสถิติแรงก์จริง'
      and not exists (select 1 from _pairs pr where pr.victim = hc.hero_id and pr.winner = hc.counter_hero_id);
  end if;

  return jsonb_build_object('stats', n_stats, 'counters', n_counters, 'unmatched', unmatched);
end;
$function$;
