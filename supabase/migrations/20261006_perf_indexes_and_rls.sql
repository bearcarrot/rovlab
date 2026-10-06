-- APPLIED to project mttcdaiwuasnkqlxbeqs on 2026-10-06 as migration `perf_indexes_and_rls`.
-- Read performance for 100-1000 users. Access semantics are unchanged (dry-run verified, then applied).
--   1) covering indexes for every unindexed foreign key reported by the advisor
--   2) RLS: evaluate auth.uid()/is_admin() once per statement instead of once per row
--   3) RLS: split "admin write X" (FOR ALL) into insert/update/delete so SELECT only runs the public-read policy

create index if not exists idx_comment_emojis_user_id          on public.comment_emojis (user_id);
create index if not exists idx_comment_mentions_mentioned_user on public.comment_mentions (mentioned_user_id);
create index if not exists idx_comment_reactions_user_id       on public.comment_reactions (user_id);
create index if not exists idx_comment_reports_reporter_id     on public.comment_reports (reporter_id);
create index if not exists idx_comments_guide_id               on public.comments (guide_id);
create index if not exists idx_comments_reply_to_user_id       on public.comments (reply_to_user_id);
create index if not exists idx_favorites_hero_slug             on public.favorites (hero_slug);
create index if not exists idx_guides_category_id              on public.guides (category_id);
create index if not exists idx_hero_balance_changes_patch_id   on public.hero_balance_changes (patch_id);
create index if not exists idx_hero_counters_counter_hero_id   on public.hero_counters (counter_hero_id);
create index if not exists idx_hero_synergies_partner_hero_id  on public.hero_synergies (partner_hero_id);
create index if not exists idx_item_build_arcana_arcana_id     on public.item_build_arcana (arcana_id);
create index if not exists idx_item_build_items_build_id       on public.item_build_items (build_id);
create index if not exists idx_item_build_items_item_id        on public.item_build_items (item_id);
create index if not exists idx_item_builds_arcana_id           on public.item_builds (arcana_id);
create index if not exists idx_item_builds_hero_id             on public.item_builds (hero_id);
create index if not exists idx_item_builds_patch_id            on public.item_builds (patch_id);
create index if not exists idx_items_patch_id                  on public.items (patch_id);
create index if not exists idx_matchups_hero_b_id              on public.matchups (hero_b_id);
create index if not exists idx_notifications_actor_id          on public.notifications (actor_id);
create index if not exists idx_notifications_comment_id        on public.notifications (comment_id);
create index if not exists idx_saved_builds_hero_slug          on public.saved_builds (hero_slug);
create index if not exists idx_saved_builds_user_id            on public.saved_builds (user_id);
create index if not exists idx_saved_drafts_user_id            on public.saved_drafts (user_id);
create index if not exists idx_tier_list_entries_hero_id       on public.tier_list_entries (hero_id);
create index if not exists idx_user_blocks_blocked_id          on public.user_blocks (blocked_id);

alter policy "own emojis"            on public.comment_emojis    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "read own mentions"     on public.comment_mentions  using (mentioned_user_id = (select auth.uid()));
alter policy "own reactions"         on public.comment_reactions using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "insert own report"     on public.comment_reports   with check ((select auth.uid()) = reporter_id);
alter policy "read own or admin reports" on public.comment_reports using (((select auth.uid()) = reporter_id) or (select public.is_admin()));
alter policy "insert own comments"   on public.comments with check (((select auth.uid()) = user_id) and (select private.is_email_verified()));
alter policy "read visible comments" on public.comments using ((hidden = false) or (user_id = (select auth.uid())) or (select public.is_admin()));
alter policy "update own comments"   on public.comments using ((select auth.uid()) = user_id);
-- two DELETE policies (own / admin) merged into one
alter policy "delete own comments"   on public.comments using (((select auth.uid()) = user_id) or (select public.is_admin()));
drop policy if exists "admin delete comments" on public.comments;
alter policy "own favorites"         on public.favorites    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "follow as self"        on public.follows      with check ((select auth.uid()) = follower_id);
alter policy "unfollow as self"      on public.follows      using ((select auth.uid()) = follower_id);
alter policy "read own notifications"   on public.notifications using ((select auth.uid()) = user_id);
alter policy "update own notifications" on public.notifications using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "delete own notifications" on public.notifications using ((select auth.uid()) = user_id);
alter policy "own profile select"    on public.profiles     using ((select auth.uid()) = id);
alter policy "own profile update"    on public.profiles     using ((select auth.uid()) = id);
alter policy "own saved_builds"      on public.saved_builds using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "own saved_drafts"      on public.saved_drafts using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "own blocks"            on public.user_blocks  using ((select auth.uid()) = blocker_id) with check ((select auth.uid()) = blocker_id);
alter policy "admin manage banned_words" on public.banned_words using ((select public.is_admin())) with check ((select public.is_admin()));

do $$
declare r record; t text;
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname = 'public' and cmd = 'ALL' and policyname like 'admin write %'
      and roles = '{authenticated}' and qual = 'is_admin()' and with_check = 'is_admin()'
  loop
    t := r.tablename;
    execute format('drop policy %I on public.%I', r.policyname, t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.is_admin()))', 'admin insert ' || t, t);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', 'admin update ' || t, t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select public.is_admin()))', 'admin delete ' || t, t);
  end loop;
end $$;
