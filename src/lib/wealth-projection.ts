import type { FinancialInput } from "./engine";

export interface YearProjection {
  yearOffset: number;
  label: string;
  /** No-return baseline (cash accumulation only). */
  balance: number;
  /** With a conservative annual return applied to the invested portion. */
  balanceWithReturns: number;
}

/** Conservative annual return rate applied to the invested portion only. */
const CONSERVATIVE_ANNUAL_RETURN = 0.04;

/**
 * Savings accumulation with and without a conservative return on investments.
 * The "with returns" figure applies the return only to invested savings, not cash.
 * Both projections are illustrative only.
 */
export function projectSavingsYears(
  input: FinancialInput,
  years: number,
): YearProjection[] {
  const monthlySave = Math.max(
    0,
    input.monthly_income_estimate * input.monthly_savings_rate,
  );
  const annualSave = monthlySave * 12;
  const out: YearProjection[] = [];
  let balance = input.savings_total;
  let balanceWithReturns = input.savings_total;
  // Track invested portion separately for compounding.
  let investedBalance = input.investments_amount;
  const y0 = new Date().getFullYear();

  for (let y = 1; y <= years; y++) {
    balance += annualSave;

    // Compound the invested balance, then add new savings split by current mix.
    investedBalance *= 1 + CONSERVATIVE_ANNUAL_RETURN;
    const cashSave = annualSave * (1 - input.monthly_savings_rate);
    const investedSave = annualSave * input.monthly_savings_rate;
    investedBalance += investedSave;
    balanceWithReturns = input.cash_amount + cashSave * y + investedBalance;

    out.push({
      yearOffset: y,
      label: String(y0 + y),
      balance: Math.round(balance),
      balanceWithReturns: Math.round(balanceWithReturns),
    });
  }

  return out;
}
