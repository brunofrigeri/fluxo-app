-- Fluxo 0014: client payments. Run after 0001-0013.
--
-- A client pays the studio on a fixed day of the month (`billing_day`, asked at onboarding). Nothing is generated
-- ahead of time: a due date is "pending" until the studio records it, so a row in `payments` exists only once
-- someone said "paid" or "not paid". Anything due before today that is still pending is overdue, which is what
-- the Home page lists. Recording is manual; there is no payment gateway.
--
-- Money data is the studio's, not the instructors': only admins of the client's studio read or change payments
-- and the receipts attached to them.

-- ---------------------------------------------------------------- billing day on the client

alter table clients
  add column billing_day smallint check (billing_day between 1 and 31),
  -- Cycles count from this date on, so setting the day on an existing client never creates past debts.
  add column billing_since date;

create or replace function public.set_billing_since() returns trigger
language plpgsql as $$
begin
  if new.billing_day is null then
    new.billing_since := null;
  elsif tg_op = 'INSERT' then
    new.billing_since := coalesce(new.billing_since, (now() at time zone 'America/Sao_Paulo')::date);
  elsif old.billing_day is distinct from new.billing_day then
    -- Anyone registering a client picks the day, but only admins move it afterwards (it decides when money is due).
    if auth.uid() is not null and app_role() is distinct from 'admin' then
      raise exception 'Só administradores alteram o dia de pagamento.';
    end if;
    -- A new day starts a new cycle from today; what was recorded before stays in the history.
    new.billing_since := (now() at time zone 'America/Sao_Paulo')::date;
  end if;
  return new;
end $$;

create trigger clients_billing_since before insert or update of billing_day on clients
  for each row execute function set_billing_since();

-- ---------------------------------------------------------------- payments

create table payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  due_date date not null,
  status text not null check (status in ('paid', 'unpaid')),
  -- The day the money arrived (paid only). May differ from the day it was recorded.
  paid_on date,
  marked_by uuid references profiles(id) on delete set null default auth.uid(),
  marked_at timestamptz not null default now(),
  unique (client_id, due_date),
  check (status = 'paid' or paid_on is null)
);
create index payments_due_idx on payments (due_date);

-- A payment can only be recorded for a date the client's billing day actually produces
-- (day 31 falls on the last day of shorter months).
create or replace function public.check_payment_due_date() returns trigger
language plpgsql as $$
declare
  day smallint;
  last_day int;
begin
  select billing_day into day from clients where id = new.client_id;
  if day is null then
    raise exception 'Este cliente não tem dia de pagamento definido.';
  end if;
  last_day := extract(day from (date_trunc('month', new.due_date) + interval '1 month - 1 day'));
  if extract(day from new.due_date) <> least(day, last_day) then
    raise exception 'A data de vencimento não corresponde ao dia de pagamento do cliente.';
  end if;
  return new;
end $$;

create trigger payments_due_date before insert on payments
  for each row execute function check_payment_due_date();

alter table payments enable row level security;
create policy "admin access" on payments for all to authenticated
  using (app_role() = 'admin' and client_in_my_studio(client_id))
  with check (app_role() = 'admin' and client_in_my_studio(client_id));

-- ---------------------------------------------------------------- the due dates, with what was recorded

-- Every due date of an active client with a billing day, between `p_from` and `p_to` (inclusive), and what the
-- studio recorded for it: 'paid', 'unpaid' or 'pending' (nothing yet). A null `p_from` means from the start of each
-- client's billing. Security invoker, so RLS on clients applies; and since payments are admin-only, anyone else
-- gets no rows rather than a wall of false "pending".
create or replace function public.payment_cycles(p_from date, p_to date)
returns table (client_id uuid, client_name text, due_date date, status text, payment_id uuid, paid_on date)
language sql stable set search_path = public as $$
  select c.id, c.name, d.due, coalesce(p.status, 'pending'), p.id, p.paid_on
  from clients c
  cross join lateral (
    select (m::date + (least(c.billing_day, extract(day from (m + interval '1 month - 1 day'))::int) - 1))::date as due
    from generate_series(
      date_trunc('month', greatest(coalesce(p_from, c.billing_since), c.billing_since)),
      date_trunc('month', p_to::timestamp),
      interval '1 month'
    ) m
  ) d
  left join payments p on p.client_id = c.id and p.due_date = d.due
  where app_role() = 'admin'
    and c.active
    and c.billing_day is not null
    and d.due >= c.billing_since
    and d.due <= p_to
    and (p_from is null or d.due >= p_from)
  order by d.due, c.name
$$;

-- ---------------------------------------------------------------- receipts: documents that belong to a payment

alter table documents add column payment_id uuid references payments(id) on delete cascade;
create index documents_payment_idx on documents (payment_id) where payment_id is not null;

-- A receipt follows the payment's rule (admins only); every other document keeps the client rule.
drop policy "scoped access" on documents;
create policy "scoped access" on documents for all to authenticated
  using (can_access_client(client_id) and (payment_id is null or app_role() = 'admin'))
  with check (
    can_access_client(client_id)
    and (payment_id is null or (app_role() = 'admin' and exists (select 1 from payments p where p.id = payment_id and p.client_id = documents.client_id)))
  );

-- Receipt files live in "<clientId>/payments/<uuid>.<ext>": the second path segment marks them.
drop policy "scoped access client-documents" on storage.objects;
create policy "scoped access client-documents" on storage.objects for all to authenticated
  using (
    bucket_id = 'client-documents'
    and exists (select 1 from clients c where c.id::text = (storage.foldername(objects.name))[1] and can_access_client(c.id))
    and ((storage.foldername(objects.name))[2] is distinct from 'payments' or app_role() = 'admin')
  )
  with check (
    bucket_id = 'client-documents'
    and exists (select 1 from clients c where c.id::text = (storage.foldername(objects.name))[1] and can_access_client(c.id))
    and ((storage.foldername(objects.name))[2] is distinct from 'payments' or app_role() = 'admin')
  );
