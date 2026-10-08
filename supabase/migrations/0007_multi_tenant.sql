-- Fluxo 0007: multi-tenant studios. Run after 0001-0006, in the Supabase SQL editor.
--
-- Turns "one shared pool of instructors" into "each admin owns their own isolated studio."
-- A brand-new signup creates a brand-new, empty studio; everything that admin or their
-- invited instructors create is scoped to that studio and invisible to every other studio.
--
-- Also requires, in the Supabase Dashboard: Authentication > Providers > Email > turn ON
-- "Allow new users to sign up" (0001 told you to turn this off for the old single-admin
-- model; the new /signup page needs it back on).

create table studios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table profiles add column studio_id uuid references studios(id) on delete cascade;
alter table clients add column studio_id uuid references studios(id);
alter table wait_list add column studio_id uuid references studios(id);
alter table session_notes add column studio_id uuid references studios(id);

-- Backfill: everything that already exists today is one shared pool — keep it together as
-- a single studio, rather than splintering existing admin/instructor relationships apart.
do $$
declare default_studio uuid;
begin
  if exists (select 1 from profiles) then
    insert into studios (name) values ('Meu estúdio') returning id into default_studio;
    update profiles set studio_id = default_studio where studio_id is null;
    update clients set studio_id = default_studio where studio_id is null;
    update wait_list set studio_id = default_studio where studio_id is null;
    update session_notes set studio_id = default_studio where studio_id is null;
  end if;
end $$;

alter table profiles alter column studio_id set not null;
alter table clients alter column studio_id set not null;
alter table wait_list alter column studio_id set not null;
alter table session_notes alter column studio_id set not null;

-- The slot (date, start_time) is only unique per studio now — two studios can both have a
-- note on, say, Monday 07:00.
alter table session_notes drop constraint session_notes_pkey;
alter table session_notes add primary key (studio_id, date, start_time);

create or replace function public.my_studio() returns uuid
language sql security definer stable set search_path = public as $$
  select studio_id from profiles where id = auth.uid()
$$;

-- ---------------------------------------------------------------- studios

alter table studios enable row level security;
create policy "read own studio" on studios for select to authenticated using (id = my_studio());
-- Self-signup only: lets a freshly authenticated user (no profile yet, so no studio) create
-- the one studio they're about to become admin of. Once they have a profile, this is closed.
create policy "signup creates studio" on studios for insert to authenticated
  with check (not exists (select 1 from profiles where id = auth.uid()));

-- ---------------------------------------------------------------- profiles

drop policy "admin reads all profiles" on profiles;
drop policy "admin manages profiles" on profiles;
drop policy "admin deletes profiles" on profiles;

create policy "admin reads all profiles" on profiles for select to authenticated
  using (app_role() = 'admin' and studio_id = my_studio());
create policy "admin manages profiles" on profiles for update to authenticated
  using (app_role() = 'admin' and studio_id = my_studio())
  with check (app_role() = 'admin' and studio_id = my_studio());
create policy "admin deletes profiles" on profiles for delete to authenticated
  using (app_role() = 'admin' and studio_id = my_studio());
-- Self-signup only: a user with no profile anywhere can create exactly one profile for
-- themselves, as admin of a studio nobody has claimed yet (its own brand-new, memberless studio).
create policy "signup creates profile" on profiles for insert to authenticated
  with check (
    id = auth.uid() and role = 'admin'
    and not exists (select 1 from profiles p2 where p2.studio_id = profiles.studio_id)
  );

-- ---------------------------------------------------------------- clients + everything hanging off a client

drop policy "scoped access" on clients;
create policy "scoped access" on clients for all to authenticated
  using (studio_id = my_studio() and (app_role() = 'admin' or instructor_id = auth.uid()))
  with check (studio_id = my_studio() and (app_role() = 'admin' or instructor_id = auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['evaluations', 'recurring_slots', 'bookings', 'evolutions', 'documents'] loop
    execute format('drop policy "scoped access" on %I', t);
    execute format(
      'create policy "scoped access" on %1$I for all to authenticated '
      'using (exists (select 1 from clients c where c.id = %1$I.client_id and c.studio_id = my_studio() and (app_role() = ''admin'' or c.instructor_id = auth.uid()))) '
      'with check (exists (select 1 from clients c where c.id = %1$I.client_id and c.studio_id = my_studio() and (app_role() = ''admin'' or c.instructor_id = auth.uid())))',
      t);
  end loop;
end $$;

-- ---------------------------------------------------------------- shared-within-a-studio tables

drop policy "admin full access" on wait_list;
create policy "scoped access" on wait_list for all to authenticated
  using (studio_id = my_studio()) with check (studio_id = my_studio());

drop policy "admin full access" on session_notes;
create policy "scoped access" on session_notes for all to authenticated
  using (studio_id = my_studio()) with check (studio_id = my_studio());

-- ---------------------------------------------------------------- storage

drop policy "scoped access client-documents" on storage.objects;
create policy "scoped access client-documents" on storage.objects for all to authenticated
  using (
    bucket_id = 'client-documents'
    and exists (
      select 1 from clients c
      where c.id::text = (storage.foldername(name))[1]
        and c.studio_id = my_studio()
        and (app_role() = 'admin' or c.instructor_id = auth.uid())
    )
  )
  with check (
    bucket_id = 'client-documents'
    and exists (
      select 1 from clients c
      where c.id::text = (storage.foldername(name))[1]
        and c.studio_id = my_studio()
        and (app_role() = 'admin' or c.instructor_id = auth.uid())
    )
  );
