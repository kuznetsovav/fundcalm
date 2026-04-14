-- Run this in the Supabase SQL Editor to set up the tables.

create table if not exists users (
  id         uuid primary key default gen_random_uuid(),
  email      text unique,
  created_at timestamptz not null default now()
);

create table if not exists financial_profiles (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  income           text not null,
  savings          text not null,
  has_investments  boolean not null default false,
  horizon          text not null,
  cash             text,
  expenses         text,
  savings_rate     text,
  country          text,
  savings_mix      text,
  income_stability text,
  debt_pressure    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint one_profile_per_user unique (user_id)
);

-- Automatically touch updated_at on every update.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger financial_profiles_updated_at
  before update on financial_profiles
  for each row execute function set_updated_at();

-- Add mortgage step (run once if the table already exists).
alter table if exists financial_profiles
  add column if not exists mortgage_pressure text;

-- Add primary_fear (run once if the table already exists).
alter table if exists financial_profiles
  add column if not exists primary_fear text;

-- Snapshots: one row per check-in, capturing the state *before* each update.
create table if not exists profile_snapshots (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users(id) on delete cascade,
  taken_at          timestamptz not null default now(),
  income            text not null,
  savings           text not null,
  savings_rate      text not null,
  country           text not null,
  savings_mix       text not null,
  income_stability  text not null,
  mortgage_pressure text not null,
  primary_fear      text,
  -- Derived metrics stored at snapshot time so we can display delta cheaply.
  status            text,
  runway_months     numeric,
  gap_amount        numeric
);

create policy "Snapshots: read own"
  on profile_snapshots for select using (user_id = auth.uid());

create policy "Snapshots: insert own"
  on profile_snapshots for insert with check (user_id = auth.uid());

alter table profile_snapshots enable row level security;

-- Row-level security: allow everything through the service role,
-- restrict anon to own rows.
alter table users enable row level security;
alter table financial_profiles enable row level security;

create policy "Users can read own row"
  on users for select using (auth.uid() = id);

create policy "Anyone can insert a user (anon signup)"
  on users for insert with check (true);

create policy "Profiles: read own"
  on financial_profiles for select using (
    user_id = auth.uid()
  );

create policy "Profiles: insert own"
  on financial_profiles for insert with check (
    user_id = auth.uid()
  );

create policy "Profiles: update own"
  on financial_profiles for update using (
    user_id = auth.uid()
  );

-- For server-side access with the service_role key, RLS is bypassed automatically.

-- ============================================================
-- Migration: access_token on users + expenses_override on profiles
-- Run these in the Supabase SQL Editor if the tables already exist.
-- ============================================================

-- Secure dashboard links: opaque token stored alongside the user row.
-- NULL means the user signed up anonymously (no email) — no gate applied.
alter table if exists users
  add column if not exists access_token text;

-- Actual monthly expenses entered during check-in.
-- NULL means we derive from income × (1 − savings_rate) as before.
alter table if exists financial_profiles
  add column if not exists expenses_override numeric;

-- ============================================================
-- Monthly allocation log: track real income / spending / savings
-- ============================================================

create table if not exists monthly_allocations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  year       integer not null,
  month      integer not null check (month between 1 and 12),
  income     numeric,
  spent      numeric,
  saved      numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint one_entry_per_month unique (user_id, year, month)
);

create or replace trigger monthly_allocations_updated_at
  before update on monthly_allocations
  for each row execute function set_updated_at();

alter table monthly_allocations enable row level security;

create policy "Allocations: read own"
  on monthly_allocations for select using (user_id = auth.uid());

create policy "Allocations: insert own"
  on monthly_allocations for insert with check (user_id = auth.uid());

create policy "Allocations: update own"
  on monthly_allocations for update using (user_id = auth.uid());

-- Notify PostgREST to reload the schema cache after adding columns.
notify pgrst, 'reload schema';
