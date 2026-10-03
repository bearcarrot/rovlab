-- Rename the lane code 'support' -> 'roaming' (hero_lanes.code, heroes.lane / heroes.lanes, tier_lists.lane).
-- Role code 'support' (hero_roles, heroes.role / heroes.roles) is a different thing and is NOT changed.
-- The display name lives in hero_lanes.label (set to 'Roaming' separately).
begin;

alter table public.heroes drop constraint if exists heroes_lane_check;
alter table public.heroes drop constraint if exists heroes_lanes_valid;
alter table public.hero_lanes drop constraint if exists hero_lanes_code_check;

-- heroes_sync_primary keeps heroes.lane = lanes[1], so update both columns in one statement
update public.heroes
   set lanes = array_replace(lanes, 'support', 'roaming'),
       lane  = case when lane = 'support' then 'roaming' else lane end
 where lane = 'support' or 'support' = any (lanes);

update public.tier_lists set lane = 'roaming' where lane = 'support';
update public.hero_lanes set code = 'roaming' where code = 'support';

alter table public.heroes add constraint heroes_lane_check
  check (lane = any (array['slayer', 'jungle', 'mid', 'abyssal', 'roaming']));
alter table public.heroes add constraint heroes_lanes_valid
  check (lanes <@ array['slayer', 'jungle', 'mid', 'abyssal', 'roaming']);
alter table public.hero_lanes add constraint hero_lanes_code_check
  check (code = any (array['slayer', 'jungle', 'mid', 'abyssal', 'roaming']));

commit;
