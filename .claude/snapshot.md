# Project Snapshot — 2026-04-15

## Recent commits (newest first)
```
4ff47ae Adding extra fix for Dashboard
d3a4a0e Fix userId cookie: set via Set-Cookie header instead of document.cookie
3928188 Adding fix for Dashboard
cb143b9 Persist userId in cookie so dashboard works without ?user= in URL
e98257c Adding fund allocation
a2cd15d Add monthly flow tracker: log income, spending, and savings per month
6da1382 Redesign dashboard Section 2 to be action-first
68b87c6 Merge claude/upbeat-solomon: investment nudge feature
```

## Features shipped
- **Diagnosis engine** — 7 states, fear-aware copy, staleness/confidence decay
- **Dashboard Section 2 redesign** — ActionCard (action-first), progress bar, pace countdown
- **Investment nudge** — emerald card for TooConservative/BalancedButIdle, review card for Healthy
- **Monthly flow tracker** — log income/spent/saved per month, SVG savings-rate chart, drift detection
- **User cookie persistence** — `fundcalm_uid` set via `Set-Cookie` in `/api/profile` response; `UserCookieSetter` refreshes it on dashboard

## Known issues / in progress
- [ ] **userId cookie not working on Vercel** — cookie set via `Set-Cookie` header in `/api/profile`, and via `UserCookieSetter` component. Vercel CDN may be stripping cookies on non-POST routes. Still under investigation.
- [ ] Dashboard "Monthly flow" section not visible in prod until `monthly_allocations` SQL migration is run

## Pending manual steps (user must do)
1. Run `monthly_allocations` migration in Supabase SQL Editor (lines 124–153 of `supabase/schema.sql`)
2. Existing users: visit `/dashboard?user=YOUR_UUID` once to set the cookie

## Architecture notes
- No auth sessions — identity via UUID in `?user=` param + `fundcalm_uid` cookie
- All DB access is service-role key (server-side only), bypasses RLS
- Dashboard is a server component; client components are leaf nodes only
- All charts: inline SVG, no chart libraries

## Source files by concern
| Concern | File |
|---|---|
| Diagnosis logic | `src/lib/diagnosis-engine.ts` |
| Public engine API | `src/lib/engine.ts` |
| Dashboard page | `src/app/dashboard/page.tsx` |
| Monthly flow UI | `src/app/dashboard/monthly-log.tsx` |
| Investment nudge UI | `src/app/dashboard/investment-nudge.tsx` |
| Investment nudge logic | `src/lib/investment-nudge.ts` |
| Profile DB helpers | `src/lib/profiles.ts` |
| Allocations DB helpers | `src/lib/allocations.ts` |
| Snapshots DB helpers | `src/lib/snapshots.ts` |
| Onboarding form | `src/app/onboarding/page.tsx` |
| DB schema | `supabase/schema.sql` |
