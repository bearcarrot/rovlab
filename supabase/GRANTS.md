# Supabase: explicit GRANTs required for new tables (effective 2026-10-30)

**Audience: every agent/contributor who writes or applies a migration for RoV LAB.**
Read this before creating any table in `public`. The audit below is already done; do not repeat it.

## What changed

From **2026-10-30**, Supabase stops automatically granting Data API access
(supabase-js / PostgREST / GraphQL) on **new tables in the `public` schema** for existing projects.

- Tables that already exist (everything applied to production project `mttcdaiwuasnkqlxbeqs`) are **not affected**.
- A table created on/after that date has **no grants** until the migration adds them. Without a grant the API returns `permission denied`.
- This also hits anything that replays migrations: new projects, preview branches, local `supabase db reset`.
- The email only talks about tables. This repo already pins `revoke`/`grant execute` on functions explicitly; keep doing that.

## Rule for every migration that creates a table

Put the grants **in the same migration** as `create table`. Grant the minimum each role needs and keep RLS on.
A GRANT is not a policy: RLS still decides which rows.

```sql
create table if not exists public.example (...);

alter table public.example enable row level security;
revoke all on table public.example from public, anon, authenticated;

-- pick ONLY what the feature needs:
grant select on public.example to anon;                                   -- public read
grant select, insert, update, delete on public.example to authenticated;  -- signed-in users (RLS limits rows)
grant select, insert, update, delete on public.example to service_role;   -- Edge Function using the service key directly
```

| Table is used by | Grant |
| --- | --- |
| Public read (catalogue, announcements) | `select` to `anon, authenticated` (column list if some columns are private, see `announcements`) |
| Signed-in users directly (own rows) | only the needed verbs to `authenticated` + matching RLS policies |
| Only SECURITY DEFINER RPCs (`coach_feedback`, `contact_messages`, `match_item_obs`, `ocr_usage*`, `creator_verifications`) | no table grant; `grant execute` on the RPC only |
| An Edge Function reading/writing the table with `SUPABASE_SERVICE_ROLE_KEY` | **explicit grant to `service_role`** |

Never grant to `anon` just to silence an error. Never weaken RLS or give `anon` write access
(see `20261014c_revoke_anon_match_results.sql`). Never edit a migration that is already applied: add a new one.

## Full audit (2026-10-21)

All 45 files in `supabase/migrations/` were read, plus `supabase/functions/hero-videos/index.ts`.
Not verified against the live database (no `pg_class` / `information_schema.role_table_grants` check was run).
No open PRs at the time.

### Compliant (explicit grants, or RPC-only by design)

`20261006_draft_series` (`community_drafts`, `community_draft_reactions`), `20261006_user_tier_lists`
(`user_tier_lists`, `community_tier_lists`, `community_tier_list_reactions`), `20261007_user_activity_events`,
`20261008_admin_user_management` (`admin_audit_log`), `20261014_user_build_reactions`, `20261016c_announcements`
(+ `announcement_dismissals`).

RPC-only, no client/service table access needed: `20261006_ai_coach_daily_quota` (`ai_coach_usage`),
`20261010_coach_feedback`, `20261010_match_results` (`ocr_usage`, `ocr_usage_global`),
`20261010_admin_roles_creator_verification` (`creator_verifications`), `20261014_contact_messages`,
`20261016b_match_item_obs`.

No new tables (alter / functions / data / policies only): `20260930_comments_hardening`,
`20260930_profiles_public_and_avatars`, `20261003_*` (all four), `20261004_auth_username_verification` (superseded no-op),
`20261004_guides_sort_id`, `20261004_hero_abilities_effect_tags`, `20261005_profile_contact_links`,
`20261006_auth_security_hardening`, `20261006_drop_kv_store`, `20261006_perf_indexes_and_rls`,
`20261007_import_rank_list_tid_tier`, `20261007_rollback_game_identity`, `20261008_items_tier`,
`20261010_game_catalog_admin`, `20261010_rename_arcana_to_rune`, `20261010b_*`, `20261010c_*`,
`20261011_*` (all four), `20261012_ocr_multi_image_quota`, `20261013_match_my_items`, `20261014b_*` (both),
`20261014c_*`, `20261015_*`, `20261016_*` (both), `20261020b_item_level_observations`.

### GAPS: new tables that rely on Supabase's implicit default grants

These all work in production today (tables exist). On a fresh project, preview branch or `db reset`
after 2026-10-30 they fail with `permission denied` even though RLS policies exist.

| Migration | Table(s) | Who touches it | Missing grant |
| --- | --- | --- | --- |
| `20261004000000_community_v2` | `comment_reactions`, `comment_emojis`, `user_blocks` | signed-in users (policy `for all`) | `select, insert, update, delete` to `authenticated` |
| | `comment_mentions` | signed-in users read own | `select` to `authenticated` |
| | `comment_reports` | signed-in insert + read own/admin | `select, insert` to `authenticated` |
| | `follows` | public read, self follow/unfollow | `select` to `anon, authenticated`; `insert, delete` to `authenticated` |
| | `notifications` | own read/delete/mark read | `select, delete` to `authenticated`; `update (read_at)` to `authenticated` (also needed for the realtime bell) |
| | `banned_words` | admin manage (policy `for all`) | `select, insert, update, delete` to `authenticated` |
| `20261005_effect_tag_styles` | `effect_tag_styles` | public read, admin write | `select` to `anon, authenticated`; `insert, update, delete` to `authenticated` |
| `20261010_match_results` | `match_results` | own select/insert/delete (no UPDATE by design) | `select, insert, delete` to `authenticated` |
| `20261012_user_builds` | `user_builds`, `user_build_items`, `user_build_runes`, `user_build_enchantments` | public read of visible builds, owner write | `select` to `anon, authenticated`; `insert, update, delete` to `authenticated` |
| `20261013_hero_video_cache` | `hero_video_cache` | Edge Function `hero-videos` with the service-role key (select + upsert) | `select, insert, update` to `service_role` |

`hero_video_cache` is the worst failure mode: the function swallows the error and answers `unavailable`.

The applied migration files must not be edited. The fix is ONE new migration (unique
`YYYYMMDDHHMMSS_` prefix) that only adds grants. It is idempotent and changes nothing in production
(the privileges already exist there). **Not written or applied yet; it needs the repo owner's go-ahead.**
Proposed SQL (least privilege, derived from the RLS policies above):

```sql
-- community_v2
grant select, insert, update, delete on public.comment_reactions, public.comment_emojis, public.user_blocks to authenticated;
grant select on public.comment_mentions to authenticated;
grant select, insert on public.comment_reports to authenticated;
grant select on public.follows to anon, authenticated;
grant insert, delete on public.follows to authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select, insert, update, delete on public.banned_words to authenticated;
-- effect_tag_styles
grant select on public.effect_tag_styles to anon, authenticated;
grant insert, update, delete on public.effect_tag_styles to authenticated;
-- match_results
grant select, insert, delete on public.match_results to authenticated;
-- user builds
grant select on public.user_builds, public.user_build_items, public.user_build_runes, public.user_build_enchantments to anon, authenticated;
grant insert, update, delete on public.user_builds, public.user_build_items, public.user_build_runes, public.user_build_enchantments to authenticated;
-- hero-videos Edge Function
grant select, insert, update on public.hero_video_cache to service_role;
```

Before applying, check what production really has (read-only):
`select grantee, table_name, privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name in (...);`

### Not applicable

Tables from the original "RoV Draft & Tier List System" schema (`heroes`, `items`, `hero_stats`, `saved_drafts`,
`favorites`, `guides`, `item_builds`, ...) are not created by any file in `migrations/`. They already exist in
production and keep their grants. `schema.sql` is an old baseline and is not a replayable schema (see `README.md`).

## Checklist before opening a PR with a migration

- [ ] Every new `public` table has `enable row level security`.
- [ ] Every new table has explicit `revoke` + `grant` for exactly the roles that use it (including `service_role` if an Edge Function touches it directly).
- [ ] Each granted role/verb has a matching RLS policy, or the table is intentionally RPC-only.
- [ ] Functions: explicit `revoke ... from public, anon` and `grant execute` to the roles that need it.
- [ ] Filename uses a unique `YYYYMMDDHHMMSS_name.sql` prefix (see `README.md`).
- [ ] Header says APPLIED / NOT APPLIED; nothing is applied to production without the owner's approval.
- [ ] Tested on a dev branch or scratch project **as `anon` and `authenticated`** (the SQL editor runs as `postgres` and hides missing grants).

## Pending work this affects

Any table created after 2026-10-30 (e.g. Admin Game Database Manager tables, new analytics/activity tables)
must follow the rule from its first migration.

Source: Supabase email "Data API access for new tables in public" (received ~2026-10-20).
