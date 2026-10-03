-- Rename the role code 'marksman' -> 'carry' (hero_roles.code, heroes.role / heroes.roles).
-- Lane codes and the role code 'support' are not touched. Display names live in hero_roles.label.
begin;

alter table public.heroes drop constraint if exists heroes_role_check;
alter table public.heroes drop constraint if exists heroes_roles_valid;
alter table public.hero_roles drop constraint if exists hero_roles_code_check;

-- heroes_sync_primary keeps heroes.role = roles[1], so update both columns in one statement
update public.heroes
   set roles = array_replace(roles, 'marksman', 'carry'),
       role  = case when role = 'marksman' then 'carry' else role end
 where role = 'marksman' or 'marksman' = any (roles);

update public.hero_roles set code = 'carry' where code = 'marksman';

alter table public.heroes add constraint heroes_role_check
  check (role = any (array['assassin', 'fighter', 'mage', 'carry', 'support', 'tank']));
alter table public.heroes add constraint heroes_roles_valid
  check (roles <@ array['assassin', 'fighter', 'mage', 'carry', 'support', 'tank']);
alter table public.hero_roles add constraint hero_roles_code_check
  check (code = any (array['assassin', 'fighter', 'mage', 'carry', 'support', 'tank']));

commit;
