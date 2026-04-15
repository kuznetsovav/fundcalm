# FundCalm — Claude Project Guide

## What this product is
FundCalm is a financial clarity tool. Users answer ~10 onboarding questions about their income, savings, spending habits, and fears. The app diagnoses their financial health and gives calm, actionable guidance — no jargon, no anxiety.

## Stack
- **Next.js 16.2.3** App Router (server + client components, no pages dir)
- **Supabase** PostgreSQL — service role key used server-side (bypasses RLS automatically)
- **Tailwind CSS 3** — custom `fc-` utility prefix where needed
- **TypeScript 5** — strict mode, no `any`
- **Vercel** deployment — no middleware, no edge runtime

## Key directories
```
src/
  app/
    api/              # Route handlers (profile, allocations, checkin, explain, digest)
    dashboard/        # Main dashboard (server page + client sub-components)
    onboarding/       # Multi-step onboarding form (client component)
    checkin/          # Periodic check-in flow
  lib/
    engine.ts         # Public API — re-exports from diagnosis-engine + own types
    diagnosis-engine.ts  # Core: classifyUser(), Diagnosis enum, deriveMetrics()
    profiles.ts       # Supabase read/write for users + financial_profiles
    snapshots.ts      # profile_snapshots table helpers
    allocations.ts    # monthly_allocations table helpers
    investment-nudge.ts  # buildInvestmentNudge() pure logic
    money-tiers.ts    # Currency-aware tier midpoints, formatting
    staleness.ts      # Confidence decay when profile is old
    ...
  components/
    paywall.tsx
supabase/
  schema.sql          # Source of truth for DB schema — run in Supabase SQL Editor
```

## Diagnosis states (7, mutually exclusive)
| Diagnosis | Meaning |
|---|---|
| `CriticalBuffer` | Runway < 1 month |
| `InsufficientBuffer` | Runway 1–3 months |
| `LimitedBuffer` | Runway 3 months → target |
| `Overinvested` | Runway < 3 months + >60% in investments |
| `TooConservative` | Above target, >70% cash |
| `BalancedButIdle` | Above target, <30% investments |
| `Healthy` | Above target, 30–70% investments |

## User identity model
- No auth sessions. Identity = UUID in `users` table.
- UUID is passed as `?user=UUID` query param and stored in `fundcalm_uid` cookie.
- `/api/profile` POST sets `Set-Cookie: fundcalm_uid` in the response.
- Dashboard reads `?user=` first, then falls back to cookie.
- `UserCookieSetter` client component refreshes cookie from `?user=` on each dashboard visit.
- Users with `access_token` set require `?token=` in the URL (token gate).

## Primary fears (4 values)
`income_loss` | `market_crash` | `making_mistake` | `missing_opportunities`

All user-facing copy in nudges, suggestions, and action cards is fear-aware.

## Data flow: dashboard
1. `resolveDashboardData(searchParams)` — server, fetches profile + snapshots + allocations in parallel via `withTimeout()`
2. `getFinancialStatus(input)` — pure, synchronous engine call
3. `buildInvestmentNudge(...)` — pure, synchronous
4. `ClarityView` — server component renders all sections
5. Client sub-components: `MonthlyLog`, `WhatIfPanel`, `EditableProfileRows`, `InvestmentNudgeSection`, `UserCookieSetter`

## API routes
| Route | Method | Purpose |
|---|---|---|
| `/api/profile` | POST | Create/update financial profile, sets cookie |
| `/api/profile/[userId]` | GET | Fetch profile by userId |
| `/api/allocations` | GET `?userId=` | Fetch monthly allocations |
| `/api/allocations` | POST | Upsert one month's allocation |
| `/api/checkin` | POST | Save snapshot before profile update |
| `/api/explain` | POST | OpenAI-powered explanation |
| `/api/digest` | POST | Monthly digest email |

## Database tables
- `users` — id (uuid), email, access_token, created_at
- `financial_profiles` — one per user, all onboarding answers + derived fields
- `profile_snapshots` — one row per check-in, historical record
- `monthly_allocations` — one row per (user, year, month), income/spent/saved log

## Conventions
- **Never use `any`** — use `unknown` and narrow, or proper types
- **No chart libraries** — all charts are inline SVG with hardcoded viewBox
- **Optimistic UI** — client components update local state immediately on API success
- **withTimeout()** wrapper on all DB fetches in dashboard SSR (prevents page hang)
- **Server components** for data fetching; **client components** only for interactivity
- **Do not run `npm run dev`** unless explicitly asked — the dev server may already be running

## Environment variables required
```
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SUPABASE_ANON_KEY   # fallback if service role not set
OPENAI_API_KEY                  # for /api/explain
RESEND_API_KEY                  # for welcome + digest emails
```

## Schema changes
Always update `supabase/schema.sql` alongside any DB changes. New columns use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. User runs the SQL manually in Supabase SQL Editor.
