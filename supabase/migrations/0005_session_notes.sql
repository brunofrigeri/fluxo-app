-- Fluxo 0005: session notes. Run after 0001-0004, in the Supabase SQL editor.
-- A free-text note for a class slot (date + time), independent of any one client's booking.

create table session_notes (
  date date not null,
  start_time time not null,
  note text not null,
  updated_at timestamptz not null default now(),
  primary key (date, start_time)
);

alter table session_notes enable row level security;
create policy "admin full access" on session_notes for all to authenticated using (true) with check (true);
