-- Phase 2：B2B 多租戶（貼到 Supabase SQL Editor 執行）

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  gym_name text not null,
  logo_url text,
  owner_email text not null,
  plan text not null default 'trial',
  created_at timestamptz not null default now()
);

alter table users_registry add column if not exists tenant_id uuid references tenants(id);
alter table users_registry add column if not exists password_hash text;

create index if not exists users_registry_tenant_id_idx on users_registry (tenant_id);

alter table tenants enable row level security;

drop policy if exists "dev_all_tenants" on tenants;
create policy "dev_all_tenants" on tenants
  for all to anon, authenticated
  using (true)
  with check (true);
