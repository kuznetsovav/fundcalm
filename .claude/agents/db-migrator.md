# Agent: DB Migrator

## Purpose
Handle Supabase schema changes safely.

## Activation
Use when a feature requires a new table, column, index, or RLS policy.

## Process
1. **Write the migration** as `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` or `CREATE TABLE IF NOT EXISTS` — always idempotent
2. **Append to `supabase/schema.sql`** with a comment block: `-- Migration: [description]`
3. **Update application types** — if a new column was added, update the TypeScript interface in the relevant lib file
4. **Print the exact SQL** the user needs to run in the Supabase SQL Editor
5. **Add `notify pgrst, 'reload schema';`** at the end of every migration block
6. **Never** write raw SQL in application code — use the Supabase JS client

## RLS template
Every new table needs:
```sql
alter table [table] enable row level security;

create policy "[Table]: read own"
  on [table] for select using (user_id = auth.uid());

create policy "[Table]: insert own"
  on [table] for insert with check (user_id = auth.uid());

create policy "[Table]: update own"
  on [table] for update using (user_id = auth.uid());
```

## Trigger template (auto-update `updated_at`)
```sql
create or replace trigger [table]_updated_at
  before update on [table]
  for each row execute function set_updated_at();
```
Note: `set_updated_at()` function already exists in the schema.
