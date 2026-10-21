-- Fluxo 0010: one generic shape for evaluations and evolutions. Run after 0009.
--
-- The old model had one column per Pilates field. Every modality now shares the same tables:
--   real columns:  id, studio_id, client_id, modality_id, date, created_by,
--                  (evolutions) booking_id and session_number
--   modality data: data jsonb + schema_version int, validated on the server by the form definitions
--                  in packages/forms (unknown keys are rejected there, never stored).
--
-- Existing Pilates rows are migrated into `data`. The old columns are NOT dropped here: verify the
-- migration first (queries at the bottom), then drop them in a later cleanup migration. Until then
-- no code reads or writes them.

alter table evaluations
  add column studio_id uuid references studios(id),
  add column created_by uuid references profiles(id) on delete set null,
  add column data jsonb not null default '{}',
  add column schema_version int not null default 1;

alter table evolutions
  add column studio_id uuid references studios(id),
  add column created_by uuid references profiles(id) on delete set null,
  add column data jsonb not null default '{}',
  add column schema_version int not null default 1,
  add column session_number int check (session_number is null or session_number > 0);

update evaluations e set studio_id = c.studio_id from clients c where c.id = e.client_id;
update evolutions e set studio_id = c.studio_id from clients c where c.id = e.client_id;

-- Pilates evaluation: the seven text columns become keys of `data` (nulls are not stored).
update evaluations set data = jsonb_strip_nulls(jsonb_build_object(
  'main_complaint', main_complaint,
  'diagnosis', diagnosis,
  'hdp', hdp,
  'hda', hda,
  'medications', medications,
  'movement_restrictions', movement_restrictions,
  'obs', obs
));

-- Pilates evolution: the apparatus tree moves as-is under the "apparatus" key. Rows saved before
-- 0002 (free text per area) keep their old shape; the app normalizes it when it reads.
update evolutions set data = case when apparatus = '{}'::jsonb then '{}'::jsonb else jsonb_build_object('apparatus', apparatus) end;

-- Session number: how many evolutions the client had in that modality, in order.
update evolutions e set session_number = n.rn
from (
  select id, row_number() over (partition by client_id, modality_id order by date, created_at, id) as rn
  from evolutions
) n
where n.id = e.id;

alter table evaluations alter column studio_id set not null;
alter table evolutions alter column studio_id set not null;
alter table evolutions alter column session_number set not null;

alter table evaluations add constraint evaluations_data_is_object check (jsonb_typeof(data) = 'object');
alter table evolutions add constraint evolutions_data_is_object check (jsonb_typeof(data) = 'object');

-- studio_id always comes from the client (a caller cannot point a record at another studio), and the
-- author is whoever is signed in.
create function set_record_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select studio_id into new.studio_id from clients where id = new.client_id;
  if tg_op = 'INSERT' and auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end $$;

create trigger evaluations_owner before insert or update of client_id on evaluations
  for each row execute function set_record_owner();
create trigger evolutions_owner before insert or update of client_id on evolutions
  for each row execute function set_record_owner();

comment on column evaluations.main_complaint is 'DEPRECATED since 0010: now evaluations.data->>''main_complaint''. Dropped after verification.';
comment on column evaluations.diagnosis is 'DEPRECATED since 0010: see evaluations.data.';
comment on column evaluations.hdp is 'DEPRECATED since 0010: see evaluations.data.';
comment on column evaluations.hda is 'DEPRECATED since 0010: see evaluations.data.';
comment on column evaluations.medications is 'DEPRECATED since 0010: see evaluations.data.';
comment on column evaluations.movement_restrictions is 'DEPRECATED since 0010: see evaluations.data.';
comment on column evaluations.obs is 'DEPRECATED since 0010: see evaluations.data.';
comment on column evolutions.apparatus is 'DEPRECATED since 0010: now evolutions.data->''apparatus''. Dropped after verification.';

-- Verification, run by hand before dropping the old columns (all three must return 0):
--   select count(*) from evolutions where apparatus <> '{}'::jsonb and data->'apparatus' is distinct from apparatus;
--   select count(*) from evaluations where main_complaint is distinct from data->>'main_complaint';
--   select count(*) from evolutions where session_number is null;
