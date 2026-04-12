/**
 * Staleness: confidence decay, drift estimation, and contextual banner logic.
 *
 * When profile data ages, the diagnosis becomes less reliable. These utilities:
 *  - Compute how old the data is and what confidence penalty to apply
 *  - Estimate how much the user has probably saved since their last update
 *  - Pick the most motivating banner message for the dashboard
 */

import type { FinancialInput, ConfidenceResult, Status } from "./engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StalenessLevel = "fresh" | "aging" | "stale" | "very_stale";

export interface StalenessInfo {
  level: StalenessLevel;
  daysOld: number;
  /** Fractional months elapsed since last update. */
  monthsElapsed: number;
  /** Human-readable age label, e.g. "2 months old". */
  label: string;
}

export interface DriftEstimate {
  /** Monthly amount being saved (income × rate). */
  estimatedMonthlySaving: number;
  /** Total estimated savings added since last update. */
  estimatedAddedSavings: number;
  projectedSavingsTotal: number;
  projectedCashAmount: number;
  projectedRunwayMonths: number;
  /** True when the estimate is large enough to be worth showing. */
  meaningful: boolean;
}

export interface BannerContent {
  message: string;
  sub?: string;
  buttonLabel: string;
  /** Controls visual weight of the banner. */
  variant: "default" | "highlight" | "urgent";
}

// ---------------------------------------------------------------------------
// Staleness computation
// ---------------------------------------------------------------------------

function ageLabel(daysOld: number): string {
  if (daysOld < 7)  return "a few days old";
  if (daysOld < 30) return `${Math.round(daysOld / 7)} week${Math.round(daysOld / 7) === 1 ? "" : "s"} old`;
  const months = Math.round(daysOld / 30);
  return `${months} month${months === 1 ? "" : "s"} old`;
}

export function computeStaleness(updatedAt: string): StalenessInfo {
  const ms = Date.now() - new Date(updatedAt).getTime();
  const daysOld = Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
  const monthsElapsed = daysOld / 30;

  let level: StalenessLevel;
  if (daysOld < 45)  level = "fresh";
  else if (daysOld < 90)  level = "aging";
  else if (daysOld < 180) level = "stale";
  else level = "very_stale";

  return { level, daysOld, monthsElapsed, label: ageLabel(daysOld) };
}

// ---------------------------------------------------------------------------
// Confidence penalty
// ---------------------------------------------------------------------------

const CONFIDENCE_ORDER = ["low", "medium", "high"] as const;

const STALENESS_PENALTY: Record<StalenessLevel, 0 | 1 | 2> = {
  fresh:      0,
  aging:      1,
  stale:      2,
  very_stale: 2,
};

export function applyStalenessPenalty(
  original: ConfidenceResult,
  staleness: StalenessInfo,
): ConfidenceResult {
  const penalty = STALENESS_PENALTY[staleness.level];
  if (penalty === 0) return original;

  const idx = CONFIDENCE_ORDER.indexOf(original.level);
  const newLevel = CONFIDENCE_ORDER[Math.max(0, idx - penalty)];

  const reason =
    staleness.level === "stale" || staleness.level === "very_stale"
      ? `Numbers are ${staleness.label} — this read may be out of date. Update for a fresh diagnosis.`
      : `${original.reason} Figures are ${staleness.label} — a quick update would sharpen this.`;

  return { level: newLevel, reason };
}

// ---------------------------------------------------------------------------
// Drift estimation
// ---------------------------------------------------------------------------

export function estimateDrift(
  input: FinancialInput,
  monthsElapsed: number,
): DriftEstimate {
  const estimatedMonthlySaving =
    input.monthly_income_estimate * input.monthly_savings_rate;

  const estimatedAddedSavings = estimatedMonthlySaving * monthsElapsed;

  const cashRatio =
    input.savings_total > 0
      ? input.cash_amount / input.savings_total
      : 0.5;

  const projectedSavingsTotal = input.savings_total + estimatedAddedSavings;
  const projectedCashAmount   = projectedSavingsTotal * cashRatio;
  const projectedRunwayMonths =
    input.monthly_expenses > 0
      ? projectedCashAmount / input.monthly_expenses
      : 0;

  // Only meaningful if the user is actively saving and at least a month has passed.
  const meaningful =
    monthsElapsed >= 1 &&
    estimatedMonthlySaving > 0 &&
    input.monthly_savings_rate > 0;

  return {
    estimatedMonthlySaving,
    estimatedAddedSavings,
    projectedSavingsTotal,
    projectedCashAmount,
    projectedRunwayMonths,
    meaningful,
  };
}

// ---------------------------------------------------------------------------
// Banner content
// ---------------------------------------------------------------------------

function fmtAmount(n: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

export interface BannerParams {
  staleness: StalenessInfo;
  drift: DriftEstimate;
  status: Status;
  currentRunwayMonths: number;
  targetRunwayMonths: number;
  currency: string;
  locale: string;
  /** Formatted month label of last snapshot, e.g. "Jan 2026". */
  lastCheckinLabel?: string;
}

export function computeBannerContent(p: BannerParams): BannerContent {
  const {
    staleness, drift, status, currentRunwayMonths,
    targetRunwayMonths, currency, locale, lastCheckinLabel,
  } = p;

  const hasGap    = currentRunwayMonths < targetRunwayMonths;
  const gapMonths = targetRunwayMonths - currentRunwayMonths;
  const isAtRisk  = status === "risk" || status === "critical";
  const dataIsOld = staleness.daysOld > 30;

  // 1. Risk/critical status with old data — emphasise urgency of fresh numbers.
  if (isAtRisk && dataIsOld) {
    return {
      message: "Your situation needs fresh numbers to be useful.",
      sub:     `Data is ${staleness.label}. A 60-second update gives you an accurate read.`,
      buttonLabel: "Update now",
      variant: "urgent",
    };
  }

  // 2. Drift would carry the user across their target — celebrate & prompt.
  if (
    drift.meaningful &&
    hasGap &&
    drift.projectedRunwayMonths >= targetRunwayMonths
  ) {
    return {
      message: `Based on your savings rate, you may have crossed your ${Math.round(targetRunwayMonths)}-month target.`,
      sub:     "Update to confirm — this is a milestone worth seeing.",
      buttonLabel: "Confirm my numbers",
      variant: "highlight",
    };
  }

  // 3. User is within 1.5 months of their target.
  if (hasGap && gapMonths < 1.5 && drift.meaningful) {
    return {
      message: `You're probably within ${gapMonths < 0.75 ? "a few weeks" : "about a month"} of your ${Math.round(targetRunwayMonths)}-month target.`,
      sub:     "Update to see if you've crossed it.",
      buttonLabel: "Update to confirm",
      variant: "highlight",
    };
  }

  // 4. Meaningful drift — show estimated savings added.
  if (drift.meaningful && dataIsOld) {
    const added    = fmtAmount(drift.estimatedAddedSavings, currency, locale);
    const sinceStr = lastCheckinLabel ?? `${Math.round(staleness.monthsElapsed)} months ago`;
    const projRunway = Math.round(drift.projectedRunwayMonths * 10) / 10;
    return {
      message: `Based on your savings rate, you've probably added ~${added} since ${sinceStr}.`,
      sub:     `Your runway may now be around ${projRunway} months. Update to confirm.`,
      buttonLabel: "Update to confirm",
      variant: "default",
    };
  }

  // 5. Very stale (90+ days).
  if (staleness.level === "stale" || staleness.level === "very_stale") {
    const months = Math.round(staleness.daysOld / 30);
    return {
      message: `A ${months >= 3 ? "quarter" : `couple of months`} has passed — enough time for things to shift.`,
      sub:     "Keep your read accurate with a quick update.",
      buttonLabel: "Update my numbers",
      variant: "default",
    };
  }

  // 6. Aging (45–89 days).
  if (staleness.level === "aging") {
    return {
      message: `Your numbers are ${staleness.label}.`,
      sub:     "A quick update keeps the read accurate.",
      buttonLabel: "Update my numbers",
      variant: "default",
    };
  }

  // 7. Fresh — show last check-in date or generic prompt.
  return {
    message: lastCheckinLabel
      ? `Last check-in: ${lastCheckinLabel}`
      : "Keep your numbers up to date for an accurate read.",
    buttonLabel: "Update numbers",
    variant: "default",
  };
}
