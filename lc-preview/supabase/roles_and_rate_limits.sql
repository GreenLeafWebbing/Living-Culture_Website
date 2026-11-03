-- Living Culture extension: verified admin allowlist and server-only inquiry rate limits.
-- Applied to the live free Supabase project. Do not place private addresses in this file.
-- Add approved admin addresses via the Supabase SQL Editor (after verifying control).

create schema if not exists lc_private;
revoke all on schema lc_private from public, anon, authenticated;
create table if not exists lc_private.approved_admin_emails(
  email text primary key
);
revoke all on lc_private.approved_admin_emails from public, anon, authenticated;

create or replace function lc_private.lc_promote_verified_member()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if new.email_confirmed_at is not null
    and exists (select 1 from lc_private.approved_admin_emails
                where email = lower(new.email))
  then
    insert into public.lc_admins(user_id)
    values(new.id) on conflict (user_id) do nothing;
  end if;
  return new;
end
$function$;
revoke all on function lc_private.lc_promote_verified_member() from public, anon, authenticated;
drop trigger if exists lc_promote_verified_member on auth.users;
create trigger lc_promote_verified_member
after insert or update of email, email_confirmed_at on auth.users
for each row execute function lc_private.lc_promote_verified_member();

-- Guest visitors cannot write to these tables; only the trusted Edge Function
-- can use the restricted RPC with the server-only Supabase service-role key.
create table if not exists public.lc_inquiry_rate_limits(
 rate_key text primary key,
 started_at timestamptz not null default now(),
 request_count integer not null default 0
);
alter table public.lc_inquiry_rate_limits enable row level security;
revoke all on public.lc_inquiry_rate_limits from public, anon, authenticated;

create or replace function public.lc_accept_inquiry(
  in_rate_key text,in_kind text,in_full_name text,in_email text,
  in_message text,in_keep_private boolean,in_consent boolean
)
returns uuid language plpgsql security invoker set search_path = ''
as $function$
declare
  rate_count integer;
  saved_id uuid;
begin
  insert into public.lc_inquiry_rate_limits(rate_key,started_at,request_count)
  values(in_rate_key,now(),1)
  on conflict(rate_key) do update
  set request_count = case
    when public.lc_inquiry_rate_limits.started_at < now() - interval '1 hour'
      then 1 else public.lc_inquiry_rate_limits.request_count + 1 end,
    started_at = case
    when public.lc_inquiry_rate_limits.started_at < now() - interval '1 hour'
      then now() else public.lc_inquiry_rate_limits.started_at end
  returning request_count into rate_count;
  if rate_count > 4 then
    raise exception 'RATE_LIMIT_EXCEEDED' using errcode='P0001';
  end if;
  insert into public.lc_inquiries(kind,full_name,email,message,keep_private,consent)
  values(in_kind,in_full_name,in_email,in_message,in_keep_private,in_consent)
  returning id into saved_id;
  return saved_id;
end
$function$;
revoke all on function public.lc_accept_inquiry(text,text,text,text,text,boolean,boolean)
  from public, anon, authenticated;
grant execute on function public.lc_accept_inquiry(text,text,text,text,text,boolean,boolean)
  to service_role;
