-- =====================================================================
-- OPTIONAL: remove the database objects from the OLD Living Culture site
-- (lc_* tables, old admin trigger). Run ONLY if you no longer need them.
-- WARNING: this permanently deletes any old prayer requests / notices /
-- events stored by the previous version. Export them first if needed.
-- =====================================================================
drop trigger  if exists lc_promote_verified_member on auth.users;
drop function if exists lc_private.lc_promote_verified_member() cascade;
drop table    if exists lc_private.approved_admin_emails cascade;
drop schema   if exists lc_private cascade;

drop function if exists public.lc_accept_inquiry cascade;
drop table    if exists public.lc_inquiry_rate_limits cascade;
drop table    if exists public.lc_inquiries cascade;
drop table    if exists public.lc_notices cascade;
drop table    if exists public.lc_events cascade;
drop table    if exists public.lc_admins cascade;
drop function if exists public.lc_is_admin() cascade;

-- Also delete the old "submit-inquiry" Edge Function in the dashboard:
-- Supabase → Edge Functions → submit-inquiry → Delete.
