-- Fluxo 0006: multiple users. Run after 0001-0005, in the Supabase SQL editor.
--
-- Adds a profile (name, role, working hours) per auth user, and scopes clients
-- (and everything hanging off a client) to the instructor who owns them.
-- Admins see and manage everyone; instructors see only their own clients.
-- wait_list and session_notes stay studio-wide: nobody owns a prospect, and a
-- slot note isn't tied to one client's instructor.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null check (role in ('admin', 'instructor')) default 'instructor',
  working_hours text,
  created_at timestamptz not null default now()
);

-- Backfill: whoever already has an account (today's single admin) becomes an admin.
insert into profiles (id, email, name, role)
select id, email, coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1)), 'admin'
from auth.users
on conflict (id) do nothing;

-- security definer so policies that call this don't recurse back into profiles' own RLS.
create or replace function public.app_role() returns text
language sql security definer stable set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

alter table profiles enable row level security;
create policy "read own profile" on profiles for select to authenticated using (id = auth.uid());
create policy "admin reads all profiles" on profiles for select to authenticated using (app_role() = 'admin');
create policy "admin manages profiles" on profiles for update to authenticated using (app_role() = 'admin') with check (app_role() = 'admin');
create policy "admin deletes profiles" on profiles for delete to authenticated using (app_role() = 'admin');
-- No insert policy: profile rows are only created by the invite Server Action, which uses
-- the service-role key (bypasses RLS) so the new user doesn't need a policy to insert their own row.

alter table clients add column instructor_id uuid references profiles(id) on delete set null;

drop policy "admin full access" on clients;
create policy "scoped access" on clients for all to authenticated
  using (app_role() = 'admin' or instructor_id = auth.uid())
  with check (app_role() = 'admin' or instructor_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['evaluations', 'recurring_slots', 'bookings', 'evolutions', 'documents'] loop
    execute format('drop policy "admin full access" on %I', t);
    execute format(
      'create policy "scoped access" on %1$I for all to authenticated '
      'using (app_role() = ''admin'' or exists (select 1 from clients c where c.id = %1$I.client_id and c.instructor_id = auth.uid())) '
      'with check (app_role() = ''admin'' or exists (select 1 from clients c where c.id = %1$I.client_id and c.instructor_id = auth.uid()))',
      t);
  end loop;
end $$;

-- Storage: scope document files by the client_id encoded as the first path segment
-- ("<clientId>/<uuid>.<ext>", see uploadDocument), independent of the documents table.
drop policy "admin full access client-documents" on storage.objects;
create policy "scoped access client-documents" on storage.objects for all to authenticated
  using (
    bucket_id = 'client-documents'
    and exists (
      select 1 from clients c
      where c.id::text = (storage.foldername(name))[1]
        and (app_role() = 'admin' or c.instructor_id = auth.uid())
    )
  )
  with check (
    bucket_id = 'client-documents'
    and exists (
      select 1 from clients c
      where c.id::text = (storage.foldername(name))[1]
        and (app_role() = 'admin' or c.instructor_id = auth.uid())
    )
  );
