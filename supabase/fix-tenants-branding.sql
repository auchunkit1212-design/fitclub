-- tenants 品牌欄位對齊（theme_color + RLS）
alter table tenants add column if not exists theme_color text default 'emerald';

alter table tenants enable row level security;
drop policy if exists "dev_all_tenants" on tenants;
create policy "dev_all_tenants" on tenants
  for all to anon, authenticated using (true) with check (true);

-- student_nutrition_targets 租戶關聯
alter table student_nutrition_targets
  add column if not exists tenant_id uuid references tenants (id);

create index if not exists student_nutrition_targets_tenant_idx
  on student_nutrition_targets (tenant_id);

alter table student_nutrition_targets enable row level security;
drop policy if exists "phase4_targets_all" on student_nutrition_targets;
drop policy if exists "student_nutrition_targets_all" on student_nutrition_targets;
create policy "student_nutrition_targets_all" on student_nutrition_targets
  for all to anon, authenticated using (true) with check (true);
