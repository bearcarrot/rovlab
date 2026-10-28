-- Public aggregate: number of registered accounts, rounded DOWN to the nearest 100 (so it never overstates and never reveals the exact figure).
-- NOT APPLIED. Review, then apply to the production project yourself (this PR only adds the file).
-- Why a function: profiles RLS only lets a user read their own row, so anon cannot count it, and we deliberately do not
-- open the table or use the service_role key. The function returns one integer and nothing else (no ids, emails or names).
-- Called only by api/public-stats.ts (CDN-cached for 24h), not by browsers directly.

create or replace function public.get_public_account_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (floor(count(*) / 100.0) * 100)::integer from public.profiles;
$$;

revoke execute on function public.get_public_account_count() from public;
grant execute on function public.get_public_account_count() to anon, authenticated;
