import type { Diagnosis, PrimaryFear } from "./diagnosis-engine";
import type { IncomeStability } from "./engine";

export type RiskBucket = "conservative" | "balanced" | "growth";

export interface AssetSlice {
  ticker: string;
  weight: number;
}

export interface DcaAllocation {
  riskBucket: RiskBucket;
  slices: AssetSlice[];
  rationale: string;
}

export type AmountMode = "surplus" | "savings_rate" | "symbolic" | "deferred";

export interface SuggestedAmount {
  /** In the user's profile currency. Null when diagnosis says "focus elsewhere first". */
  monthly_amount: number | null;
  mode: AmountMode;
  rationale: string;
}

export interface DcaInput {
  monthly_income: number;
  monthly_savings_rate: number;
  cash_amount: number;
  required_cash: number;
  diagnosis: Diagnosis;
  primary_fear: PrimaryFear;
  incomeStability: IncomeStability;
}

export interface DcaPlan {
  allocation: DcaAllocation;
  amount: SuggestedAmount;
  fearNote: string;
}

export interface ScheduledPurchase {
  date: Date;
  total_amount: number;
  slices: { ticker: string; amount: number }[];
}
