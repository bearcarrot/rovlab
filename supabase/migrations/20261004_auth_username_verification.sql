-- SUPERSEDED - do NOT run. This file was never applied to any Supabase project.
--
-- It created a separate `profiles.username` column, which conflicts with the project decision that
-- `profiles.handle` is the single username. Its useful parts (username validation at sign-up, reserved names,
-- username_available(), Google avatar, verified-email-to-comment) now live in
--   supabase/migrations/20261006_auth_security_hardening.sql
-- and are keyed on `profiles.handle`.
select 1;
