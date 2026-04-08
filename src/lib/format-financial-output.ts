import type { Status } from "./engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FinancialAllocation {
  cash: number;
  investments: number;
}

/** Inputs match the decision engine outputs plus allocation breakdown. */
export interface FormatFinancialOutputInput {
  status: Status;
  runway_months: number;
  required_cash: number;
  gap: number;
  monthly_savings_rate: number;
  allocation: FinancialAllocation;
  /** Default USD; pass e.g. EUR for display symbol. */
  currencyCode?: string;
  locale?: string;
}

export interface FormattedFinancialOutput {
  /** Section 1 — one sentence */
  status: string;
  /** Section 2 — max 2 sentences */
  currentSituation: string;
  /** Section 3 — max 2 sentences */
  contextInsight: string;
  /** Section 4 — max 2 sentences */
  timeToSafety: string;
  /** Section 5 — one sentence */
  action: string;
}

export const FORMAT_SECTION_LABELS = {
  status: "Status",
  currentSituation: "Your situation",
  contextInsight: "What stands out",
  timeToSafety: "Time to a full buffer",
  action: "What to do",
} as const;

/** Map profile country label (from onboarding) to display currency. */
export function currencyLocaleForProfile(countryLabel: string): {
  currencyCode: string;
  locale: string;
} {
  const c = countryLabel.toLowerCase();
  if (c.includes("united states")) {
    return { currencyCode: "USD", locale: "en-US" };
  }
  if (c.includes("united kingdom")) {
    return { currencyCode: "GBP", locale: "en-GB" };
  }
  if (c.includes("germany")) {
    return { currencyCode: "EUR", locale: "de-DE" };
  }
  if (c.includes("france")) {
    return { currencyCode: "EUR", locale: "fr-FR" };
  }
  if (c.includes("europe")) {
    return { currencyCode: "EUR", locale: "en-GB" };
  }
  return { currencyCode: "USD", locale: "en-US" };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function fmtCurrency(
  amount: number,
  currencyCode: string,
  locale: string,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(Math.round(Math.abs(amount)));
}

function roundRunway(m: number): string {
  if (!Number.isFinite(m) || m < 0) return "0";
  const x = Math.round(m * 10) / 10;
  return x % 1 === 0 ? String(Math.round(x)) : String(x);
}

function investedShare(a: FinancialAllocation): number | undefined {
  const t = a.cash + a.investments;
  if (t <= 0) return undefined;
  return a.investments / t;
}

/** Implied monthly income from spending and savings rate (deterministic heuristic). */
function impliedMonthlyIncome(
  monthlyExpenses: number,
  savingsRate: number,
): number {
  const denom = clamp(1 - savingsRate, 0.12, 0.98);
  return monthlyExpenses / denom;
}

function monthsToCloseGap(
  gap: number,
  monthlyExpenses: number,
  savingsRate: number,
): number | null {
  if (gap <= 0) return 0;
  const income = impliedMonthlyIncome(monthlyExpenses, savingsRate);
  const monthlySave = income * savingsRate;
  if (monthlySave < 1) return null;
  return Math.ceil(gap / monthlySave);
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function sectionStatus(status: Status): string {
  switch (status) {
    case "critical":
      return "Cash on hand is very tight—steady small adds matter more than big moves.";
    case "risk":
      return "You're below a calm cash cushion, but steady steps close the gap.";
    case "warning":
      return "You're closer to a full buffer than it may feel—keep nudging cash upward.";
    case "ok":
      return "Your cash buffer looks solid for everyday bumps.";
    default:
      return "Your picture needs a quick refresh before we say more.";
  }
}

function sectionCurrentSituation(
  runway: number,
  requiredCash: number,
  gap: number,
  currencyCode: string,
  locale: string,
): string {
  const r = roundRunway(runway);
  const target = fmtCurrency(requiredCash, currencyCode, locale);
  if (gap <= 0) {
    const ahead = fmtCurrency(-gap, currencyCode, locale);
    return `You have about ${r} months of spending in cash. Your six-month target is ${target}, and you're about ${ahead} above that.`;
  }
  const shortBy = fmtCurrency(gap, currencyCode, locale);
  return `You have about ${r} months of spending in cash. The six-month target is ${target}, so you're about ${shortBy} short of that.`;
}

function sectionContextInsight(
  runway: number,
  allocation: FinancialAllocation,
): string {
  const share = investedShare(allocation);
  const heavyInvested = share !== undefined && share > 0.7;
  const lowRunway = runway < 3;
  const midRunway = runway >= 3 && runway < 6;

  if (lowRunway && heavyInvested) {
    return "Most of your savings sit outside cash, while your cash runway is short. That mix makes everyday surprises harder to ride out.";
  }
  if (lowRunway) {
    return "The main pressure is cash on hand—not enough months of spending parked where you can use it quickly.";
  }
  if (heavyInvested && midRunway) {
    return "A large share sits in investments while cash is still catching up. That's fine long term, but cash still needs room to grow.";
  }
  if (heavyInvested && runway >= 6) {
    return "You're heavy on invested savings and light on cash, but your cash runway already looks comfortable.";
  }
  return "Nothing here looks extreme—keep your rhythm and recheck after life or spending shifts.";
}

function sectionTimeToSafety(
  gap: number,
  requiredCash: number,
  savingsRate: number,
): string {
  if (gap <= 0) {
    return "You're already at or past the six-month cash goal—no countdown needed.";
  }

  const monthlyExpenses = requiredCash / 6;
  const months = monthsToCloseGap(gap, monthlyExpenses, savingsRate);

  if (months === null) {
    return "With the savings rate you shared, the path is slow unless you raise what you set aside each month.";
  }

  if (months <= 1) {
    return `At your current savings pace, you could reach the target in about a month.`;
  }
  if (months < 12) {
    return `At your current savings pace, you're roughly ${months} months from a full six-month cash buffer.`;
  }
  if (months < 36) {
    const years = Math.round(months / 12);
    return `At this pace, think in years—about ${years} year${years === 1 ? "" : "s"} to the full buffer unless you save more each month.`;
  }
  return "At this pace the buffer takes many years—bump the monthly amount if you want it sooner.";
}

function sectionAction(status: Status, gap: number): string {
  if (gap <= 0 && status === "ok") {
    return "Keep doing what you're doing—no need to force a change right now.";
  }
  if (gap <= 0) {
    return "Stay steady; optional extras can wait until your priorities shift.";
  }
  switch (status) {
    case "critical":
      return "Move a fixed amount into cash every month until everyday bills feel safe.";
    case "risk":
      return "Send new savings to cash first until you near six months of spending there.";
    case "warning":
      return "Keep adding to cash on schedule—you're close to a full buffer.";
    case "ok":
      return "Hold your course; revisit if spending or income shifts a lot.";
    default:
      return "Update your numbers, then pick one small monthly cash habit.";
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function formatFinancialDecisionOutput(
  input: FormatFinancialOutputInput,
): FormattedFinancialOutput {
  const currencyCode = input.currencyCode ?? "USD";
  const locale = input.locale ?? "en-US";
  const runway = Number.isFinite(input.runway_months)
    ? Math.max(0, input.runway_months)
    : 0;
  const required = Number.isFinite(input.required_cash)
    ? Math.max(0, input.required_cash)
    : 0;
  const gap = Number.isFinite(input.gap) ? input.gap : 0;
  const rate = clamp(
    Number.isFinite(input.monthly_savings_rate)
      ? input.monthly_savings_rate
      : 0,
    0,
    1,
  );

  const allocation = {
    cash: Math.max(0, input.allocation.cash),
    investments: Math.max(0, input.allocation.investments),
  };

  return {
    status: sectionStatus(input.status),
    currentSituation: sectionCurrentSituation(
      runway,
      required,
      gap,
      currencyCode,
      locale,
    ),
    contextInsight: sectionContextInsight(runway, allocation),
    timeToSafety: sectionTimeToSafety(gap, required, rate),
    action: sectionAction(input.status, gap),
  };
}

/** Flat text for logs or secondary consumers (e.g. AI context). */
export function formattedOutputToPlainText(o: FormattedFinancialOutput): string {
  return [
    `${FORMAT_SECTION_LABELS.status}: ${o.status}`,
    `${FORMAT_SECTION_LABELS.currentSituation}: ${o.currentSituation}`,
    `${FORMAT_SECTION_LABELS.contextInsight}: ${o.contextInsight}`,
    `${FORMAT_SECTION_LABELS.timeToSafety}: ${o.timeToSafety}`,
    `${FORMAT_SECTION_LABELS.action}: ${o.action}`,
  ].join("\n");
}
