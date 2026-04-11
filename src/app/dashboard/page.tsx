import Link from "next/link";
import {
  getFinancialStatus,
  fromOnboarding,
  inferSavingsMixFromLegacy,
  coercePrimaryFear,
  Diagnosis,
  type FinancialInput,
  type FinancialResult,
  type OnboardingInput,
  type CashRange,
  type SavingsMix,
  type MortgagePressure,
  type Status,
  type FinancialMetrics,
} from "@/lib/engine";
import { getUserProfile, profileToOnboardingInput } from "@/lib/profiles";
import { getLatestSnapshot, snapshotMonthLabel, type SnapshotRow } from "@/lib/snapshots";
import { financialResultToContextText } from "@/lib/explain";
import {
  financialEstimatesForDisplay,
  onboardingAnswersForDisplay,
  suggestionsForDisplay,
} from "@/lib/onboarding-display";
import {
  dashboardComfortNarrative,
  dashboardCurrentVsTargetRows,
  dashboardNeedsAttention,
  dashboardSituationNarrative,
} from "@/lib/dashboard-attention";
import CollapsibleSection from "./collapsible-section";
import { currencyLocaleFromCountryCode } from "@/lib/money-tiers";
import {
  economicOverviewForCountry,
  illustrativeInflationRate,
} from "@/lib/economic-context";
import { projectSavingsYears } from "@/lib/wealth-projection";
import { VALID_COUNTRY_CODES } from "@/lib/countries";
import {
  coerceIncomeRange,
  coerceIncomeStability,
  coerceMortgagePressure,
  coerceSavingsRateRange,
  coerceSavingsRange,
} from "@/lib/onboarding-legacy";
import Explanation from "./explanation";
import EditableProfileRows from "./editable-profile-rows";

export const metadata = { title: "Your clarity — FundCalm" };

const FEAR_LABEL: Record<string, string> = {
  income_loss: "Worried about income stopping or dropping",
  market_crash: "Worried about a big drop in invested savings",
  making_mistake: "Worried about doing the wrong thing with money",
  missing_opportunities: "Worried about missing growth opportunities",
};

/** Extra fear-specific bullets that expand the "Given your main worry" section. */
function fearExtraBullets(
  fear: string,
  aboveTarget: boolean,
  hasInvestments: boolean,
): string[] {
  if (fear === "income_loss") {
    return [
      `Your cash runway is the first line of defence if income drops — ${aboveTarget ? "you're above your target buffer, which means you have meaningful breathing room." : "building it toward your target is the most direct thing you can do for this worry."}`,
      "A buffer equal to your target months of expenses means you can handle a gap without touching investments or taking on debt.",
      "If income varies, keeping the buffer a little above target gives extra margin during slow patches.",
    ];
  }
  if (fear === "market_crash") {
    return [
      hasInvestments
        ? "A market drop affects your invested portion — your cash buffer is what keeps daily life funded without forcing you to sell at a bad time."
        : "With little or no investments, a market crash affects you less directly — your main risk is inflation eroding the purchasing power of your cash.",
      aboveTarget
        ? "With your cash above target, you have a solid cushion before any invested savings would need to be touched."
        : "A thin cash layer means a market drop could put pressure on you to sell investments at the worst moment — the buffer is your protection.",
      "Cash and investments serve different jobs: cash for near-term spending, investments for long-run growth — keeping them separate mentally reduces panic decisions.",
    ];
  }
  if (fear === "making_mistake") {
    return [
      "The most common mistake is acting impulsively — either moving too much money at once or freezing and doing nothing.",
      aboveTarget
        ? "Your numbers look reasonably structured — your job right now is to stay the course rather than overhaul."
        : "The clearest next step is building cash toward your target — it's simple, reversible, and hard to get wrong.",
      "Checking the same dashboard every week and worrying about small changes is often more damaging than the underlying numbers — steady habits matter more than timing.",
    ];
  }
  // missing_opportunities
  return [
    aboveTarget
      ? "With your buffer in place, you're in a good position to think about longer-term growth — but only for money you genuinely don't need for years."
      : "The first opportunity to act on is building the cash buffer — a gap here creates real opportunity cost (forced sales, stress decisions) that outweighs potential investment gains.",
    "Opportunity cost cuts both ways: money sitting in excess cash after the buffer is full is giving up potential growth; money invested before the buffer is full is giving up stability.",
    "Small, regular additions to longer-term savings (once the buffer is solid) capture compound growth without requiring perfect timing.",
  ];
}

const DIAGNOSIS_LABEL: Record<Diagnosis, string> = {
  [Diagnosis.CriticalBuffer]: "Critical buffer",
  [Diagnosis.InsufficientBuffer]: "Insufficient buffer",
  [Diagnosis.LimitedBuffer]: "Limited buffer",
  [Diagnosis.Overinvested]: "Cash runway vs invested savings",
  [Diagnosis.TooConservative]: "Heavy on cash",
  [Diagnosis.BalancedButIdle]: "Strong cushion, light long-term savings",
  [Diagnosis.Healthy]: "Balanced",
};

const VALID_CASH = new Set<string>([
  "lt1k",
  "1k-5k",
  "5k-15k",
  "15k-40k",
  "gt40k",
]);
const VALID_SAVINGS_MIX = new Set<string>([
  "all_cash",
  "mostly_cash",
  "balanced",
  "mostly_invested",
  "almost_all_invested",
]);
const VALID_MORTGAGE = new Set<string>([
  "rent_no_mortgage",
  "own_no_mortgage",
  "mortgage_comfortable",
  "mortgage_noticeable",
  "mortgage_heavy",
  "housing_clear",
  "housing_ok",
  "housing_tight",
  "housing_heavy",
]);

const VALID_DEBT_LEGACY = new Set<string>([
  "none",
  "light",
  "moderate",
  "heavy",
]);

function parseMortgageFromParams(
  sp: Record<string, string | string[] | undefined>,
): MortgagePressure {
  const m = String(sp.mortgage ?? "");
  const coerced = coerceMortgagePressure(m);
  if (coerced) return coerced;
  if (VALID_MORTGAGE.has(m)) return m as MortgagePressure;
  const d = String(sp.debtPressure ?? "");
  if (VALID_DEBT_LEGACY.has(d)) {
    if (d === "heavy") return "housing_heavy";
    if (d === "moderate") return "housing_tight";
    if (d === "light") return "housing_ok";
    return "housing_clear";
  }
  return "housing_clear";
}

function parseOnboarding(
  sp: Record<string, string | string[] | undefined>,
): OnboardingInput | null {
  const incomeRaw = String(sp.income ?? "");
  const savingsRaw = String(sp.savings ?? "");
  const savingsRateRaw = String(sp.savingsRate ?? "");
  const country = String(sp.country ?? "");
  const savingsMixRaw = String(sp.savingsMix ?? "");
  const incomeStabilityRaw = String(sp.incomeStability ?? "");

  const income = coerceIncomeRange(incomeRaw);
  const savings = coerceSavingsRange(savingsRaw);
  const savingsRate = coerceSavingsRateRange(savingsRateRaw);

  if (
    !income ||
    !savings ||
    !savingsRate ||
    !VALID_COUNTRY_CODES.has(country)
  ) {
    return null;
  }

  const mortgagePressure = parseMortgageFromParams(sp);
  const fearRaw = String(sp.primaryFear ?? sp.fear ?? "");
  const coercedFear = coercePrimaryFear(fearRaw);

  if (
    VALID_SAVINGS_MIX.has(savingsMixRaw) &&
    coerceIncomeStability(incomeStabilityRaw)
  ) {
    return {
      income,
      savings,
      savingsRate,
      country,
      savingsMix: savingsMixRaw as SavingsMix,
      incomeStability: coerceIncomeStability(incomeStabilityRaw)!,
      mortgagePressure,
      ...(coercedFear ? { primaryFear: coercedFear } : {}),
    };
  }

  const hasInv = String(sp.hasInvestments ?? "");
  const cash = String(sp.cash ?? "");
  if (
    !["yes", "no"].includes(hasInv) ||
    (hasInv === "yes" && !VALID_CASH.has(cash))
  ) {
    return null;
  }

  const hasInvestments = hasInv === "yes";
  const cashRange = (hasInvestments ? cash : "1k-5k") as CashRange;
  const savingsMix = inferSavingsMixFromLegacy(
    savings,
    cashRange,
    hasInvestments,
    country,
  );

  return {
    income,
    savings,
    savingsRate,
    country,
    savingsMix,
    incomeStability: "steady",
    mortgagePressure,
    ...(coercedFear ? { primaryFear: coercedFear } : {}),
  };
}

/** Avoid hanging SSR when Supabase is slow or unreachable. */
function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: T): Promise<T> {
  return new Promise((resolve) => {
    const id = setTimeout(() => resolve(onTimeout), ms);
    promise
      .then((v) => {
        clearTimeout(id);
        resolve(v);
      })
      .catch(() => {
        clearTimeout(id);
        resolve(onTimeout);
      });
  });
}

async function resolveDashboardData(
  sp: Record<string, string | string[] | undefined>,
): Promise<{
  onboarding: OnboardingInput;
  financial: FinancialInput;
  userId?: string;
  snapshot?: SnapshotRow | null;
} | null> {
  const userId = typeof sp.user === "string" ? sp.user : undefined;
  if (userId) {
    try {
      const [row, snapshot] = await Promise.all([
        withTimeout(getUserProfile(userId), 5_000, null),
        withTimeout(getLatestSnapshot(userId), 3_000, null),
      ]);
      if (row) {
        const onboarding = profileToOnboardingInput(row);
        return { onboarding, financial: fromOnboarding(onboarding), userId, snapshot };
      }
    } catch {
      // Supabase unavailable — fall through
    }
  }

  const onboarding = parseOnboarding(sp);
  if (!onboarding) return null;
  return { onboarding, financial: fromOnboarding(onboarding) };
}

function fmtCurrency(n: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Math.round(Math.abs(n)));
}

/**
 * Illustrative buffer math: assumes monthly savings could go to cash; same spending.
 * Months to close gap = ceil(gap / savePerMonth); second line uses projected cash.
 */
function projectionBullets(
  input: Pick<FinancialInput, "cash_amount" | "monthly_expenses">,
  savePerMonth: number,
  metrics: FinancialMetrics,
): string[] {
  if (savePerMonth <= 0) {
    return [
      "When you can, even a small monthly amount accelerates how fast your buffer grows.",
    ];
  }
  if (metrics.gap <= 0) {
    const targetMonths = input.monthly_expenses > 0
      ? Math.round(metrics.required_cash / input.monthly_expenses)
      : 6;
    return [
      `${Math.round(metrics.runway * 10) / 10} months in cash — on track for the ${targetMonths}-month target.`,
    ];
  }
  const monthsToClose = Math.ceil(metrics.gap / savePerMonth);
  const capped = Math.min(Math.max(monthsToClose, 1), 120);
  const projectedCash = input.cash_amount + savePerMonth * capped;
  const projectedRunway =
    input.monthly_expenses > 0
      ? Math.round((projectedCash / input.monthly_expenses) * 10) / 10
      : 0;

  const first = `${capped} month${capped === 1 ? "" : "s"} at this pace to close the gap`;

  if (capped === 120 && projectedCash < metrics.required_cash) {
    return [
      first,
      "At this pace, cash could still sit below your target cushion after ten years—worth revisiting income, spending, or how much you can save.",
    ];
  }

  return [
    first,
    `After that stretch, cash runway would be about ${projectedRunway} months at the same spending, if that monthly savings went to cash.`,
  ];
}

const STATUS_HERO: Record<
  Status,
  { badge: string; border: string; bg: string; badgeClass: string }
> = {
  ok: {
    badge: "Comfortable",
    border: "border border-emerald-200",
    bg: "bg-emerald-50/50",
    badgeClass: "bg-emerald-600",
  },
  warning: {
    badge: "Limited",
    border: "border-2 border-amber-400",
    bg: "bg-white",
    badgeClass: "bg-amber-500",
  },
  risk: {
    badge: "Attention",
    border: "border-2 border-amber-500",
    bg: "bg-white",
    badgeClass: "bg-amber-600",
  },
  critical: {
    badge: "Urgent",
    border: "border-2 border-red-400",
    bg: "bg-red-50/30",
    badgeClass: "bg-red-600",
  },
};

function EmptyState() {
  return (
    <div className="fc-surface mt-10 px-6 py-12 text-center">
      <p className="text-lg font-semibold text-slate-900">No profile yet</p>
      <p className="mt-2 text-sm text-slate-500">
        A few questions—about two minutes.
      </p>
      <Link href="/onboarding" className="fc-btn-primary mt-8">
        Get started
      </Link>
    </div>
  );
}

function DeltaBadge({ current, previous, label }: {
  current: number;
  previous: number;
  label: string;
}) {
  const diff = Math.round((current - previous) * 10) / 10;
  if (Math.abs(diff) < 0.1) return null;
  const up = diff > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${up ? "text-emerald-700" : "text-red-600"}`}>
      <span>{up ? "↑" : "↓"}</span>
      <span>{up ? "+" : ""}{diff} {label} since {label === "months" ? "" : ""}</span>
    </span>
  );
}

function CheckinBanner({ userId, snapshot, checkinJustDone }: {
  userId: string;
  snapshot?: SnapshotRow | null;
  checkinJustDone?: boolean;
}) {
  if (checkinJustDone) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Numbers updated. Your dashboard has been recalculated.
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3">
      <p className="text-xs text-slate-500">
        {snapshot
          ? `Last check-in: ${snapshotMonthLabel(snapshot.taken_at)}`
          : "Keep your numbers up to date for an accurate read."}
      </p>
      <Link
        href={`/checkin?user=${userId}`}
        className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
      >
        Update numbers
      </Link>
    </div>
  );
}

function ClarityView({
  result,
  input,
  onboarding,
  countryCode,
  suggestionLines,
  explainContext,
  editableParams,
  userId,
  snapshot,
  checkinJustDone,
}: {
  result: FinancialResult;
  input: FinancialInput;
  onboarding: OnboardingInput;
  countryCode: string;
  suggestionLines: string[];
  explainContext?: string;
  /** Raw URL param values for building inline-edit navigation URLs. */
  editableParams: Record<string, string>;
  userId?: string;
  snapshot?: SnapshotRow | null;
  checkinJustDone?: boolean;
}) {
  const { currency, locale } = currencyLocaleFromCountryCode(countryCode);
  const m = result.financialMetrics;
  const macro = economicOverviewForCountry(countryCode);
  const inflationRate = illustrativeInflationRate(countryCode);
  const yearProjections = projectSavingsYears(input, 5, inflationRate);
  const hero = STATUS_HERO[result.status];
  const savePerMonth = input.monthly_income_estimate * input.monthly_savings_rate;
  const projLines = projectionBullets(input, savePerMonth, m);
  const fmt = (n: number) => fmtCurrency(n, currency, locale);

  const needsAttention = dashboardNeedsAttention(result);
  const urgentLead = needsAttention
    ? (suggestionLines[0] ?? result.action)
    : null;
  const furtherActions = (
    needsAttention ? suggestionLines.slice(1) : suggestionLines
  ).slice(0, 6);

  const situationNarrative = needsAttention
    ? dashboardSituationNarrative(input, m, fmt)
    : dashboardComfortNarrative(input, m, fmt);
  const compareRows = dashboardCurrentVsTargetRows(input, m, fmt);
  const profileRows = onboardingAnswersForDisplay(onboarding);
  const estimateRows = financialEstimatesForDisplay(input, m);

  const runwayDiff = snapshot?.runway_months != null
    ? Math.round((m.runway - snapshot.runway_months) * 10) / 10
    : null;

  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-base font-medium text-slate-700">Your clarity</h1>
        <Link href="/onboarding" className="fc-link-muted shrink-0">
          Start over
        </Link>
      </header>

      {/* Check-in banner */}
      {userId && (
        <CheckinBanner userId={userId} snapshot={snapshot} checkinJustDone={checkinJustDone} />
      )}

      {/* 1. Highlight */}
      <section
        className={`rounded-2xl px-5 py-6 shadow-fc-sm ${hero.border} ${hero.bg}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-white ${hero.badgeClass}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
            {hero.badge}
          </span>
        </div>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          {DIAGNOSIS_LABEL[result.diagnosis]}
        </p>
        <p className="mt-2 text-sm font-semibold leading-snug text-slate-800">
          {result.verdict}
        </p>
        <p className="mt-3 text-xl font-semibold leading-snug tracking-tight text-slate-900 sm:text-2xl">
          {result.summary}
        </p>
        <dl className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200/80 bg-white/60 px-3 py-2">
            <dt className="text-xs text-slate-500">Runway</dt>
            <dd className="font-semibold text-slate-900">{result.metrics.runway}</dd>
            {runwayDiff !== null && Math.abs(runwayDiff) >= 0.1 && (
              <dd className={`mt-0.5 text-xs font-medium ${runwayDiff > 0 ? "text-emerald-700" : "text-red-600"}`}>
                {runwayDiff > 0 ? "↑" : "↓"} {runwayDiff > 0 ? "+" : ""}{runwayDiff} mo since {snapshotMonthLabel(snapshot!.taken_at)}
              </dd>
            )}
          </div>
          <div className="rounded-lg border border-slate-200/80 bg-white/60 px-3 py-2">
            <dt className="text-xs text-slate-500">Target</dt>
            <dd className="font-semibold text-slate-900">{result.metrics.target}</dd>
          </div>
          <div className="rounded-lg border border-slate-200/80 bg-white/60 px-3 py-2 sm:col-span-1">
            <dt className="text-xs text-slate-500">Gap</dt>
            <dd className="font-semibold text-slate-900">{result.metrics.gap}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          {result.reassurance}
        </p>
        <p
          className={`mt-4 text-sm font-medium leading-snug ${
            result.confidence.level === "high"
              ? "text-emerald-800"
              : result.confidence.level === "medium"
                ? "text-amber-800"
                : "text-slate-700"
          }`}
        >
          {result.confidence.reason}
        </p>
        <div className="mt-5 rounded-xl border border-slate-200/90 bg-white/70 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            What could change this read
          </p>
          <ul className="mt-2 space-y-2 text-sm leading-relaxed text-slate-700">
            {result.sensitivity.what_changes.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 2. How to fix the biggest issue / your position */}
      <section className="fc-surface px-5 py-5">
        <h2 className="text-base font-semibold text-slate-900">
          {needsAttention
            ? "How to fix the biggest issue"
            : "Your position"}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          {needsAttention
            ? "Estimated figures from your onboarding—use them as a starting point, not a diagnosis."
            : "Liquidity snapshot from your answers (illustrative model)."}
        </p>
        <p className="mt-4 text-[15px] font-medium leading-relaxed text-slate-800">
          {result.insight}
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-700">
          {situationNarrative}
        </p>
        {needsAttention ? (
          <div className="mt-6 overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full min-w-[280px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  <th className="px-3 py-2.5 font-medium text-slate-500">
                    Metric
                  </th>
                  <th className="px-3 py-2.5 font-medium text-slate-500">
                    Current (estimated)
                  </th>
                  <th className="px-3 py-2.5 font-medium text-slate-500">
                    Target reference
                  </th>
                </tr>
              </thead>
              <tbody>
                {compareRows.map((row) => (
                  <tr
                    key={row.label}
                    className="border-b border-gray-50 last:border-0"
                  >
                    <td className="px-3 py-3 text-slate-600">{row.label}</td>
                    <td className="px-3 py-3 font-semibold tabular-nums text-slate-900">
                      {row.current}
                    </td>
                    <td className="px-3 py-3 font-medium tabular-nums text-emerald-800">
                      {row.target}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {/* 3. Recommended actions going forward */}
      <section
        id="recommended-forward"
        className="fc-surface px-5 py-5 scroll-mt-4"
      >
        <h2 className="text-base font-semibold text-slate-900">
          Recommended actions going forward
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Near-term steps from your numbers, plus how cash versus longer-term
          investing might fit over the next few years—illustrative, not a plan.
        </p>

        {needsAttention && urgentLead ? (
          <div className="fc-recommended-card mt-4">
            <p className="text-sm font-semibold text-slate-900">
              Priority focus
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {urgentLead}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            {result.action}
          </p>
        )}

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            {FEAR_LABEL[input.primary_fear] ?? "Given your main worry"}
          </p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-800">
            {result.projection}
          </p>
          <ul className="mt-3 space-y-2 border-t border-slate-200/60 pt-3">
            {fearExtraBullets(
              input.primary_fear,
              m.gap <= 0,
              input.hasInvestments,
            ).map((line) => (
              <li key={line} className="flex gap-2 text-sm leading-relaxed text-slate-600">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <h3 className="mt-8 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          Illustrative path (savings trajectory)
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          If your estimated monthly savings continue. "With returns" applies a
          conservative ~4% annual return to your invested portion only. "Real value"
          deflates by ~{Math.round(inflationRate * 100)}% illustrative annual inflation
          to show purchasing power — all figures are illustrative, not a forecast.
          Year-end totals include all savings pots, not liquid cash alone.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full min-w-[320px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <th className="px-3 py-2.5 font-medium text-slate-500">Year</th>
                <th className="px-3 py-2.5 font-medium text-slate-500">
                  Nominal
                </th>
                {input.hasInvestments && (
                  <th className="px-3 py-2.5 font-medium text-slate-500">
                    With ~4% returns
                  </th>
                )}
                <th className="px-3 py-2.5 font-medium text-slate-500">
                  Real value
                </th>
              </tr>
            </thead>
            <tbody>
              {yearProjections.map((row) => (
                <tr
                  key={row.label}
                  className="border-b border-gray-50 last:border-0"
                >
                  <td className="px-3 py-3 text-slate-500">{row.label}</td>
                  <td className="px-3 py-3 font-semibold tabular-nums text-slate-900">
                    {fmtCurrency(row.balance, currency, locale)}
                  </td>
                  {input.hasInvestments && (
                    <td className="px-3 py-3 font-medium tabular-nums text-emerald-800">
                      {fmtCurrency(row.balanceWithReturns, currency, locale)}
                    </td>
                  )}
                  <td className="px-3 py-3 tabular-nums text-slate-500">
                    {fmtCurrency(
                      input.hasInvestments
                        ? row.balanceWithReturnsReal
                        : row.balanceReal,
                      currency,
                      locale,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className="mt-6 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          At about {fmtCurrency(savePerMonth, currency, locale)} saved per
          month
        </h3>
        <ul className="mt-2 space-y-3">
          {projLines.map((line) => (
            <li key={line} className="flex gap-3 text-sm text-slate-600">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
                aria-hidden
              />
              {line}
            </li>
          ))}
        </ul>

        {furtherActions.length > 0 ? (
          <>
            <h3 className="mt-8 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              Additional steps
            </h3>
            <ul className="mt-3 space-y-2.5">
              {furtherActions.map((text) => (
                <li
                  key={text}
                  className="flex gap-3 text-sm leading-relaxed text-slate-700"
                >
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
                    aria-hidden
                  />
                  {text}
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {result.status !== "ok" && (
          <div className="mt-8 border-t border-gray-100 pt-6">
            <Explanation result={result} contextText={explainContext} />
          </div>
        )}
      </section>

      {/* 4. Economic context */}
      <section className="fc-surface px-5 py-5">
        <h2 className="text-base font-semibold text-slate-900">
          Economic context — {macro.countryLabel}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Illustrative ranges for learning—not live data, forecasts, or advice.
        </p>
        <p className="mt-3 text-sm font-medium text-slate-800">
          {macro.headline}
        </p>
        <dl className="mt-4 space-y-4">
          {macro.indicators.map((ind) => (
            <div
              key={ind.label}
              className="rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-3"
            >
              <dt className="text-xs font-medium text-slate-500">
                {ind.label}
              </dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                {ind.value}
              </dd>
              <dd className="mt-1 text-xs leading-relaxed text-slate-500">
                {ind.detail}
              </dd>
            </div>
          ))}
        </dl>
        <ul className="mt-5 space-y-2.5 border-t border-gray-100 pt-5">
          {macro.bullets.map((b) => (
            <li
              key={b}
              className="flex gap-3 text-sm leading-relaxed text-slate-600"
            >
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400"
                aria-hidden
              />
              {b}
            </li>
          ))}
        </ul>
      </section>

      {/* 5. User-provided data */}
      <CollapsibleSection
        title="Your inputs & data"
        subtitle="What you entered in onboarding and the estimates we derive—collapsed by default."
        defaultOpen={false}
      >
        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              What you told us
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Tap "edit" on any row to update that answer and recalculate instantly.
            </p>
            <EditableProfileRows rows={profileRows} currentValues={editableParams} />
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Model estimates (from your ranges)
            </h3>
            <dl className="mt-3 space-y-3">
              {estimateRows.map((row) => (
                <div
                  key={row.label}
                  className="flex flex-col gap-0.5 border-b border-gray-50 pb-3 last:border-0 sm:flex-row sm:justify-between sm:gap-4"
                >
                  <dt className="text-sm text-slate-500">{row.label}</dt>
                  <dd className="text-sm font-semibold tabular-nums text-slate-900">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </CollapsibleSection>

      <Link href="/onboarding" className="fc-link-muted inline-block py-2">
        Redo onboarding &rarr;
      </Link>
    </div>
  );
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const resolved = await resolveDashboardData(sp);
  const input = resolved?.financial ?? null;
  const onboarding = resolved?.onboarding ?? null;
  const userId = resolved?.userId;
  const snapshot = resolved?.snapshot;
  const checkinJustDone = sp.checkin === "1";
  const result = input ? getFinancialStatus(input) : null;

  const suggestionLines =
    result && onboarding && input
      ? suggestionsForDisplay(result, input, onboarding)
      : [];

  const explainLocale = onboarding
    ? currencyLocaleFromCountryCode(onboarding.country)
    : { currency: "USD", locale: "en-US" };

  const explainNumeric =
    result && input
      ? dashboardSituationNarrative(input, result.financialMetrics, (n) =>
          fmtCurrency(n, explainLocale.currency, explainLocale.locale),
        )
      : undefined;

  const explainContext =
    result && input
      ? financialResultToContextText(result, input, explainNumeric)
      : result
        ? financialResultToContextText(result, undefined, explainNumeric)
        : undefined;

  // Build a flat string map of current onboarding params for inline editing.
  const editableParams: Record<string, string> = onboarding
    ? {
        income: onboarding.income,
        savings: onboarding.savings,
        savingsRate: onboarding.savingsRate,
        country: onboarding.country,
        savingsMix: onboarding.savingsMix,
        incomeStability: onboarding.incomeStability,
        mortgage: onboarding.mortgagePressure,
        primaryFear: onboarding.primaryFear ?? "making_mistake",
      }
    : {};

  return (
    <main className="pb-10 pt-2">
      {result && onboarding && input ? (
        <ClarityView
          result={result}
          input={input}
          onboarding={onboarding}
          countryCode={onboarding.country}
          suggestionLines={suggestionLines}
          explainContext={explainContext}
          editableParams={editableParams}
          userId={userId}
          snapshot={snapshot}
          checkinJustDone={checkinJustDone}
        />
      ) : (
        <EmptyState />
      )}
    </main>
  );
}
