-- supabase/tests/announcements.sql -- integration checks for 20261016c_announcements.sql
-- STATUS: WRITTEN, NEVER RUN. Run it only on a Supabase DEV BRANCH / dev project AFTER applying the migration there. NEVER on production.
-- Usage: paste into the SQL editor or `psql "$DEV_DB_URL" -f supabase/tests/announcements.sql`.
-- Everything happens inside one transaction that ends with ROLLBACK, so nothing persists. Success = the final NOTICE and no ASSERT error.
--
-- ADAPT BEFORE RUNNING: the FIXTURES section inserts minimal rows into auth.users and public.admin_users. If your project requires more
-- NOT NULL columns there (or a profiles trigger needs extra data), adjust only that section.
-- Full media-vector parity (all of tests/announcements/media-vectors.json) is checked by scripts/verify-announcements-api.mjs;
-- this file checks a representative subset.

begin;

create schema zz_ann_test;
grant usage on schema zz_ann_test to anon, authenticated;

create function zz_ann_test.ok(cond boolean, msg text) returns void language plpgsql as $f$
begin
  if cond is not true then raise exception 'ASSERT FAILED: %', msg; end if;
end $f$;

-- expected = a P0001 detail code (e.g. FORBIDDEN) or the literal '42501' for "permission denied"
create function zz_ann_test.expect_error(sql_text text, expected text, msg text) returns void language plpgsql as $f$
declare d text; good boolean;
begin
  begin
    execute sql_text;
  exception when others then
    get stacked diagnostics d = pg_exception_detail;
    if expected = '42501' then good := (sqlstate = '42501'); else good := (d = expected); end if;
    if not good then raise exception 'ASSERT FAILED (%): wrong error: sqlstate=% detail=%', msg, sqlstate, d; end if;
    return;
  end;
  raise exception 'ASSERT FAILED (%): expected % but the statement succeeded', msg, expected;
end $f$;

create function zz_ann_test.as_anon() returns void language plpgsql as $f$
begin perform set_config('request.jwt.claims', '', true); set local role anon; end $f$;
create function zz_ann_test.as_user(uid uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $f$;
create function zz_ann_test.as_owner() returns void language plpgsql as $f$
begin reset role; perform set_config('request.jwt.claims', '', true); end $f$;
grant execute on all functions in schema zz_ann_test to anon, authenticated;

-- ---------- FIXTURES (adapt if needed) ----------
-- u_user  = 11111111-1111-4111-8111-111111111111   u_mod = 22222222-2222-4222-8222-222222222222   u_admin = 33333333-3333-4333-8333-333333333333
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'ann-user@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'ann-mod@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'ann-admin@example.test');
insert into public.admin_users (user_id, role) values
  ('22222222-2222-4222-8222-222222222222', 'moderator'),
  ('33333333-3333-4333-8333-333333333333', 'admin');

-- now() is fixed for the whole transaction, so boundary equality is testable exactly
insert into public.announcements (id, title, status, starts_at, ends_at) values
  ('a0000000-0000-4000-8000-000000000001', 'active',       'published', now() - interval '1 hour', now() + interval '30 minutes'),
  ('a0000000-0000-4000-8000-000000000002', 'starts-now',   'published', now(), null),
  ('a0000000-0000-4000-8000-000000000003', 'no-dates',     'published', null, null),
  ('a0000000-0000-4000-8000-000000000004', 'draft',        'draft',     null, null),
  ('a0000000-0000-4000-8000-000000000005', 'archived',     'archived',  null, null),
  ('a0000000-0000-4000-8000-000000000006', 'future-start', 'published', now() + interval '1 hour', null),
  ('a0000000-0000-4000-8000-000000000007', 'past-end',     'published', null, now() - interval '1 minute'),
  ('a0000000-0000-4000-8000-000000000008', 'ends-now',     'published', now() - interval '1 hour', now());

-- ---------- ANON ----------
select zz_ann_test.as_anon();
select zz_ann_test.ok((select array_agg(title order by title) from public.announcements) = array['active', 'no-dates', 'starts-now'],
  'anon sees only published rows inside the window (start inclusive, end exclusive)');
select zz_ann_test.expect_error($q$select created_by from public.announcements$q$, '42501', 'anon cannot read created_by');
select zz_ann_test.expect_error($q$select * from public.announcements$q$, '42501', 'select * is denied (explicit columns required)');
select zz_ann_test.expect_error($q$insert into public.announcements (title) values ('x')$q$, '42501', 'anon insert denied');
select zz_ann_test.expect_error($q$update public.announcements set title = 'x'$q$, '42501', 'anon update denied');
select zz_ann_test.expect_error($q$delete from public.announcements$q$, '42501', 'anon delete denied');
select zz_ann_test.expect_error($q$select public.admin_save_announcement(null,'t','c','none',null,null,null,'normal',true,null,null)$q$, '42501', 'anon cannot execute admin_save');
select zz_ann_test.expect_error($q$select public.admin_set_announcement_status('a0000000-0000-4000-8000-000000000001','archived')$q$, '42501', 'anon cannot execute admin_set_status');
select zz_ann_test.expect_error($q$select public.admin_delete_announcement('a0000000-0000-4000-8000-000000000001')$q$, '42501', 'anon cannot execute admin_delete');
select zz_ann_test.expect_error($q$select public.dismiss_announcements(array['a0000000-0000-4000-8000-000000000001']::uuid[])$q$, '42501', 'anon cannot dismiss on the server');
select zz_ann_test.expect_error($q$select * from public.announcement_dismissals$q$, '42501', 'anon cannot read dismissals');
select zz_ann_test.ok((select next_change from public.get_announcement_schedule()) = (select now() + interval '30 minutes'), 'schedule: next change = earliest future start/end');
select zz_ann_test.ok((select count(*) from public.get_announcement_schedule()) = 1, 'schedule returns one row');

-- ---------- ORDINARY USER ----------
select zz_ann_test.as_user('11111111-1111-4111-8111-111111111111');
select zz_ann_test.ok((select count(*) from public.announcements) = 3, 'ordinary user sees the same 3 public rows, no drafts');
select zz_ann_test.expect_error($q$select public.admin_save_announcement(null,'t','c','none',null,null,null,'normal',true,null,null)$q$, 'FORBIDDEN', 'user: admin_save FORBIDDEN');
select zz_ann_test.expect_error($q$select public.admin_set_announcement_status('a0000000-0000-4000-8000-000000000001','archived')$q$, 'FORBIDDEN', 'user: set_status FORBIDDEN');
select zz_ann_test.expect_error($q$select public.admin_delete_announcement('a0000000-0000-4000-8000-000000000001')$q$, 'FORBIDDEN', 'user: delete FORBIDDEN');
select zz_ann_test.expect_error($q$insert into public.announcements (title) values ('x')$q$, '42501', 'user direct insert denied');
select zz_ann_test.expect_error($q$update public.announcements set title = 'x'$q$, '42501', 'user direct update denied');
select zz_ann_test.expect_error($q$delete from public.announcements$q$, '42501', 'user direct delete denied');
select zz_ann_test.ok(public.dismiss_announcements(array['a0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000dead']::uuid[]) = 1, 'dismiss inserts known ids and silently ignores unknown ones');
select zz_ann_test.ok(public.dismiss_announcements(array['a0000000-0000-4000-8000-000000000001']::uuid[]) = 0, 'duplicate dismissal ignored');
select zz_ann_test.ok((select count(*) from public.announcement_dismissals) = 1, 'user reads own dismissal');
select zz_ann_test.expect_error($q$delete from public.announcement_dismissals$q$, '42501', 'no dismissal delete (no reset feature)');
select zz_ann_test.expect_error($q$insert into public.announcement_dismissals (user_id, announcement_id) values ('11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000002')$q$, '42501', 'no direct dismissal insert');
select zz_ann_test.expect_error($q$select public.dismiss_announcements(null)$q$, 'TOO_MANY_IDS', 'null ids rejected');
select zz_ann_test.expect_error($q$select public.dismiss_announcements(array(select gen_random_uuid() from generate_series(1, 201)))$q$, 'TOO_MANY_IDS', 'more than 200 ids rejected');
select zz_ann_test.ok(public.dismiss_announcements(array(select gen_random_uuid() from generate_series(1, 200))) = 0, 'exactly 200 ids accepted (all unknown)');

-- ---------- MODERATOR (is_admin() is false for moderators) ----------
select zz_ann_test.as_user('22222222-2222-4222-8222-222222222222');
select zz_ann_test.expect_error($q$select public.admin_save_announcement(null,'t','c','none',null,null,null,'normal',true,null,null)$q$, 'FORBIDDEN', 'moderator: admin_save FORBIDDEN');
select zz_ann_test.ok((select count(*) from public.announcements) = 3, 'moderator cannot see drafts');
select zz_ann_test.ok((select count(*) from public.announcement_dismissals) = 0, 'users never read other users dismissals');

-- ---------- ADMIN ----------
select zz_ann_test.as_user('33333333-3333-4333-8333-333333333333');
select zz_ann_test.ok((select count(*) from public.announcements) = 8, 'admin sees every row incl. drafts/archived');
create temp table t_ids (k text primary key, id uuid);
insert into t_ids select 'draft', public.admin_save_announcement(null, '  New  ', E' line1\nline2 ', 'none', null, 'https://example.com/x', 'ดูเพิ่มเติม', 'important', null, null, null);
select zz_ann_test.ok((select status = 'draft' and title = 'New' and content = E'line1\nline2' and is_dismissible and created_by = '33333333-3333-4333-8333-333333333333' from public.announcements where id = (select id from t_ids where k = 'draft')),
  'save: new rows are drafts, text trimmed, is_dismissible defaults true, created_by stamped');
select zz_ann_test.expect_error($q$select public.admin_save_announcement(null,'   ','c','none',null,null,null,'normal',true,null,null)$q$, 'INVALID_TITLE', 'empty title');
select zz_ann_test.expect_error($q$select public.admin_save_announcement(null,'t','c','none',null,null,null,'huge',true,null,null)$q$, 'INVALID_PRIORITY', 'bad priority');
select zz_ann_test.expect_error($q$select public.admin_save_announcement(null,'t','c','audio',null,null,null,'normal',true,null,null)$q$, 'INVALID_MEDIA_TYPE', 'bad media type');
select zz_ann_test.expect_error($q$select public.admin_save_announcement(null,'t','c','none',null,null,null,'normal',true, now(), now())$q$, 'INVALID_SCHEDULE', 'end must be after start');
select zz_ann_test.expect_error($q$select public.admin_save_announcement(null,'t','c','none','https://example.com/a.png',null,null,'normal',true,null,null)$q$, 'MEDIA_NOT_ALLOWED', 'none + media url rejected, not dropped');
select zz_ann_test.expect_error($q$select public.admin_save_announcement(null,'t','c','image','http://example.com/a.png',null,null,'normal',true,null,null)$q$, 'MEDIA_URL_INVALID', 'http rejected');
select zz_ann_test.expect_error($q$select public.admin_save_announcement(null,'t','c','video','https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ',null,null,'normal',true,null,null)$q$, 'VIDEO_UNSUPPORTED', 'lookalike host');
select zz_ann_test.expect_error($q$select public.admin_save_announcement(null,'t','c','link','https://example.com/p','https://example.com/q',null,'normal',true,null,null)$q$, 'LINK_URL_NOT_ALLOWED', 'link type has a single destination');
select zz_ann_test.expect_error($q$select public.admin_save_announcement(null,'t','c','none',null,null,'label',  'normal',true,null,null)$q$, 'LABEL_WITHOUT_LINK', 'label without link');
select zz_ann_test.ok(public.admin_save_announcement(null, 't', 'c', 'video', 'https://youtu.be/dQw4w9WgXcQ', null, null, 'normal', true, null, null) is not null, 'valid youtube video accepted');
select zz_ann_test.expect_error($q$select public.admin_save_announcement('00000000-0000-4000-8000-00000000dead','t','c','none',null,null,null,'normal',true,null,null)$q$, 'NOT_FOUND', 'update of a missing id');
select zz_ann_test.expect_error($q$update public.announcements set media_type = 'image', media_url = 'javascript:alert(1)'$q$, '42501', 'even admins cannot write the table directly');

-- status transitions
select public.admin_set_announcement_status((select id from t_ids where k = 'draft'), 'published');
select zz_ann_test.ok((select status from public.announcements where id = (select id from t_ids where k = 'draft')) = 'published', 'draft -> published');
select public.admin_set_announcement_status((select id from t_ids where k = 'draft'), 'published');  -- no-op, no error
select public.admin_save_announcement((select id from t_ids where k = 'draft'), 'Edited', 'c', 'none', null, null, null, 'urgent', true, null, null);
select zz_ann_test.ok((select status = 'published' and title = 'Edited' from public.announcements where id = (select id from t_ids where k = 'draft')), 'editing keeps status and id');
select public.admin_set_announcement_status((select id from t_ids where k = 'draft'), 'archived');
select zz_ann_test.expect_error(format($q$select public.admin_set_announcement_status(%L, 'published')$q$, (select id from t_ids where k = 'draft')), 'INVALID_TRANSITION', 'archived -> published is refused');
select public.admin_set_announcement_status((select id from t_ids where k = 'draft'), 'draft');
-- an expired window cannot be published; unknown status / id are predictable errors
insert into t_ids select 'expired', public.admin_save_announcement(null, 'Expired draft', 'c', 'none', null, null, null, 'normal', true, now() - interval '2 days', now() - interval '1 day');
select zz_ann_test.expect_error(format($q$select public.admin_set_announcement_status(%L, 'published')$q$, (select id from t_ids where k = 'expired')), 'ALREADY_EXPIRED', 'cannot publish an expired window');
select zz_ann_test.expect_error($q$select public.admin_set_announcement_status('a0000000-0000-4000-8000-000000000001', 'deleted')$q$, 'INVALID_STATUS', 'unknown status');
select zz_ann_test.expect_error($q$select public.admin_set_announcement_status('00000000-0000-4000-8000-00000000dead', 'draft')$q$, 'NOT_FOUND', 'status of a missing id');

-- delete returns the old media_url (for storage cleanup) and dismissals cascade
insert into t_ids select 'link', public.admin_save_announcement(null, 'L', 'c', 'link', 'https://example.com/p', null, null, 'normal', true, null, null);
select zz_ann_test.ok(public.admin_delete_announcement((select id from t_ids where k = 'link')) = 'https://example.com/p', 'delete returns the old media_url');
select zz_ann_test.expect_error(format($q$select public.admin_delete_announcement(%L)$q$, (select id from t_ids where k = 'link')), 'NOT_FOUND', 'second delete');
select public.admin_delete_announcement('a0000000-0000-4000-8000-000000000001');

-- ---------- CATALOG PRIVILEGES ----------
select zz_ann_test.as_owner();
select zz_ann_test.ok((select count(*) from public.announcement_dismissals where announcement_id = 'a0000000-0000-4000-8000-000000000001') = 0, 'deleting an announcement cascades to its dismissals');
select zz_ann_test.ok(not has_function_privilege('anon', 'public.admin_save_announcement(uuid, text, text, text, text, text, text, text, boolean, timestamptz, timestamptz)', 'EXECUTE'), 'anon: no EXECUTE on admin_save');
select zz_ann_test.ok(has_function_privilege('authenticated', 'public.admin_save_announcement(uuid, text, text, text, text, text, text, text, boolean, timestamptz, timestamptz)', 'EXECUTE'), 'authenticated: EXECUTE on admin_save (safety = in-body is_admin check)');
select zz_ann_test.ok(not has_function_privilege('anon', 'public.admin_set_announcement_status(uuid, text)', 'EXECUTE'), 'anon: no EXECUTE on set_status');
select zz_ann_test.ok(not has_function_privilege('anon', 'public.admin_delete_announcement(uuid)', 'EXECUTE'), 'anon: no EXECUTE on delete');
select zz_ann_test.ok(not has_function_privilege('anon', 'public.dismiss_announcements(uuid[])', 'EXECUTE'), 'anon: no EXECUTE on dismiss');
select zz_ann_test.ok(has_function_privilege('anon', 'public.get_announcement_schedule()', 'EXECUTE'), 'anon: EXECUTE on schedule');
select zz_ann_test.ok(not has_function_privilege('authenticated', 'public.announcement_media_error(text, text, text, text)', 'EXECUTE'), 'internal helper not executable by clients');
select zz_ann_test.ok(not has_function_privilege('anon', 'public.announcement_clean(text)', 'EXECUTE'), 'internal helper not executable by anon');
select zz_ann_test.ok(not has_table_privilege('anon', 'public.announcements', 'INSERT') and not has_table_privilege('anon', 'public.announcements', 'UPDATE') and not has_table_privilege('anon', 'public.announcements', 'DELETE'), 'anon: no write privileges');
select zz_ann_test.ok(not has_table_privilege('authenticated', 'public.announcements', 'INSERT') and not has_table_privilege('authenticated', 'public.announcements', 'UPDATE') and not has_table_privilege('authenticated', 'public.announcements', 'DELETE'), 'authenticated: no write privileges');
select zz_ann_test.ok(not has_column_privilege('anon', 'public.announcements', 'created_by', 'SELECT') and not has_column_privilege('authenticated', 'public.announcements', 'created_by', 'SELECT'), 'created_by unreadable by clients');
select zz_ann_test.ok(has_column_privilege('anon', 'public.announcements', 'title', 'SELECT'), 'public columns readable');
select zz_ann_test.ok(not has_table_privilege('authenticated', 'public.announcement_dismissals', 'INSERT') and not has_table_privilege('authenticated', 'public.announcement_dismissals', 'DELETE') and not has_table_privilege('authenticated', 'public.announcement_dismissals', 'UPDATE'), 'dismissals are not writable directly');

do $$ begin raise notice 'ALL ANNOUNCEMENT SQL CHECKS PASSED'; end $$;
rollback;
