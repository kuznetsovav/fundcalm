import { getSupabase } from "./supabase";
import type {
  IncomeRange,
  SavingsRange,
  SavingsRateRange,
  SavingsMix,
  IncomeStability,
  MortgagePressure,
  Status,
  OnboardingInput,
  FinancialResult,
} from "./engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SnapshotRow {
  id: string;
  user_id: string;
  taken_at: string;
  income: IncomeRange;
  savings: SavingsRange;
  savings_rate: SavingsRateRange;
  country: string;
  savings_mix: SavingsMix;
  income_stability: IncomeStability;
  mortgage_pressure: MortgagePressure;
  primary_fear: string | null;
  status: Status | null;
  runway_months: number | null;
  gap_amount: number | null;
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/** Save a point-in-time snapshot of the user's profile and derived metrics. */
export async function saveSnapshot(
  userId: string,
  onboarding: OnboardingInput,
  result: FinancialResult,
): Promise<void> {
  const sb = await getSupabase();

  await sb.from("profile_snapshots").insert({
    user_id: userId,
    income: onboarding.income,
    savings: onboarding.savings,
    savings_rate: onboarding.savingsRate,
    country: onboarding.country,
    savings_mix: onboarding.savingsMix,
    income_stability: onboarding.incomeStability,
    mortgage_pressure: onboarding.mortgagePressure,
    primary_fear: onboarding.primaryFear ?? null,
    status: result.status,
    runway_months: result.financialMetrics.runway,
    gap_amount: result.financialMetrics.gap,
  });
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Fetch the most recent snapshot for a user. Returns null if none exists. */
export async function getLatestSnapshot(
  userId: string,
): Promise<SnapshotRow | null> {
  const sb = await getSupabase();

  const { data, error } = await sb
    .from("profile_snapshots")
    .select("*")
    .eq("user_id", userId)
    .order("taken_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Snapshot fetch failed: ${error.message}`);
  return data as SnapshotRow | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Human-readable label for how long ago a snapshot was taken. */
export function snapshotAgeLabel(takenAt: string): string {
  const ms = Date.now() - new Date(takenAt).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "1 week ago";
  if (weeks < 5) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 month ago";
  return `${months} months ago`;
}

/** Format a snapshot date as "Jan 2026". */
export function snapshotMonthLabel(takenAt: string): string {
  return new Date(takenAt).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}
