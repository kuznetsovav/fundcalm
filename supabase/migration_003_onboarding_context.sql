-- Run in Supabase SQL Editor if the DB already exists.

alter table financial_profiles
  add column if not exists savings_mix text,
  add column if not exists income_stability text,
  add column if not exists debt_pressure text;
