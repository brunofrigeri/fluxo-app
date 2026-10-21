-- Fluxo 0013: Wellhub (Gympass) availability sharing, database side. Run after 0001-0012.
--
-- Wellhub's Booking API needs a capacity per class time, and Fluxo had none ("no limit of clients
-- per slot"). This adds:
--   - class_slots: the studio's weekly offering, one row per modality + weekday + time, with a
--     capacity and a "publish to Wellhub" switch. Nothing else changes: manual bookings are not
--     limited by it. Only bookings that arrive from Wellhub are checked against it.
--   - wellhub_connections: one per studio. Created by the admin's "Conectar ao Wellhub" button; the
--     webhook from Wellhub fills in the gym once the studio has asked Wellhub for the integration.
--   - wellhub_secrets: the per-gym webhook secret. No policy at all: only the server's service role
--     can read it.
--   - bookings.wellhub_booking_number: ties a booking to Wellhub's booking, so retried webhooks are
--     idempotent.
--   - wellhub_book / wellhub_cancel / wellhub_link_gym: service-role-only functions the webhook
--     handlers call, so the browser can never book into a studio on someone else's behalf.
--
-- No Wellhub token lives in the database. The API token Wellhub gives Fluxo (as a system) is an
-- environment variable on the server.

-- ---------------------------------------------------------------- weekly capacity

create table class_slots (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade default my_studio(),
  modality_id uuid not null references modalities(id),
  weekday smallint not null check (weekday between 0 and 6),          -- 0 = Sunday, like recurring_slots
  start_time time not null,
  duration_minutes int not null default 50 check (duration_minutes between 1 and 200),
  capacity int not null check (capacity between 1 and 1000),
  wellhub_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  unique (studio_id, modality_id, weekday, start_time),
  -- Wellhub does not list classes shorter than 30 minutes.
  constraint class_slots_wellhub_min_duration check (not wellhub_enabled or duration_minutes >= 30)
);

create index class_slots_studio_idx on class_slots (studio_id);

create trigger class_slots_modality_rule
  before insert or update of studio_id, modality_id on class_slots
  for each row execute function enforce_studio_modality();

alter table class_slots enable row level security;
create policy "read own studio" on class_slots for select to authenticated using (studio_id = my_studio());
create policy "admin writes" on class_slots for all to authenticated
  using (studio_id = my_studio() and app_role() = 'admin')
  with check (studio_id = my_studio() and app_role() = 'admin');

-- ---------------------------------------------------------------- connection

create table wellhub_connections (
  studio_id uuid primary key references studios(id) on delete cascade default my_studio(),
  -- Shown to the admin, who gives it to Wellhub when requesting the integration. It is the proof
  -- that the gym asking for Fluxo on Wellhub's side is the studio that clicked the button here.
  connection_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 12)),
  status text not null default 'awaiting' check (status in ('awaiting', 'connected', 'disabled')),
  gym_id bigint unique,
  gym_name text,
  partner_id uuid,
  -- Booking rules, in the same terms the studio sees in Wellhub: how many days ahead a class opens
  -- for booking, and how many hours before it bookings close and cancellations stop being free.
  opens_days_before int not null default 7 check (opens_days_before between 0 and 60),
  closes_hours_before int not null default 2 check (closes_hours_before between 0 and 720),
  cancel_hours_before int not null default 3 check (cancel_hours_before between 0 and 24),
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  check (status = 'awaiting' or gym_id is not null)
);

-- The browser may read the row and change the booking rules, and switch a connected gym off and
-- on. It can never set the gym, the partner or the code: those come from Wellhub's webhook.
create function guard_wellhub_connection() returns trigger
language plpgsql as $$
begin
  if auth.uid() is null then
    return new;                                  -- the server (service role)
  end if;
  if new.studio_id is distinct from old.studio_id
     or new.connection_code is distinct from old.connection_code
     or new.gym_id is distinct from old.gym_id
     or new.gym_name is distinct from old.gym_name
     or new.partner_id is distinct from old.partner_id
     or new.connected_at is distinct from old.connected_at then
    raise exception 'Estes campos só mudam pelo Wellhub.' using errcode = '42501';
  end if;
  if new.status is distinct from old.status and not (old.gym_id is not null and new.status in ('connected', 'disabled')) then
    raise exception 'A conexão só muda de estado depois que o Wellhub confirma o estúdio.' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger wellhub_connections_guard before update on wellhub_connections
  for each row execute function guard_wellhub_connection();

alter table wellhub_connections enable row level security;
create policy "admin reads" on wellhub_connections for select to authenticated
  using (studio_id = my_studio() and app_role() = 'admin');
create policy "admin starts" on wellhub_connections for insert to authenticated
  with check (studio_id = my_studio() and app_role() = 'admin' and status = 'awaiting' and gym_id is null);
create policy "admin edits" on wellhub_connections for update to authenticated
  using (studio_id = my_studio() and app_role() = 'admin')
  with check (studio_id = my_studio() and app_role() = 'admin');

-- Per-gym secret that Wellhub signs its webhooks with. RLS on, no policy: nobody but the service
-- role can read or write it. (It is a secret we invent and hand to Wellhub, not Wellhub's token.)
create table wellhub_secrets (
  studio_id uuid primary key references studios(id) on delete cascade,
  webhook_secret text not null check (length(webhook_secret) between 16 and 100)   -- Wellhub's limit is 100
);
alter table wellhub_secrets enable row level security;

-- ---------------------------------------------------------------- bookings from Wellhub

alter table bookings add column wellhub_booking_number text;
create unique index bookings_wellhub_booking_number_idx on bookings (wellhub_booking_number)
  where wellhub_booking_number is not null;

-- How many places of a session are taken. A justified miss frees its place; any other booking,
-- marked or not, holds one.
create function session_occupancy(p_studio uuid, p_modality uuid, p_date date, p_start time) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer
  from bookings b
  join clients c on c.id = b.client_id
  where c.studio_id = p_studio
    and b.modality_id = p_modality
    and b.date = p_date
    and b.start_time = p_start
    and b.status is distinct from 'JUSTIFIED_MISS'
$$;

-- Books a Wellhub user (already a client) into a published class time. Returns 'RESERVED', or the
-- reason_category Wellhub expects when rejecting. Idempotent on the booking number, because Wellhub
-- retries webhooks. The capacity check runs under a row lock on the class slot, so two bookings
-- arriving together cannot both take the last place.
create function wellhub_book(p_studio uuid, p_client uuid, p_modality uuid, p_date date, p_start time, p_booking_number text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  slot class_slots%rowtype;
begin
  if auth.uid() is not null then
    raise exception 'Somente o servidor pode chamar esta função.' using errcode = '42501';
  end if;

  if exists (select 1 from bookings where wellhub_booking_number = p_booking_number) then
    return 'RESERVED';
  end if;

  if not exists (select 1 from wellhub_connections where studio_id = p_studio and status = 'connected') then
    return 'GENERAL_ERROR';
  end if;

  select * into slot from class_slots
   where studio_id = p_studio and modality_id = p_modality
     and weekday = extract(dow from p_date) and start_time = p_start and wellhub_enabled
   for update;
  if not found then
    return 'CLASS_NOT_FOUND';
  end if;

  if not exists (select 1 from clients where id = p_client and studio_id = p_studio and active) then
    return 'USER_DOES_NOT_EXIST';
  end if;

  if exists (select 1 from bookings where client_id = p_client and date = p_date and start_time = p_start) then
    return 'USER_IS_ALREADY_BOOKED';
  end if;

  if session_occupancy(p_studio, p_modality, p_date, p_start) >= slot.capacity then
    return 'CLASS_IS_FULL';
  end if;

  begin
    insert into bookings (client_id, modality_id, date, start_time, wellhub_booking_number)
    values (p_client, p_modality, p_date, p_start, p_booking_number);
  exception
    when unique_violation then
      return 'USER_IS_ALREADY_BOOKED';
    when check_violation or raise_exception then
      return 'USER_PROFILE_CMS';                  -- for example, the client is not enrolled in this modality
  end;
  return 'RESERVED';
end $$;

-- A Wellhub user cancels. Free cancellation removes the booking. A late cancellation keeps it as a
-- justified miss, so the history shows it and the place is free again. A session that already has
-- an evolution or an attendance mark is left alone. Returns whether anything changed.
create function wellhub_cancel(p_studio uuid, p_booking_number text, p_late boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  b bookings%rowtype;
begin
  if auth.uid() is not null then
    raise exception 'Somente o servidor pode chamar esta função.' using errcode = '42501';
  end if;

  select bk.* into b
    from bookings bk join clients c on c.id = bk.client_id
   where bk.wellhub_booking_number = p_booking_number and c.studio_id = p_studio
   for update of bk;
  if not found or b.status is not null then
    return false;
  end if;

  if p_late then
    update bookings set status = 'JUSTIFIED_MISS', miss_reason = 'Cancelamento tardio (Wellhub)' where id = b.id;
  else
    delete from bookings where id = b.id;
  end if;
  return true;
end $$;

-- Wellhub tells us a gym picked Fluxo as its system. The gym is linked to the studio whose
-- connection code it quotes, and only while that studio is still waiting. Returns the studio, or
-- null when the code matches nobody (the handler then ignores the request).
create function wellhub_link_gym(p_code text, p_gym_id bigint, p_gym_name text, p_partner_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  target uuid;
begin
  if auth.uid() is not null then
    raise exception 'Somente o servidor pode chamar esta função.' using errcode = '42501';
  end if;

  select studio_id into target from wellhub_connections
   where connection_code = upper(trim(p_code)) and (status = 'awaiting' or gym_id = p_gym_id)
   for update;
  if not found then
    return null;
  end if;

  update wellhub_connections
     set gym_id = p_gym_id, gym_name = p_gym_name, partner_id = p_partner_id,
         status = case when status = 'awaiting' then 'connected' else status end,
         connected_at = coalesce(connected_at, now())
   where studio_id = target;
  return target;
end $$;

-- These run with the table owner's rights, so the browser's roles must not reach them. In Supabase
-- the server uses the service role. (Each function also refuses to run when a user is signed in.)
revoke execute on function session_occupancy(uuid, uuid, date, time) from public, anon, authenticated;
revoke execute on function wellhub_book(uuid, uuid, uuid, date, time, text) from public, anon, authenticated;
revoke execute on function wellhub_cancel(uuid, text, boolean) from public, anon, authenticated;
revoke execute on function wellhub_link_gym(text, bigint, text, uuid) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function session_occupancy(uuid, uuid, date, time) to service_role;
    grant execute on function wellhub_book(uuid, uuid, uuid, date, time, text) to service_role;
    grant execute on function wellhub_cancel(uuid, text, boolean) to service_role;
    grant execute on function wellhub_link_gym(text, bigint, text, uuid) to service_role;
  end if;
end $$;
