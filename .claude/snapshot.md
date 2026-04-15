# Project Snapshot — 2026-04-15

## Recent commits (newest first)
```
82e7669 Fix root cause: remove 5s timeout in onboarding profile save
22b55b3 Fix dashboard access for all users: email recovery + proxy redirect
23fdf88 Fix userId for all users: home redirect + loading state during dashboard redirect
a547973 Fix userId redirect: middleware + hard reload
d3a5dcb Fix localStorage userId: save in onboarding submit + wrap with Suspense
f4218d8 Fix userId persistence: use localStorage + redirect instead of cookie-only
```

## Features shipped
- **Diagnosis engine** — 7 states, fear-aware copy, staleness/confidence decay
- **Dashboard Section 2 redesign** — ActionCard (action-first), progress bar, pace countdown
- **Investment nudge** — emerald card for TooConservative/BalancedButIdle, review card for Healthy
- **Monthly flow tracker** — log income/spent/saved per month, SVG savings-rate chart, drift detection
- **User identity** — cookie via Set-Cookie header from /api/profile + localStorage + proxy redirect
- **Email recovery** — /api/lookup + EmptyState recovery form for users with no localStorage/cookie
- **Home redirect** — returning users auto-redirected from / to /dashboard

## What was the Vercel bug (resolved)
Supabase env vars (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) were not added
to Vercel project settings. `isSupabaseConfigured()` returned false → `/api/profile` returned
`{ skipped: true }` with no `userId` → onboarding fell through to param-only URL → all
user-specific features hidden. Fixed by adding env vars in Vercel dashboard.

## Environment variables required (all must be set in Vercel)
```
NEXT_PUBLIC_SUPABASE_URL        ← was missing on Vercel
SUPABASE_SERVICE_ROLE_KEY       ← was missing on Vercel
NEXT_PUBLIC_SUPABASE_ANON_KEY   # fallback if service role not set
OPENAI_API_KEY                  # for /api/explain
RESEND_API_KEY                  # for welcome + digest emails
```

## Architecture — user identity flow
1. Onboarding submits → POST /api/profile → Set-Cookie: fundcalm_uid + returns { userId }
2. Onboarding client: localStorage.setItem("fundcalm_uid", userId) → router.push(/dashboard?user=UUID)
3. Dashboard proxy (src/proxy.ts): reads cookie → redirects /dashboard → /dashboard?user=UUID
4. Dashboard UserCookieSetter: reads localStorage → window.location.replace if no ?user=
5. HomeRedirect: on / page, reads localStorage → redirects to dashboard if found
6. EmptyState: email recovery form → /api/lookup → sets cookie + localStorage → redirect

## Source files by concern
| Concern | File |
|---|---|
| Diagnosis logic | `src/lib/diagnosis-engine.ts` |
| Public engine API | `src/lib/engine.ts` |
| Dashboard page | `src/app/dashboard/page.tsx` |
| Dashboard shell (empty/loading) | `src/app/dashboard/dashboard-shell.tsx` |
| Empty state + email recovery | `src/app/dashboard/empty-state.tsx` |
| Monthly flow UI | `src/app/dashboard/monthly-log.tsx` |
| Investment nudge UI | `src/app/dashboard/investment-nudge.tsx` |
| Investment nudge logic | `src/lib/investment-nudge.ts` |
| Profile DB helpers | `src/lib/profiles.ts` |
| Allocations DB helpers | `src/lib/allocations.ts` |
| Snapshots DB helpers | `src/lib/snapshots.ts` |
| Onboarding form | `src/app/onboarding/page.tsx` |
| Server-side proxy redirect | `src/proxy.ts` |
| Home page auto-redirect | `src/app/home-redirect.tsx` |
| User persistence client | `src/app/dashboard/user-cookie-setter.tsx` |
| Email lookup API | `src/app/api/lookup/route.ts` |
| DB schema | `supabase/schema.sql` |
