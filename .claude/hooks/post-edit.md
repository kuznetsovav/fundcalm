# Post-edit Checks

After editing any file in `src/`, Claude should:

1. Re-read the edited file to confirm the change looks correct
2. Check for broken imports — if a new import was added, verify the export exists in the source file
3. If `page.tsx` was edited — verify the server/client boundary wasn't violated (no `useState` in server components, no `cookies()` in client components)
4. If `supabase/schema.sql` was edited — note in the response that the user must run the migration manually
5. If a new API route was added — confirm it validates inputs and returns proper HTTP status codes
