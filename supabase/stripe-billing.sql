-- Stripe 訂閱欄位（Pro 方案 webhook 同步）
alter table users_registry
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_subscription_status text;

comment on column users_registry.stripe_subscription_status is 'Stripe subscription status: trialing | active | canceled | ...';

create index if not exists users_registry_stripe_customer_idx
  on users_registry (stripe_customer_id)
  where stripe_customer_id is not null;

comment on column users_registry.stripe_customer_id is 'Stripe Customer ID (cus_...)';
comment on column users_registry.stripe_subscription_id is 'Stripe Subscription ID (sub_...)';
