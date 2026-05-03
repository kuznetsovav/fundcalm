-- DCA plans: one active plan per user.
-- Allocation is stored as jsonb so risk-bucket schema can evolve without migrations.

create table if not exists dca_plans (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  monthly_amount  numeric not null check (monthly_amount >= 0),
  risk_bucket     text not null check (risk_bucket in ('conservative', 'balanced', 'growth')),
  allocation      jsonb not null,
  day_of_month    integer not null default 15 check (day_of_month between 1 and 28),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint one_plan_per_user unique (user_id)
);

create or replace trigger dca_plans_updated_at
  before update on dca_plans
  for each row execute function set_updated_at();

alter table dca_plans enable row level security;

create policy "DCA plans: read own"
  on dca_plans for select using (user_id = auth.uid());

create policy "DCA plans: insert own"
  on dca_plans for insert with check (user_id = auth.uid());

create policy "DCA plans: update own"
  on dca_plans for update using (user_id = auth.uid());

notify pgrst, 'reload schema';
