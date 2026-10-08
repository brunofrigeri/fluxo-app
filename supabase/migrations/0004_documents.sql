-- Fluxo 0004: client documents (medical files). Run after 0001-0003, in the Supabase SQL editor.
-- Files live in the private "client-documents" Storage bucket; this table is their metadata.

create table documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  created_at timestamptz not null default now()
);

create index documents_client_idx on documents (client_id, created_at desc);

alter table documents enable row level security;
create policy "admin full access" on documents for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do nothing;

create policy "admin full access client-documents" on storage.objects for all to authenticated
using (bucket_id = 'client-documents') with check (bucket_id = 'client-documents');
