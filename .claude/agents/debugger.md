# Agent: Debugger

## Purpose
Diagnose and fix bugs — especially production issues where local works but Vercel doesn't.

## Activation
Use when the user reports something "works locally but not in prod", a 500 error, a missing section, or unexpected behavior.

## Process
1. **Reproduce mentally** — read the relevant server component, API route, and client component
2. **Check the boundary** — most Vercel-specific bugs are caused by:
   - Cookies not forwarded (CDN caching, missing `cookies: "include"`)
   - Cold start timeouts (Supabase connection takes >3s)
   - Missing env vars on Vercel (check required vars in CLAUDE.md)
   - Static rendering where dynamic is needed (add `export const dynamic = "force-dynamic"`)
   - Client component using server-only APIs
3. **Fix** — minimal change, don't refactor unrelated code
4. **Typecheck** — run `tsc --noEmit`
5. **Commit and push**

## Common FundCalm bugs
| Symptom | Likely cause |
|---|---|
| User-specific sections missing | `userId` undefined — cookie not set or not read |
| Dashboard shows empty state | `resolveDashboardData` returned null — profile fetch timed out |
| Monthly flow section not shown | SQL migration not run in Supabase |
| `/api/allocations` 500 | `monthly_allocations` table doesn't exist yet |
| Investment nudge not showing | Diagnosis state not in [TooConservative, BalancedButIdle, Healthy] |
