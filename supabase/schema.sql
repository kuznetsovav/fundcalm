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
