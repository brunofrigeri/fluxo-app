-- Fluxo 0002. Run after 0001, in the Supabase SQL editor.

-- 1. A justified miss carries a reason (free text).
alter table bookings add column miss_reason text;

-- The reason only exists on a justified miss. (A null status does not pass this check.)
alter table bookings add constraint bookings_miss_reason_only_when_justified
  check (miss_reason is null or coalesce(status = 'JUSTIFIED_MISS', false));

-- A justified miss must have a reason. NOT VALID: justified misses saved before this
-- migration are left alone, but every new or changed row must have one.
alter table bookings add constraint bookings_justified_needs_reason
  check (status is distinct from 'JUSTIFIED_MISS' or nullif(btrim(miss_reason), '') is not null) not valid;

-- 2. Evolutions: the exercise tree now selects body regions instead of writing free text per area.
-- No table change is needed, evolutions.apparatus is jsonb. New shape, per apparatus and exercise type:
--   { "reformer": { "strengthening": { "regions": ["mmii", "hip"], "note": "optional text" } } }
-- regions: mmii, mmss, trunk, core, cervical, hip, shoulder_girdle, global.
-- Evolutions saved with the old shape (superiors / inferiors / global text) are converted when they are read.
comment on column evolutions.apparatus is
  'apparatus -> exercise type (mobility | strengthening | stretching) -> { regions: text[], note?: text }';
