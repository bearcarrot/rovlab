-- Match Analysis activity events for the Admin Dashboard (reuses public.user_activity_events and its admin RPCs).
-- APPLIED to project mttcdaiwuasnkqlxbeqs on 2026-10-10 as migration `match_analysis_activity_events`.
-- Only widens the event_type whitelist; RLS, RPCs and the 512-byte metadata cap are unchanged.
--   match_analysis_attempted  metadata {ok: boolean}  -- a scan request was sent to scoreboard-ocr (ok = it returned a result)
--   match_saved               metadata {edited: boolean} -- logged only after the match_results insert succeeded

alter table public.user_activity_events drop constraint if exists user_activity_events_event_type_check;
alter table public.user_activity_events add constraint user_activity_events_event_type_check check (event_type in (
  'ai_coach_used',
  'draft_created', 'draft_loaded', 'draft_shared',
  'tier_list_created', 'tier_list_shared',
  'hero_viewed', 'stats_viewed', 'matchup_viewed', 'counter_pick_used',
  'match_analysis_attempted', 'match_saved'
));
