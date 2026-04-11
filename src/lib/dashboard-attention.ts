import type { FinancialInput, FinancialMetrics, FinancialResult } from "./engine";

export function dashboardNeedsAttention(result: FinancialResult): boolean {
  return result.status !== "ok";
}

/** One-line reassurance when status is comfortable. */
export function dashboardComfortNarrative(
  input: FinancialInput,
  metrics: FinancialMetrics,
  fmtMoney: (n: number) => string,
): string {
  const runway = Math.round(metrics.runway * 10) / 10;
  const targetMonths = Math.round(metrics.required_cash / input.monthly_expenses);
  return `Liquid cash is about ${fmtMoney(input.cash_amount)} — roughly ${runway} months of runway at ${fmtMoney(input.monthly_expenses)} in estimated spending. Your ${targetMonths}-month cushion target at that spending is about ${fmtMoney(metrics.required_cash)}.`;
}

/**
 * Short copy with the user's own cash, spending, runway, and cushion target.
 */
export function dashboardSituationNarrative(
  input: FinancialInput,
  metrics: FinancialMetrics,
  fmtMoney: (n: number) => string,
): string {
  const runway = Math.round(metrics.runway * 10) / 10;
  const gap = metrics.gap;
  const targetMonths = Math.round(metrics.required_cash / input.monthly_expenses);
  const gapClause =
    gap > 0
      ? `That is about ${fmtMoney(gap)} short of your ${targetMonths}-month cash cushion at your estimated spending.`
      : gap < 0
        ? `You are about ${fmtMoney(-gap)} above your ${targetMonths}-month cash cushion at your estimated spending.`
        : `You are approximately at your ${targetMonths}-month cash cushion for your estimated spending.`;
  return `You have about ${fmtMoney(input.cash_amount)} in liquid cash. With typical monthly spending near ${fmtMoney(input.monthly_expenses)}, that is roughly ${runway} months of runway. A ${targetMonths}-month reserve at that spending level would be about ${fmtMoney(metrics.required_cash)}. ${gapClause}`;
}

export type SituationCompareRow = {
  label: string;
  current: string;
  target: string;
};

/** Side-by-side "today" vs "target liquidity" for attention states. */
export function dashboardCurrentVsTargetRows(
  input: FinancialInput,
  metrics: FinancialMetrics,
  fmtMoney: (n: number) => string,
): SituationCompareRow[] {
  const runway = Math.round(metrics.runway * 10) / 10;
  const targetMonths = Math.round(metrics.required_cash / input.monthly_expenses);
  return [
    {
      label: "Liquid cash (usable soon)",
      current: fmtMoney(input.cash_amount),
      target: fmtMoney(metrics.required_cash),
    },
    {
      label: "Runway (months of spending in cash)",
      current: `${runway} mo`,
      target: `${targetMonths} mo`,
    },
    {
      label: "Estimated monthly spending",
      current: fmtMoney(input.monthly_expenses),
      target: fmtMoney(input.monthly_expenses),
    },
    {
      label: `Gap vs ${targetMonths}-month cash target`,
      current: metrics.gap > 0 ? fmtMoney(metrics.gap) + " below" : metrics.gap < 0 ? fmtMoney(-metrics.gap) + " above" : "On target",
      target: "0 (fully cushioned)",
    },
  ];
}
