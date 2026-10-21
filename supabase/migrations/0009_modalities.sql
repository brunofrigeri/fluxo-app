-- Fluxo 0009: modalities (Pilates, Acupuncture, more later). Run after 0001-0008.
--
-- A studio offers one or more modalities; each user teaches some of them; each client is enrolled
-- in modalities and has a responsible instructor PER modality. Slots, bookings, evaluations,
-- evolutions, class notes and wait list entries all carry a modality.
--
-- Everything that exists today is Pilates: it is backfilled, and every studio gets Pilates enabled,
-- so nothing changes for current data.
--
-- Access rule: an instructor sees a client only in the modalities where they are responsible, and
-- only the slots, bookings, evaluations and evolutions of those modalities. Documents have no
-- modality: any instructor responsible for the client in any modality sees them.

-- ---------------------------------------------------------------- tables

-- Code-owned seed table: the keys match MODALITY_KEYS in packages/forms. Nobody writes it from the app.
create table modalities (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z_]+$'),
  name_pt text not null,
  sort int not null default 0
);

insert into modalities (key, name_pt, sort) values
  ('pilates', 'Pilates', 1),
  ('acupuncture', 'Acupuntura', 2);

create table studio_modalities (
  studio_id uuid not null references studios(id) on delete cascade,
  modality_id uuid not null references modalities(id),
  primary key (studio_id, modality_id)
);

create table user_modalities (
  user_id uuid not null references profiles(id) on delete cascade,
  modality_id uuid not null references modalities(id),
  primary key (user_id, modality_id)
);

-- Who is responsible for a client in a modality. A row also means "the client is enrolled in this
-- modality". instructor_id is null when nobody has been assigned yet (only admins see the client then).
create table client_modality_instructors (
  client_id uuid not null references clients(id) on delete cascade,
  modality_id uuid not null references modalities(id),
  instructor_id uuid references profiles(id) on delete set null,
  primary key (client_id, modality_id)
);

create index client_modality_instructors_instructor_idx on client_modality_instructors (instructor_id);

-- Who created a client: lets a new client be seen by its creator until it is assigned (see policies).
alter table clients add column created_by uuid references profiles(id) on delete set null default auth.uid();

-- ---------------------------------------------------------------- backfill: everything is Pilates

do $$
declare pilates uuid := (select id from modalities where key = 'pilates');
begin
  insert into studio_modalities (studio_id, modality_id) select id, pilates from studios;
  insert into user_modalities (user_id, modality_id) select id, pilates from profiles;
  insert into client_modality_instructors (client_id, modality_id, instructor_id)
    select id, pilates, instructor_id from clients;

  alter table recurring_slots add column modality_id uuid references modalities(id);
  alter table bookings add column modality_id uuid references modalities(id);
  alter table evaluations add column modality_id uuid references modalities(id);
  alter table evolutions add column modality_id uuid references modalities(id);
  alter table session_notes add column modality_id uuid references modalities(id);
  alter table wait_list add column modality_id uuid references modalities(id);

  update recurring_slots set modality_id = pilates;
  update bookings set modality_id = pilates;
  update evaluations set modality_id = pilates;
  update evolutions set modality_id = pilates;
  update session_notes set modality_id = pilates;
  update wait_list set modality_id = pilates;
end $$;

alter table recurring_slots alter column modality_id set not null;
alter table evaluations alter column modality_id set not null;
alter table evolutions alter column modality_id set not null;
alter table session_notes alter column modality_id set not null;
alter table wait_list alter column modality_id set not null;

-- A booking is either a modality session, or a one-off labelled entry ("Aula experimental", an
-- activity Fluxo has no forms for). Labelled entries have no modality and never get an evolution.
alter table bookings add column label text;
alter table bookings add constraint bookings_modality_or_label check ((modality_id is null) = (label is not null));
alter table bookings add constraint bookings_label_not_blank check (label is null or btrim(label) <> '');

-- The class note is per date + time + modality.
alter table session_notes drop constraint session_notes_pkey;
alter table session_notes add primary key (studio_id, date, start_time, modality_id);

create index recurring_slots_modality_idx on recurring_slots (modality_id);
create index bookings_modality_idx on bookings (modality_id);
create index evaluations_modality_idx on evaluations (client_id, modality_id, date desc);
create index evolutions_modality_idx on evolutions (client_id, modality_id, date desc);

-- Superseded by client_modality_instructors; no policy or app code reads it any more.
-- It is kept (stale) until the migration is verified, then dropped in a later cleanup migration.
comment on column clients.instructor_id is 'DEPRECATED since 0009: use client_modality_instructors.';

-- ---------------------------------------------------------------- helpers (security definer, like app_role())

create or replace function public.client_in_my_studio(target uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from clients where id = target and studio_id = my_studio())
$$;

create or replace function public.profile_in_my_studio(target uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = target and studio_id = my_studio())
$$;

create or replace function public.client_has_no_modalities(target uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select not exists (select 1 from client_modality_instructors where client_id = target)
$$;

-- The core access rule. Admins of the client's studio see everything. An instructor needs to be the
-- responsible instructor of that client in `modality`; with a null `modality` any modality counts
-- (client-level data like documents, and labelled bookings).
create or replace function public.can_access_client(target uuid, modality uuid default null) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from clients c
    where c.id = target
      and c.studio_id = my_studio()
      and (
        app_role() = 'admin'
        or exists (
          select 1 from client_modality_instructors m
          where m.client_id = c.id
            and m.instructor_id = auth.uid()
            and (modality is null or m.modality_id = modality)
        )
      )
  )
$$;

-- ---------------------------------------------------------------- business rules (triggers)
--
-- These enforce invariants, so they are security definer: they must see every row, not only the
-- rows the signed-in user's RLS lets through (an instructor cannot read a colleague's assignment,
-- but the rule "the instructor must teach this modality" still has to be checked).

-- Notes and the wait list: the modality must be enabled in the studio.
create function enforce_studio_modality() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from studio_modalities where studio_id = new.studio_id and modality_id = new.modality_id) then
    raise exception 'Esta modalidade não está ativa no estúdio.' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger session_notes_modality_rule
  before insert or update of studio_id, modality_id on session_notes
  for each row execute function enforce_studio_modality();
create trigger wait_list_modality_rule
  before insert or update of studio_id, modality_id on wait_list
  for each row execute function enforce_studio_modality();

-- Slots, bookings, evaluations, evolutions: the client must be enrolled in that modality, and the
-- studio must offer it. (Labelled bookings have no modality and skip this.)
create function enforce_client_modality() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.modality_id is null then
    return new;
  end if;
  if not exists (
    select 1
    from client_modality_instructors m
    join clients c on c.id = m.client_id
    join studio_modalities sm on sm.studio_id = c.studio_id and sm.modality_id = m.modality_id
    where m.client_id = new.client_id and m.modality_id = new.modality_id
  ) then
    raise exception 'O cliente não está inscrito nesta modalidade.' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger recurring_slots_modality_rule
  before insert or update of client_id, modality_id on recurring_slots
  for each row execute function enforce_client_modality();
create trigger bookings_modality_rule
  before insert or update of client_id, modality_id on bookings
  for each row execute function enforce_client_modality();
create trigger evaluations_modality_rule
  before insert or update of client_id, modality_id on evaluations
  for each row execute function enforce_client_modality();
create trigger evolutions_modality_rule
  before insert or update of client_id, modality_id on evolutions
  for each row execute function enforce_client_modality();

-- Responsible instructor: same studio as the client, and teaches that modality.
create function enforce_client_instructor() returns trigger
language plpgsql security definer set search_path = public as $$
declare c_studio uuid;
begin
  select studio_id into c_studio from clients where id = new.client_id;
  if not exists (select 1 from studio_modalities where studio_id = c_studio and modality_id = new.modality_id) then
    raise exception 'Esta modalidade não está ativa no estúdio.' using errcode = '23514';
  end if;
  if new.instructor_id is not null then
    if not exists (select 1 from profiles where id = new.instructor_id and studio_id = c_studio) then
      raise exception 'O instrutor não pertence a este estúdio.' using errcode = '23514';
    end if;
    if not exists (select 1 from user_modalities where user_id = new.instructor_id and modality_id = new.modality_id) then
      raise exception 'O instrutor não ensina esta modalidade.' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

create trigger client_modality_instructors_rule
  before insert or update of client_id, modality_id, instructor_id on client_modality_instructors
  for each row execute function enforce_client_instructor();

-- A modality with history cannot be removed from a client. (Deleting the client itself cascades
-- through here at trigger depth > 1, which is allowed.)
create function protect_client_modality() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if pg_trigger_depth() > 1 then
    return old;
  end if;
  if exists (select 1 from recurring_slots where client_id = old.client_id and modality_id = old.modality_id)
     or exists (select 1 from bookings where client_id = old.client_id and modality_id = old.modality_id)
     or exists (select 1 from evaluations where client_id = old.client_id and modality_id = old.modality_id)
     or exists (select 1 from evolutions where client_id = old.client_id and modality_id = old.modality_id) then
    raise exception 'Esta modalidade já tem horários ou registros neste cliente e não pode ser removida.' using errcode = '23514';
  end if;
  return old;
end $$;

create trigger client_modality_instructors_protect
  before delete on client_modality_instructors
  for each row execute function protect_client_modality();

-- A user can only teach modalities the studio offers.
create function enforce_user_modality() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from profiles p join studio_modalities sm on sm.studio_id = p.studio_id
    where p.id = new.user_id and sm.modality_id = new.modality_id
  ) then
    raise exception 'Esta modalidade não está ativa no estúdio.' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger user_modalities_rule
  before insert or update on user_modalities
  for each row execute function enforce_user_modality();

-- A user who stops teaching a modality stops being responsible for clients in it.
create function release_user_modality() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update client_modality_instructors set instructor_id = null
  where instructor_id = old.user_id and modality_id = old.modality_id;
  return old;
end $$;

create trigger user_modalities_release
  after delete on user_modalities
  for each row execute function release_user_modality();

-- A studio cannot switch off a modality while clients are enrolled in it.
create function protect_studio_modality() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if pg_trigger_depth() > 1 then
    return old;
  end if;
  if exists (
    select 1 from client_modality_instructors m join clients c on c.id = m.client_id
    where c.studio_id = old.studio_id and m.modality_id = old.modality_id
  ) then
    raise exception 'Há clientes inscritos nesta modalidade. Remova a modalidade deles antes de desativá-la.' using errcode = '23514';
  end if;
  delete from user_modalities um using profiles p
  where um.user_id = p.id and p.studio_id = old.studio_id and um.modality_id = old.modality_id;
  return old;
end $$;

create trigger studio_modalities_protect
  before delete on studio_modalities
  for each row execute function protect_studio_modality();

-- Evolutions: the linked session must be of the same modality (a labelled booking has none, so it
-- can never carry an evolution). Replaces the 0001 function.
create or replace function enforce_evolution_booking() returns trigger
language plpgsql as $$
declare
  b_status attendance_status;
  b_client uuid;
  b_modality uuid;
begin
  if new.booking_id is not null then
    select status, client_id, modality_id into b_status, b_client, b_modality from bookings where id = new.booking_id;
    if b_status is null or b_status not in ('PRESENCE_CONFIRMED', 'REPLACEMENT') then
      raise exception 'Só é possível registrar evolução para quem esteve presente ou fez reposição.'
        using errcode = '23514';
    end if;
    if b_client <> new.client_id then
      raise exception 'A sessão vinculada pertence a outro cliente.' using errcode = '23514';
    end if;
    if b_modality is distinct from new.modality_id then
      raise exception 'A sessão vinculada é de outra modalidade.' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

drop trigger evolutions_booking_rule on evolutions;
create trigger evolutions_booking_rule
  before insert or update of booking_id, client_id, modality_id on evolutions
  for each row execute function enforce_evolution_booking();

-- A replacement must point to a justified miss of the same client and the same modality.
-- Replaces the 0001 function.
create or replace function enforce_replacement_link() returns trigger
language plpgsql as $$
declare
  m_status attendance_status;
  m_client uuid;
  m_modality uuid;
begin
  if new.replaces_booking_id is not null then
    select status, client_id, modality_id into m_status, m_client, m_modality from bookings where id = new.replaces_booking_id;
    if m_client is distinct from new.client_id or m_status is distinct from 'JUSTIFIED_MISS' then
      raise exception 'Uma reposição precisa apontar para uma falta justificada do mesmo cliente.'
        using errcode = '23514';
    end if;
    if m_modality is distinct from new.modality_id then
      raise exception 'A reposição precisa ser da mesma modalidade da falta.' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

drop trigger bookings_replacement_rule on bookings;
create trigger bookings_replacement_rule
  before insert or update of replaces_booking_id, client_id, modality_id on bookings
  for each row execute function enforce_replacement_link();

-- Bookings generated from a recurring slot inherit its modality. Replaces the 0001 function.
create or replace function generate_bookings(weeks integer default 8) returns integer
language plpgsql as $$
declare
  inserted integer;
begin
  with days as (
    select d::date as day
    from generate_series(current_date, current_date + (weeks * 7), interval '1 day') as d
  ), ins as (
    insert into bookings (client_id, date, start_time, recurring_slot_id, modality_id)
    select rs.client_id, days.day, rs.start_time, rs.id, rs.modality_id
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

-- ---------------------------------------------------------------- row level security

alter table modalities enable row level security;
create policy "read modalities" on modalities for select to authenticated using (true);

alter table studio_modalities enable row level security;
create policy "read studio modalities" on studio_modalities for select to authenticated
  using (studio_id = my_studio());
create policy "admin enables studio modalities" on studio_modalities for insert to authenticated
  with check (app_role() = 'admin' and studio_id = my_studio());
create policy "admin disables studio modalities" on studio_modalities for delete to authenticated
  using (app_role() = 'admin' and studio_id = my_studio());

alter table user_modalities enable row level security;
create policy "read user modalities" on user_modalities for select to authenticated
  using (user_id = auth.uid() or (app_role() = 'admin' and profile_in_my_studio(user_id)));
create policy "admin adds user modalities" on user_modalities for insert to authenticated
  with check (app_role() = 'admin' and profile_in_my_studio(user_id));
create policy "admin removes user modalities" on user_modalities for delete to authenticated
  using (app_role() = 'admin' and profile_in_my_studio(user_id));

alter table client_modality_instructors enable row level security;
create policy "read client modalities" on client_modality_instructors for select to authenticated
  using (can_access_client(client_id, modality_id));
-- Admins assign anyone. An instructor can only enroll a client they just created (still unassigned)
-- or add a modality to a client they already handle, and only as themselves: never take over a colleague's client.
create policy "assign client modalities" on client_modality_instructors for insert to authenticated
  with check (
    client_in_my_studio(client_id)
    and (
      app_role() = 'admin'
      or (
        instructor_id = auth.uid()
        and exists (select 1 from clients c where c.id = client_id and c.created_by = auth.uid())
        and (client_has_no_modalities(client_id) or can_access_client(client_id))
      )
    )
  );
create policy "admin reassigns client modalities" on client_modality_instructors for update to authenticated
  using (app_role() = 'admin' and client_in_my_studio(client_id))
  with check (app_role() = 'admin' and client_in_my_studio(client_id));
create policy "admin unenrolls client modalities" on client_modality_instructors for delete to authenticated
  using (app_role() = 'admin' and client_in_my_studio(client_id));

-- Clients: admins see all; an instructor sees the clients they are responsible for in at least one
-- modality, plus a client they created that nobody has been assigned to yet (so the insert can return it).
drop policy "scoped access" on clients;
create policy "read clients" on clients for select to authenticated
  using (
    can_access_client(id)
    or (studio_id = my_studio() and created_by = auth.uid() and client_has_no_modalities(id))
  );
create policy "create clients" on clients for insert to authenticated
  with check (studio_id = my_studio() and created_by = auth.uid());
create policy "update clients" on clients for update to authenticated
  using (can_access_client(id))
  with check (studio_id = my_studio() and can_access_client(id));
create policy "delete clients" on clients for delete to authenticated
  using (
    can_access_client(id)
    or (studio_id = my_studio() and created_by = auth.uid() and client_has_no_modalities(id))
  );

-- Slots, bookings, evaluations, evolutions: scoped by the modality of the row.
do $$
declare t text;
begin
  foreach t in array array['recurring_slots', 'bookings', 'evaluations', 'evolutions'] loop
    execute format('drop policy "scoped access" on %I', t);
    execute format(
      'create policy "scoped access" on %1$I for all to authenticated '
      'using (can_access_client(client_id, modality_id)) '
      'with check (can_access_client(client_id, modality_id))',
      t);
  end loop;
end $$;

-- Documents have no modality: any modality counts.
drop policy "scoped access" on documents;
create policy "scoped access" on documents for all to authenticated
  using (can_access_client(client_id))
  with check (can_access_client(client_id));

-- Storage: the client id is the first path segment ("<clientId>/<uuid>.<ext>").
-- `objects.name` is qualified on purpose: inside the subquery a bare `name` binds to clients.name, which
-- made the 0006/0007 versions of this policy compare against the client's name instead of the file path.
drop policy "scoped access client-documents" on storage.objects;
create policy "scoped access client-documents" on storage.objects for all to authenticated
  using (
    bucket_id = 'client-documents'
    and exists (select 1 from clients c where c.id::text = (storage.foldername(objects.name))[1] and can_access_client(c.id))
  )
  with check (
    bucket_id = 'client-documents'
    and exists (select 1 from clients c where c.id::text = (storage.foldername(objects.name))[1] and can_access_client(c.id))
  );
