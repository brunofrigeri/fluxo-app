-- Fluxo 0008: fix a blind spot in the self-signup profile policy. Run after 0007.
--
-- "signup creates profile" (0007) checked `not exists (select 1 from profiles p2 where
-- p2.studio_id = ...)` directly against profiles, which is itself RLS-protected. A user with
-- no profile yet can never see ANY row in profiles (not even someone else's), so that subquery
-- always returned zero rows regardless of whether the studio was really unclaimed — the check
-- was vacuously true. It happened to still work for legitimate signups, but it wasn't actually
-- stopping a signup from claiming admin on an existing, populated studio (e.g. if that studio's
-- id ever leaked). Route the check through a security-definer function, like app_role()/my_studio().

create or replace function public.studio_is_unclaimed(target_studio uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select not exists (select 1 from profiles where studio_id = target_studio)
$$;

drop policy "signup creates profile" on profiles;
create policy "signup creates profile" on profiles for insert to authenticated
  with check (id = auth.uid() and role = 'admin' and studio_is_unclaimed(studio_id));
