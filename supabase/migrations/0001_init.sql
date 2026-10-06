-- Fluxo: initial schema.
-- Run in the Supabase SQL editor, or with `supabase db push`.
-- Single admin: every table is readable and writable by any authenticated user only.
-- Turn OFF "Allow new users to sign up" in Supabase Auth, and create the admin user by hand.

create extension if not exists pgcrypto;

create type attendance_status as enum
  ('PRESENCE_CONFIRMED', 'JUSTIFIED_MISS', 'UNJUSTIFIED_MISS', 'REPLACEMENT');

-- ---------------------------------------------------------------- tables

create table clients (
  id uuid primary key default gen_random_uuid(),
  document text not null unique,
  name text not null,
  email text,
  phone text,
  emergency_contact_name text,
  emergency_contact_phone text,
  date_of_birth date,
  diseases text[] not null default '{}',
  surgeries text[] not null default '{}',
  active boolean not null default true,          -- archive instead of delete
  created_at timestamptz not null default now()
);

create table evaluations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  date date not null default current_date,
  main_complaint text,
  diagnosis text,
  hdp text,                                      -- história da doença pregressa
  hda text,                                      -- história da doença atual
  medications text,
  movement_restrictions text,
  obs text,
  created_at timestamptz not null default now()
);

-- A client's fixed weekly slot, for example "Bruno: Monday 07:00".
create table recurring_slots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),   -- 0 = Sunday
  start_time time not null,
  active_from date not null default current_date,
  active_until date
);

-- One client in one session on one day. There is no limit of clients per slot.
create table bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  date date not null,
  start_time time not null,
  status attendance_status,                      -- null = not marked yet
  recurring_slot_id uuid references recurring_slots(id) on delete set null,
  replaces_booking_id uuid references bookings(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (client_id, date, start_time),
  -- A booking that points to a missed session must be a REPLACEMENT (null status does not pass).
  check (replaces_booking_id is null or coalesce(status = 'REPLACEMENT', false))
);

create table evolutions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  booking_id uuid unique references bookings(id) on delete set null,
  date date not null,
  apparatus jsonb not null default '{}',         -- reformer / barrel / cadillac / chair / balance tree
  created_at timestamptz not null default now()
);

create index bookings_date_time_idx on bookings (date, start_time);
create index bookings_client_date_idx on bookings (client_id, date);
create unique index bookings_one_replacement_per_miss
  on bookings (replaces_booking_id) where replaces_booking_id is not null;
create index evolutions_client_date_idx on evolutions (client_id, date desc);
create index evaluations_client_date_idx on evaluations (client_id, date desc);
create index recurring_slots_client_idx on recurring_slots (client_id);

-- ---------------------------------------------------------------- business rules

-- An evolution can only be linked to a booking where the client was present or made a replacement.
create function enforce_evolution_booking() returns trigger
language plpgsql as $$
declare
  b_status attendance_status;
  b_client uuid;
begin
  if new.booking_id is not null then
    select status, client_id into b_status, b_client from bookings where id = new.booking_id;
    if b_status is null or b_status not in ('PRESENCE_CONFIRMED', 'REPLACEMENT') then
      raise exception 'Só é possível registrar evolução para quem esteve presente ou fez reposição.'
        using errcode = '23514';
    end if;
    if b_client <> new.client_id then
      raise exception 'A sessão vinculada pertence a outro cliente.' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

create trigger evolutions_booking_rule
  before insert or update of booking_id, client_id on evolutions
  for each row execute function enforce_evolution_booking();

-- A booking that already has an evolution cannot become a miss or be unmarked.
create function protect_booking_with_evolution() returns trigger
language plpgsql as $$
begin
  if (new.status is null or new.status in ('JUSTIFIED_MISS', 'UNJUSTIFIED_MISS'))
     and new.status is distinct from old.status
     and exists (select 1 from evolutions where booking_id = new.id) then
    raise exception 'Esta sessão já tem evolução. Exclua a evolução antes de alterar o status.'
      using errcode = '23514';
  end if;
  return new;
end $$;

create trigger bookings_protect_evolution
  before update of status on bookings
  for each row execute function protect_booking_with_evolution();

-- A replacement must point to a justified miss of the same client.
create function enforce_replacement_link() returns trigger
language plpgsql as $$
declare
  m_status attendance_status;
  m_client uuid;
begin
  if new.replaces_booking_id is not null then
    select status, client_id into m_status, m_client from bookings where id = new.replaces_booking_id;
    if m_client is distinct from new.client_id or m_status is distinct from 'JUSTIFIED_MISS' then
      raise exception 'Uma reposição precisa apontar para uma falta justificada do mesmo cliente.'
        using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

create trigger bookings_replacement_rule
  before insert or update of replaces_booking_id, client_id on bookings
  for each row execute function enforce_replacement_link();

-- ---------------------------------------------------------------- recurring slots -> bookings

-- Fills bookings for the next N weeks from the active recurring slots. Safe to run repeatedly.
create function generate_bookings(weeks integer default 8) returns integer
language plpgsql as $$
declare
  inserted integer;
begin
  with days as (
    select d::date as day
    from generate_series(current_date, current_date + (weeks * 7), interval '1 day') as d
  ), ins as (
    insert into bookings (client_id, date, start_time, recurring_slot_id)
    select rs.client_id, days.day, rs.start_time, rs.id
    from recurring_slots rs
    join clients c on c.id = rs.client_id and c.active
    join days on extract(dow from days.day) = rs.weekday
             and days.day >= rs.active_from
             and (rs.active_until is null or days.day <= rs.active_until)
    on conflict (client_id, date, start_time) do nothing
    returning 1
  )
  select count(*) into inserted from ins;
  return inserted;
end $$;

-- Optional, with the pg_cron extension enabled (Database > Extensions):
-- select cron.schedule('fluxo-generate-bookings', '0 9 * * *', $$select public.generate_bookings(8)$$);

-- ---------------------------------------------------------------- row level security

do $$
declare t text;
begin
  foreach t in array array['clients', 'evaluations', 'recurring_slots', 'bookings', 'evolutions'] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "admin full access" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
