-- Run in Supabase SQL Editor after the initial schema.
-- Adds richer onboarding fields for the decision engine.

alter table financial_profiles
  add column if not exists cash text,
  add column if not exists expenses text,
  add column if not exists savings_rate text,
  add column if not exists country text;
