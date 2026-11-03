-- Living Culture member portal: apply in Supabase SQL Editor.
-- NEVER store passwords in SQL or GitHub. Promote a verified user separately.
create table if not exists public.lc_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create or replace function public.lc_is_admin()
returns boolean language sql stable security invoker set search_path = ''
as $$
  select exists(
    select 1 from public.lc_admins
    where user_id = (select auth.uid())
  );
$$;
revoke all on function public.lc_is_admin() from public, anon;
grant execute on function public.lc_is_admin() to authenticated;
alter table public.lc_admins enable row level security;
revoke all on public.lc_admins from anon, authenticated;
grant select on public.lc_admins to authenticated;
drop policy if exists "lc_admin_can_view_own_role" on public.lc_admins;
create policy "lc_admin_can_view_own_role"
on public.lc_admins for select to authenticated
using (user_id = (select auth.uid()));

create table if not exists public.lc_events(
  id uuid primary key default gen_random_uuid(),
  title text not null check(length(title) between 3 and 140),
  details text not null default '',
  venue text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  constraint lc_event_time_check check(ends_at is null or ends_at >= starts_at)
);
alter table public.lc_events enable row level security;
revoke all on public.lc_events from anon, authenticated;
grant select on public.lc_events to anon, authenticated;
grant insert, update, delete on public.lc_events to authenticated;
drop policy if exists "lc_events_public_read" on public.lc_events;
drop policy if exists "lc_events_admin_select" on public.lc_events;
drop policy if exists "lc_events_admin_insert" on public.lc_events;
drop policy if exists "lc_events_admin_update" on public.lc_events;
drop policy if exists "lc_events_admin_delete" on public.lc_events;
create policy "lc_events_public_read" on public.lc_events
for select to anon, authenticated using (is_published = true);
create policy "lc_events_admin_select" on public.lc_events
for select to authenticated using ((select public.lc_is_admin()));
create policy "lc_events_admin_insert" on public.lc_events
for insert to authenticated with check ((select public.lc_is_admin()));
create policy "lc_events_admin_update" on public.lc_events
for update to authenticated using ((select public.lc_is_admin()))
with check ((select public.lc_is_admin()));
create policy "lc_events_admin_delete" on public.lc_events
for delete to authenticated using ((select public.lc_is_admin()));

create table if not exists public.lc_notices (
  id uuid primary key default gen_random_uuid(),
  title text not null check(length(title) between 3 and 140),
  body text not null check(length(body) between 1 and 6000),
  is_published boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.lc_notices enable row level security;
revoke all on public.lc_notices from anon, authenticated;
grant select on public.lc_notices to anon, authenticated;
grant insert, update, delete on public.lc_notices to authenticated;
drop policy if exists "lc_notices_public_read" on public.lc_notices;
drop policy if exists "lc_notices_admin_select" on public.lc_notices;
drop policy if exists "lc_notices_admin_insert" on public.lc_notices;
drop policy if exists "lc_notices_admin_update" on public.lc_notices;
drop policy if exists "lc_notices_admin_delete" on public.lc_notices;
create policy "lc_notices_public_read" on public.lc_notices
for select to anon, authenticated
using (is_published = true and (expires_at is null or expires_at > now()));
create policy "lc_notices_admin_select" on public.lc_notices
for select to authenticated using ((select public.lc_is_admin()));
create policy "lc_notices_admin_insert" on public.lc_notices
for insert to authenticated with check ((select public.lc_is_admin()));
create policy "lc_notices_admin_update" on public.lc_notices
for update to authenticated using ((select public.lc_is_admin()))
with check ((select public.lc_is_admin()));
create policy "lc_notices_admin_delete" on public.lc_notices
for delete to authenticated using ((select public.lc_is_admin()));

-- Prayer requests and faith questions are confidential.
-- ONLY a server-side Edge Function may insert using the secret service key.
-- Public visitors have no SELECT or INSERT privileges, even with the public API key.
create table if not exists public.lc_inquiries(
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('prayer','question')),
  full_name text not null check(length(full_name) between 1 and 100),
  email text not null check(length(email) between 3 and 254),
  message text not null check(length(message) between 10 and 5000),
  keep_private boolean not null default true,
  consent boolean not null default false check (consent = true),
  created_at timestamptz not null default now()
);
alter table public.lc_inquiries enable row level security;
revoke all on public.lc_inquiries from anon, authenticated;
grant select on public.lc_inquiries to authenticated;
drop policy if exists "lc_inquiries_admin_read" on public.lc_inquiries;
create policy "lc_inquiries_admin_read"
on public.lc_inquiries for select to authenticated
using ((select public.lc_is_admin()));

-- After you have SIGNED UP and VERIFIED your email in Supabase Auth:
-- Run the following query with your own email, replacing the placeholder.
-- The site must never auto-grant admin based on unverified text typed into a form.
--
-- insert into public.lc_admins(user_id)
-- select id from auth.users
-- where email = '<YOUR_VERIFIED_ADMIN_EMAIL>' and email_confirmed_at is not null
-- on conflict (user_id) do nothing;
