import { getSupabase } from "./supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MonthlyAllocation {
  id: string;
  user_id: string;
  year: number;
  month: number;
  income: number | null;
  spent: number | null;
  saved: number | null;
  created_at: string;
  updated_at: string;
}

export interface AllocationInput {
  income?: number | null;
  spent?: number | null;
  saved?: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Savings rate (0–1) from an allocation, deriving saved from income−spent if needed. */
export function allocationSavingsRate(a: MonthlyAllocation): number | null {
  if (a.income == null || a.income <= 0) return null;
  const saved =
    a.saved ??
    (a.income != null && a.spent != null ? a.income - a.spent : null);
  if (saved == null) return null;
  return saved / a.income;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Fetch the most recent 24 monthly allocations for a user, newest first. */
export async function getMonthlyAllocations(
  userId: string,
): Promise<MonthlyAllocation[]> {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from("monthly_allocations")
    .select("*")
    .eq("user_id", userId)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(24);
  if (error) throw new Error(`Failed to fetch allocations: ${error.message}`);
  return (data as MonthlyAllocation[]) ?? [];
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/** Insert or update one month's allocation data. */
export async function upsertMonthlyAllocation(
  userId: string,
  year: number,
  month: number,
  input: AllocationInput,
): Promise<void> {
  const sb = await getSupabase();
  const { error } = await sb.from("monthly_allocations").upsert(
    {
      user_id: userId,
      year,
      month,
      income: input.income ?? null,
      spent: input.spent ?? null,
      saved: input.saved ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,year,month" },
  );
  if (error) throw new Error(`Failed to save allocation: ${error.message}`);
}
