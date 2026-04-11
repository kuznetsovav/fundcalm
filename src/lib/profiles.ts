import { getSupabase } from "./supabase";
import { countryMeta } from "./countries";
import {
  cashAmountToNearestRangeForCurrency,
  savingsTierMid,
} from "./money-tiers";
import {
  coerceIncomeRange,
  coerceIncomeStability,
  coerceMortgagePressure,
  coerceSavingsRateRange,
  coerceSavingsRange,
} from "./onboarding-legacy";
import {
  splitSavingsByMix,
  inferSavingsMixFromLegacy,
  coercePrimaryFear,
  type IncomeRange,
  type SavingsRange,
  type SavingsRateRange,
  type SavingsMix,
  type IncomeStability,
  type DebtPressure,
  type MortgagePressure,
  type CashRange,
  type OnboardingInput,
} from "./engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProfileInput {
  income: IncomeRange;
  savings: SavingsRange;
  savingsRate: SavingsRateRange;
  country: string;
  savingsMix: SavingsMix;
  incomeStability: IncomeStability;
  mortgagePressure: MortgagePressure;
  primaryFear?: string;
  email?: string;
}

export interface ProfileRow {
  id: string;
  user_id: string;
  income: IncomeRange;
  savings: SavingsRange;
  has_investments: boolean;
  horizon: string;
  cash: string | null;
  expenses: string | null;
  savings_rate: SavingsRateRange | null;
  country: string | null;
  savings_mix: SavingsMix | null;
  income_stability: IncomeStability | null;
  debt_pressure: DebtPressure | null;
  mortgage_pressure: MortgagePressure | null;
  primary_fear: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRow {
  id: string;
  email: string | null;
  created_at: string;
}

function debtToMortgageFallback(d: DebtPressure | null): MortgagePressure {
  switch (d) {
    case "heavy":
      return "housing_heavy";
    case "moderate":
      return "housing_tight";
    case "light":
      return "housing_ok";
    default:
      return "housing_clear";
  }
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function saveUserProfile(
  input: ProfileInput,
  userId?: string,
): Promise<{ userId: string; profileId: string }> {
  const sb = await getSupabase();

  let uid = userId;

  if (uid) {
    const { error } = await sb
      .from("users")
      .upsert({ id: uid, email: input.email ?? null }, { onConflict: "id" });
    if (error) throw new Error(`User upsert failed: ${error.message}`);
  } else {
    const row: Record<string, unknown> = {};
    if (input.email) row.email = input.email;

    const { data, error } = await sb
      .from("users")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(`User insert failed: ${error.message}`);
    uid = data.id as string;
  }

  const currency = countryMeta(input.country).currency;
  const total = savingsTierMid(currency, input.savings);
  const { cash_amount, hasInvestments } = splitSavingsByMix(
    total,
    input.savingsMix,
  );
  const cashTier = hasInvestments
    ? cashAmountToNearestRangeForCurrency(currency, cash_amount)
    : null;

  const { data: profile, error: profileErr } = await sb
    .from("financial_profiles")
    .upsert(
      {
        user_id: uid,
        income: input.income,
        savings: input.savings,
        has_investments: hasInvestments,
        horizon: "long",
        cash: cashTier,
        savings_rate: input.savingsRate,
        country: input.country,
        savings_mix: input.savingsMix,
        income_stability: input.incomeStability,
        mortgage_pressure: input.mortgagePressure,
        primary_fear: input.primaryFear ?? null,
      },
      { onConflict: "user_id" },
    )
    .select("id")
    .single();

  if (profileErr) {
    throw new Error(`Profile upsert failed: ${profileErr.message}`);
  }

  return { userId: uid, profileId: profile.id as string };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getUserProfile(
  userId: string,
): Promise<ProfileRow | null> {
  const sb = await getSupabase();

  const { data, error } = await sb
    .from("financial_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Profile fetch failed: ${error.message}`);
  return data as ProfileRow | null;
}

// ---------------------------------------------------------------------------
// Row → engine onboarding shape
// ---------------------------------------------------------------------------

export function profileToOnboardingInput(row: ProfileRow): OnboardingInput {
  const savingsMix: SavingsMix =
    row.savings_mix ??
    inferSavingsMixFromLegacy(
      coerceSavingsRange(String(row.savings)) ??
        ("10k-25k" as SavingsRange),
      (row.cash as CashRange | null) ?? "1k-5k",
      row.has_investments,
      row.country ?? "OTHER",
    );

  const coercedMortgage = row.mortgage_pressure
    ? coerceMortgagePressure(String(row.mortgage_pressure))
    : null;
  const mortgagePressure: MortgagePressure =
    coercedMortgage ?? debtToMortgageFallback(row.debt_pressure);

  const income =
    coerceIncomeRange(String(row.income)) ?? ("4k-6k" as IncomeRange);
  const savings =
    coerceSavingsRange(String(row.savings)) ?? ("10k-25k" as SavingsRange);
  const savingsRate =
    coerceSavingsRateRange(String(row.savings_rate ?? "")) ?? "r10";
  const incomeStability =
    coerceIncomeStability(String(row.income_stability ?? "")) ?? "steady";

  const primaryFear = coercePrimaryFear
    ? coercePrimaryFear(String(row.primary_fear ?? ""))
    : undefined;

  return {
    income,
    savings,
    savingsRate,
    country: row.country ?? "OTHER",
    savingsMix,
    incomeStability,
    mortgagePressure,
    ...(primaryFear ? { primaryFear } : {}),
  };
}

// ---------------------------------------------------------------------------
// User helpers
// ---------------------------------------------------------------------------

/** Fetch user row (for email lookup). */
export async function getUserEmail(userId: string): Promise<string | null> {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from("users")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  if (error) return null;
  return (data as { email: string | null } | null)?.email ?? null;
}
