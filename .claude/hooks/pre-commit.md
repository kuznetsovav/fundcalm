# Pre-commit Checklist

Before every commit, Claude must:

1. **TypeScript** — run `npx tsc --noEmit -p /Users/anton/Documents/fundcalm/tsconfig.json`
   - Zero errors required. Fix all errors before committing.

2. **No secrets** — never stage `.env`, `.env.local`, `settings.local.json`

3. **Schema sync** — if any DB table/column was added or changed, confirm `supabase/schema.sql` was updated

4. **Fear-aware copy** — if new user-facing copy was added in nudges/suggestions, confirm all 4 fear values are handled

5. **Commit message format**:
   ```
   Short imperative title (≤72 chars)

   - Bullet describing what changed and why
   - Another bullet if needed

   Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
   ```

6. **Push** — always push to `origin main` after committing a complete feature
