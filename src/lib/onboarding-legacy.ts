import type {
  IncomeRange,
  SavingsRange,
  SavingsRateRange,
} from "./tier-reference";
import {
  INCOME_TIER_ORDER,
  SAVINGS_RATE_ORDER,
  SAVINGS_TIER_ORDER,
} from "./tier-reference";
import type { IncomeStability, MortgagePressure } from "./engine";

const NEW_INCOME = new Set<string>(INCOME_TIER_ORDER);
const NEW_SAVINGS = new Set<string>(SAVINGS_TIER_ORDER);
const NEW_RATE = new Set<string>(SAVINGS_RATE_ORDER);

/** Pre-granular income keys → closest new tier. */
const LEGACY_INCOME: Record<string, IncomeRange> = {
  lt3k: "2k-3k",
  "3k-5k": "4k-6k",
  "5k-10k": "8k-11k",
  gt10k: "gt16k",
};

const LEGACY_SAVINGS: Record<string, SavingsRange> = {
  "1k-5k": "1k-4k",
  "5k-20k": "10k-25k",
  "20k-50k": "25k-60k",
  gt50k: "gt500k",
};

const LEGACY_SAVINGS_RATE: Record<string, SavingsRateRange> = {
  lt5: "r4",
  "5-15": "r10",
  "15-25": "r18",
  gt25: "r32",
};

const LEGACY_MORTGAGE: Record<string, MortgagePressure> = {
  rent_no_mortgage: "housing_clear",
  own_no_mortgage: "housing_clear",
  mortgage_comfortable: "housing_ok",
  mortgage_noticeable: "housing_tight",
  mortgage_heavy: "housing_heavy",
};

export function coerceIncomeRange(raw: string): IncomeRange | null {
  if (NEW_INCOME.has(raw)) return raw as IncomeRange;
  return LEGACY_INCOME[raw] ?? null;
}

export function coerceSavingsRange(raw: string): SavingsRange | null {
  if (NEW_SAVINGS.has(raw)) return raw as SavingsRange;
  return LEGACY_SAVINGS[raw] ?? null;
}

export function coerceSavingsRateRange(raw: string): SavingsRateRange | null {
  if (NEW_RATE.has(raw)) return raw as SavingsRateRange;
  return LEGACY_SAVINGS_RATE[raw] ?? null;
}

const NEW_MORTGAGE = new Set<string>([
  "housing_clear",
  "housing_ok",
  "housing_tight",
  "housing_heavy",
]);

export function coerceMortgagePressure(raw: string): MortgagePressure | null {
  if (NEW_MORTGAGE.has(raw)) return raw as MortgagePressure;
  return LEGACY_MORTGAGE[raw] ?? null;
}

export function coerceIncomeStability(raw: string): IncomeStability | null {
  const allowed = new Set<string>([
    "steady",
    "variable_flat",
    "variable_improving",
    "variable_worsening",
    "irregular",
  ]);
  if (allowed.has(raw)) return raw as IncomeStability;
  return null;
}
