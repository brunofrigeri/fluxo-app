-- Fluxo 0011: shared client fields. Run after 0010.
--
-- Socio-demographic and history data is CLIENT data, filled once and shown for every modality
-- (the acupuncture paper form only asks for it because it is the first encounter). The acupuncture
-- evaluation does not repeat any of it.

alter table clients
  add column sex text check (sex in ('female', 'male', 'other')),
  add column marital_status text check (marital_status in ('single', 'married', 'stable_union', 'divorced', 'widowed')),
  add column city text,
  add column profession text,
  add column workplace text,
  add column children text,
  add column parents text,
  -- Health history, next to the existing diseases and surgeries.
  add column current_treatments text[] not null default '{}',
  add column previous_treatments text[] not null default '{}',
  add column medications text[] not null default '{}';
