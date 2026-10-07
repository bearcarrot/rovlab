-- นำเข้าสถิติแรงก์: จัด Tier ตาม game_type เหมือนเคยทำใน index.php (ย้ายมาในหน้าแอดมิน)
--   p_rank = 'all'  (gameType 1): tier ตาม tid ของ API (1=S+ 2=S 3=A 4=B 5=C) → ทับ hero_stats.tier + อัปเดต Tier List ทางการ (tier_list_entries ลิสต์รวม lane ว่าง)
--   p_rank = 'high' (gameType 3): แอดมินจัดเอง → ไม่ทับ tier ของแถวเดิม และไม่แตะ tier_list_entries
-- แถวใหม่ทุกแรงก์ได้ tier เริ่มต้นจาก tid (ไม่มี tid ใช้ win rate) เพราะคอลัมน์ tier เป็น NOT NULL
-- สถิติอัปเดตผ่าน INSERT ... ON CONFLICT ที่ส่ง tier ครบเสมอ จึงไม่ชน NOT NULL (ปัญหาเดิมของ index.php ที่ตัดคอลัมน์ tier ออก)
-- ยังไม่ได้ apply กับฐานข้อมูลจริง — รันไฟล์นี้ใน Supabase SQL editor ก่อนใช้หน้านำเข้าใหม่
create or replace function public.admin_import_rank_list(p_patch uuid, p_rank text, p_rows jsonb, p_counters boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  n_stats int := 0;
  n_counters int := 0;
  n_tiers int := 0;
  n_tl int := 0;
  unmatched jsonb;
  tl_id uuid;
  is_auto boolean := (p_rank = 'all');
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
    nullif(r->>'w3', '')::int  as w3,
    -- tid จาก API: 1=S+ 2=S 3=A 4=B 5=C (นอกช่วงนี้หรือไม่มี = null)
    case nullif(r->>'tid', '')::int
      when 1 then 'S+' when 2 then 'S' when 3 then 'A' when 4 then 'B' when 5 then 'C'
    end                        as tid_tier
  from jsonb_array_elements(p_rows) r;

  select coalesce(jsonb_agg(jsonb_build_object('id', s.game_id, 'name', s.name) order by s.game_id), '[]'::jsonb)
    into unmatched
  from _src s
  where not exists (select 1 from public.heroes h where h.hero_id = s.game_id);

  -- 1) สถิติ: แถวใหม่ใส่ tier เริ่มต้น · แถวเดิมอัปเดตเฉพาะตัวเลข (ไม่แตะ tier ในขั้นนี้)
  with up as (
    insert into public.hero_stats (hero_id, patch_id, rank_tier, win_rate, pick_rate, ban_rate, tier, matches)
    select h.id, p_patch, p_rank, s.wr, s.pr, s.br,
           coalesce(
             s.tid_tier,
             case when s.wr >= 52 then 'S+' when s.wr >= 50.5 then 'S' when s.wr >= 49 then 'A' when s.wr >= 47.5 then 'B' else 'C' end
           ),
           s.m
    from _src s join public.heroes h on h.hero_id = s.game_id
    on conflict (hero_id, patch_id, rank_tier) do update
      set win_rate = excluded.win_rate, pick_rate = excluded.pick_rate, ban_rate = excluded.ban_rate,
          matches = excluded.matches   -- ไม่แตะ tier เดิม
    returning 1
  )
  select count(*) into n_stats from up;

  -- 2) แรงก์ all: ทับ tier ตาม tid + อัปเดต Tier List ทางการ (ลิสต์รวม lane ว่าง · ไม่แตะ reason และลิสต์รายเลน)
  if is_auto then
    with u as (
      update public.hero_stats hs
      set tier = s.tid_tier
      from _src s join public.heroes h on h.hero_id = s.game_id
      where hs.hero_id = h.id and hs.patch_id = p_patch and hs.rank_tier = p_rank
        and s.tid_tier is not null and hs.tier is distinct from s.tid_tier
      returning 1
    )
    select count(*) into n_tiers from u;

    if exists (select 1 from _src s join public.heroes h on h.hero_id = s.game_id where s.tid_tier is not null) then
      select id into tl_id from public.tier_lists
      where patch_id = p_patch and rank_tier = p_rank and lane is null
      limit 1;
      if tl_id is null then
        insert into public.tier_lists (patch_id, rank_tier) values (p_patch, p_rank) returning id into tl_id;
      end if;

      with e as (
        insert into public.tier_list_entries (tier_list_id, hero_id, tier)
        select tl_id, h.id, s.tid_tier
        from _src s join public.heroes h on h.hero_id = s.game_id
        where s.tid_tier is not null
        on conflict (tier_list_id, hero_id) do update set tier = excluded.tier   -- ไม่แตะ reason
        returning 1
      )
      select count(*) into n_tl from e;
    end if;
  end if;

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

  return jsonb_build_object(
    'stats', n_stats,
    'counters', n_counters,
    'tiers', n_tiers,
    'tierList', n_tl,
    'tierMode', case when is_auto then 'tid' else 'keep' end,
    'unmatched', unmatched
  );
end;
$function$;
