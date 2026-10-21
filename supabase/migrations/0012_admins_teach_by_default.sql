-- Fluxo 0012: admins are instructors by default. Run after 0011.
--
-- An admin teaches every modality the studio offers, unless unticked on Users. So:
--   - a new admin teaches all the modalities the studio already offers;
--   - a modality the studio switches on is added to every admin of that studio.
-- Existing admins are backfilled.

create function admin_teaches_studio_modalities() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'admin' then
    insert into user_modalities (user_id, modality_id)
    select new.id, sm.modality_id from studio_modalities sm where sm.studio_id = new.studio_id
    on conflict do nothing;
  end if;
  return new;
end $$;

create trigger profiles_admin_teaches
  after insert or update of role, studio_id on profiles
  for each row execute function admin_teaches_studio_modalities();

create function studio_modality_taught_by_admins() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into user_modalities (user_id, modality_id)
  select p.id, new.modality_id from profiles p where p.studio_id = new.studio_id and p.role = 'admin'
  on conflict do nothing;
  return new;
end $$;

create trigger studio_modalities_admins_teach
  after insert on studio_modalities
  for each row execute function studio_modality_taught_by_admins();

insert into user_modalities (user_id, modality_id)
select p.id, sm.modality_id
from profiles p join studio_modalities sm on sm.studio_id = p.studio_id
where p.role = 'admin'
on conflict do nothing;
