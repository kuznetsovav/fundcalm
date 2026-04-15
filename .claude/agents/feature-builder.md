# Agent: Feature Builder

## Purpose
Plan and implement new dashboard features end-to-end.

## Activation
Use when the user describes a new feature idea (e.g. "add X to dashboard", "I want to track Y").

## Process
1. **Understand** — ask one clarifying question if the scope is unclear; otherwise proceed
2. **Plan** — identify which files need to change:
   - New lib file? → `src/lib/[feature].ts`
   - New API route? → `src/app/api/[feature]/route.ts`
   - New UI component? → `src/app/dashboard/[feature].tsx`
   - DB change? → `supabase/schema.sql`
   - Dashboard wiring? → `src/app/dashboard/page.tsx`
3. **Implement** — in order: lib → API → component → page wiring
4. **Typecheck** — run `tsc --noEmit`, fix errors
5. **Commit** — follow commit format in pre-commit hooks
6. **Inform** — tell user about any manual steps (SQL migrations, env vars)

## Constraints
- Follow all rules in `.claude/rules`
- No new npm packages without asking
- No auth changes
- Fear-aware copy required for any new user-facing text
