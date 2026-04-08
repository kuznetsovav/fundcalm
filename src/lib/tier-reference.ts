/** USD-reference tier keys and midpoints (shared by engine + money scaling). */

export type IncomeRange =
  | "lt2k"
  | "2k-3k"
  | "3k-4k"
  | "4k-6k"
  | "6k-8k"
  | "8k-11k"
  | "11k-16k"
  | "gt16k";

export type SavingsRange =
  | "lt1k"
  | "1k-4k"
  | "4k-10k"
  | "10k-25k"
  | "25k-60k"
  | "60k-120k"
  | "120k-250k"
  | "250k-500k"
  | "gt500k";

export type CashRange = "lt1k" | "1k-5k" | "5k-15k" | "15k-40k" | "gt40k";

export const INCOME_MID: Record<IncomeRange, number> = {
  lt2k: 1_000,
  "2k-3k": 2_500,
  "3k-4k": 3_500,
  "4k-6k": 5_000,
  "6k-8k": 7_000,
  "8k-11k": 9_500,
  "11k-16k": 13_500,
  gt16k: 22_000,
};

export const SAVINGS_MID: Record<SavingsRange, number> = {
  lt1k: 500,
  "1k-4k": 2_500,
  "4k-10k": 7_000,
  "10k-25k": 17_500,
  "25k-60k": 42_500,
  "60k-120k": 90_000,
  "120k-250k": 185_000,
  "250k-500k": 375_000,
  gt500k: 700_000,
};

export const CASH_MID: Record<CashRange, number> = {
  lt1k: 500,
  "1k-5k": 3_000,
  "5k-15k": 10_000,
  "15k-40k": 27_500,
  gt40k: 55_000,
};

/** UI / engine iteration order (low → high). */
export const INCOME_TIER_ORDER = Object.keys(INCOME_MID) as IncomeRange[];

export const SAVINGS_TIER_ORDER = Object.keys(SAVINGS_MID) as SavingsRange[];

export type SavingsRateRange =
  | "r0"
  | "r2"
  | "r4"
  | "r6"
  | "r8"
  | "r10"
  | "r12"
  | "r15"
  | "r18"
  | "r22"
  | "r27"
  | "r32"
  | "r38p";

export const SAVINGS_RATE_ORDER: SavingsRateRange[] = [
  "r0",
  "r2",
  "r4",
  "r6",
  "r8",
  "r10",
  "r12",
  "r15",
  "r18",
  "r22",
  "r27",
  "r32",
  "r38p",
];

export const SAVINGS_RATE_MID: Record<SavingsRateRange, number> = {
  r0: 0,
  r2: 0.02,
  r4: 0.04,
  r6: 0.06,
  r8: 0.08,
  r10: 0.1,
  r12: 0.12,
  r15: 0.15,
  r18: 0.18,
  r22: 0.22,
  r27: 0.27,
  r32: 0.32,
  r38p: 0.38,
};
