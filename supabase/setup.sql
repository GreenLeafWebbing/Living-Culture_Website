-- =====================================================================
-- Living Culture – database setup
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run.
-- =====================================================================

-- ---------- Admins -----------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

-- true when the signed-in user is listed in public.admins
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- Notice board ----------------------------------------------
create table if not exists public.notices (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (length(title) between 1 and 120),
  body       text not null default '' check (length(body) <= 4000),
  pinned     boolean not null default false,
  expires_on date,                                   -- hidden after this date (optional)
  created_at timestamptz not null default now()
);
alter table public.notices enable row level security;
revoke all on public.notices from anon, authenticated;
grant select on public.notices to anon, authenticated;
grant insert, update, delete on public.notices to authenticated;

drop policy if exists notices_public_read on public.notices;
create policy notices_public_read on public.notices for select to anon, authenticated
  using (expires_on is null or expires_on >= current_date or public.is_admin());

drop policy if exists notices_admin_insert on public.notices;
create policy notices_admin_insert on public.notices for insert to authenticated
  with check (public.is_admin());
drop policy if exists notices_admin_update on public.notices;
create policy notices_admin_update on public.notices for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists notices_admin_delete on public.notices;
create policy notices_admin_delete on public.notices for delete to authenticated
  using (public.is_admin());

-- ---------- Calendar events -------------------------------------------
-- (The weekly Thursday 19:00 gathering is shown automatically by the site;
--  only add special events here.)
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(title) between 1 and 120),
  description text not null default '' check (length(description) <= 2000),
  location    text not null default '' check (length(location) <= 200),
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  created_at  timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
alter table public.events enable row level security;
revoke all on public.events from anon, authenticated;
grant select on public.events to anon, authenticated;
grant insert, update, delete on public.events to authenticated;

drop policy if exists events_public_read on public.events;
create policy events_public_read on public.events for select to anon, authenticated using (true);
drop policy if exists events_admin_insert on public.events;
create policy events_admin_insert on public.events for insert to authenticated
  with check (public.is_admin());
drop policy if exists events_admin_update on public.events;
create policy events_admin_update on public.events for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists events_admin_delete on public.events;
create policy events_admin_delete on public.events for delete to authenticated
  using (public.is_admin());

-- ---------- Prayer requests & questions --------------------------------
-- Anyone can SEND one. Only admins can READ them.
create table if not exists public.requests (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('prayer', 'question')),
  name       text check (length(name) <= 80),
  contact    text check (length(contact) <= 120),
  message    text not null check (length(message) between 3 and 4000),
  status     text not null default 'new' check (status in ('new', 'done')),
  created_at timestamptz not null default now()
);
alter table public.requests enable row level security;
revoke all on public.requests from anon, authenticated;
grant insert (kind, name, contact, message) on public.requests to anon, authenticated;
grant select, update, delete on public.requests to authenticated;

drop policy if exists requests_anyone_insert on public.requests;
create policy requests_anyone_insert on public.requests for insert to anon, authenticated
  with check (status = 'new');
drop policy if exists requests_admin_read on public.requests;
create policy requests_admin_read on public.requests for select to authenticated
  using (public.is_admin());
drop policy if exists requests_admin_update on public.requests;
create policy requests_admin_update on public.requests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists requests_admin_delete on public.requests;
create policy requests_admin_delete on public.requests for delete to authenticated
  using (public.is_admin());

-- Simple spam brake: max 20 new requests per 10 minutes across the whole site.
create or replace function public.requests_rate_limit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.requests
      where created_at > now() - interval '10 minutes') >= 20 then
    raise exception 'Too many requests right now – please try again in a few minutes.';
  end if;
  return new;
end;
$$;
drop trigger if exists requests_rate_limit on public.requests;
create trigger requests_rate_limit before insert on public.requests
  for each row execute function public.requests_rate_limit();

-- =====================================================================
-- MAKE YOURSELF ADMIN (after creating your user under Authentication → Users):
--
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'you@example.com'
--   on conflict do nothing;
-- =====================================================================
