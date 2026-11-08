-- JustUNILAG Media member database
-- Run this in the Supabase SQL Editor before connecting the WhatsApp webhook.

create table if not exists public.members (
  id bigint generated always as identity primary key,
  created_number bigint generated always as identity unique,
  registration_id text unique not null,
  phone text unique not null,
  name text not null default '',
  registered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  consented_at timestamptz not null default now(),
  source text not null default 'WhatsApp'
);

create table if not exists public.webhook_events (
  event_id text primary key,
  received_at timestamptz not null default now()
);

alter table public.members enable row level security;
alter table public.webhook_events enable row level security;
revoke all on public.members from anon, authenticated;
revoke all on public.webhook_events from anon, authenticated;
grant all on public.members to service_role;
grant all on public.webhook_events to service_role;

create or replace function public.register_whatsapp_member(
  p_event_id text,
  p_phone text,
  p_name text default ''
)
returns table (
  duplicate boolean,
  is_new boolean,
  registration_id text,
  name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_event text;
  member_row public.members%rowtype;
  next_number bigint;
begin
  insert into public.webhook_events(event_id)
  values (p_event_id)
  on conflict do nothing
  returning event_id into inserted_event;

  if inserted_event is null then
    return query select true, false, null::text, null::text;
    return;
  end if;

  if p_phone is null or p_phone !~ '^[0-9]{8,15}$' then
    raise exception 'Invalid phone number';
  end if;

  -- Serialise new ID allocation so two first-time registrations cannot receive the same number.
  perform pg_advisory_xact_lock(74102911);

  select * into member_row from public.members m where m.phone = p_phone for update;

  if found then
    update public.members m
      set last_seen_at = now(),
          name = case when m.name = '' and coalesce(p_name, '') <> '' then left(p_name, 100) else m.name end
      where m.phone = p_phone
      returning * into member_row;
    return query select false, false, member_row.registration_id, member_row.name;
    return;
  end if;

  select coalesce(max(created_number), 0) + 1 into next_number from public.members;
  insert into public.members(registration_id, phone, name)
  values ('NIGERIA ' || lpad(next_number::text, 3, '0'), p_phone, left(coalesce(p_name, ''), 100))
  returning * into member_row;

  return query select false, true, member_row.registration_id, member_row.name;
end;
$$;

revoke all on function public.register_whatsapp_member(text, text, text) from public, anon, authenticated;
grant execute on function public.register_whatsapp_member(text, text, text) to service_role;
