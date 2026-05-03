import type { DcaAllocation, ScheduledPurchase } from "./dca-types";

export interface ScheduleOptions {
  startFrom?: Date;
  months?: number;
  dayOfMonth?: number;
}

export function buildSchedule(
  allocation: DcaAllocation,
  monthly_amount: number,
  options: ScheduleOptions = {},
): ScheduledPurchase[] {
  const startFrom = options.startFrom ?? new Date();
  const months = options.months ?? 12;
  const dayOfMonth = options.dayOfMonth ?? 15;

  // Skip current month if its purchase day has already passed.
  const startMonthOffset = startFrom.getDate() < dayOfMonth ? 0 : 1;

  const out: ScheduledPurchase[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(
      startFrom.getFullYear(),
      startFrom.getMonth() + startMonthOffset + i,
      dayOfMonth,
    );
    const slices = allocation.slices.map((s) => ({
      ticker: s.ticker,
      amount: Math.round(monthly_amount * s.weight * 100) / 100,
    }));
    out.push({ date: d, total_amount: monthly_amount, slices });
  }
  return out;
}
