-- Fluxo 0003: wait list. Run after 0001 and 0002, in the Supabase SQL editor.
-- People waiting for a spot. They are not clients: no bookings, evaluations or evolutions.

create type wait_period as enum ('MORNING', 'AFTERNOON', 'NIGHT');

create table wait_list (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  phone text not null check (btrim(phone) <> ''),
  period wait_period not null,
  created_at timestamptz not null default now()
);

create index wait_list_period_created_idx on wait_list (period, created_at);

alter table wait_list enable row level security;
create policy "admin full access" on wait_list for all to authenticated using (true) with check (true);
