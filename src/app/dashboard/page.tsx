import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
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
} from "@/lib/engine";
import { getUserProfile, profileToOnboardingInput, getUser, type UserRow } from "@/lib/profiles";
import { getLatestSnapshot, snapshotMonthLabel, type SnapshotRow } from "@/lib/snapshots";
import {
  computeStaleness,
  applyStalenessPenalty,
  estimateDrift,
  computeBannerContent,
} from "@/lib/staleness";
import CollapsibleSection from "./collapsible-section";
import { currencyLocaleFromCountryCode } from "@/lib/money-tiers";
import { VALID_COUNTRY_CODES } from "@/lib/countries";
import {
  coerceIncomeRange,
  coerceIncomeStability,
  coerceMortgagePressure,
  coerceSavingsRateRange,
  coerceSavingsRange,
} from "@/lib/onboarding-legacy";
import InvestmentNudgeSection from "./investment-nudge";
import { buildInvestmentNudge } from "@/lib/investment-nudge";
import MonthlyLog from "./monthly-log";
import { getMonthlyAllocations, type MonthlyAllocation } from "@/lib/allocations";
import UserCookieSetter from "./user-cookie-setter";
import DashboardShell from "./dashboard-shell";
import EmptyState from "./empty-state";

export const metadata = { title: "Your clarity — FundCalm" };
// Never cache — dashboard is always user-specific
export const dynamic = "force-dynamic";

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
  allocations?: MonthlyAllocation[];
  updatedAt?: string;
  userRow?: UserRow | null;
} | null> {
  const cookieStore = await cookies();
  const userId =
    typeof sp.user === "string"
      ? sp.user
      : (cookieStore.get("fundcalm_uid")?.value ?? undefined);
  if (userId) {
    try {
      const [row, snapshot, userRow, allocations] = await Promise.all([
        withTimeout(getUserProfile(userId), 5_000, null),
        withTimeout(getLatestSnapshot(userId), 3_000, null),
        withTimeout(getUser(userId), 3_000, null),
        withTimeout(getMonthlyAllocations(userId), 3_000, []),
      ]);
      if (row) {
        const onboarding = profileToOnboardingInput(row);
        return {
          onboarding,
          financial: fromOnboarding(onboarding),
          userId,
          snapshot,
          allocations,
          updatedAt: row.updated_at,
          userRow,
        };
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

function TokenGate({ userId: _userId }: { userId: string }) {
  return (
    <div className="fc-surface mt-10 px-6 py-12 text-center">
      <p className="text-lg font-semibold text-slate-900">Use your email link</p>
      <p className="mt-2 text-sm text-slate-500">
        Your dashboard is protected. Use the link we sent to your email address to access it.
      </p>
      <p className="mt-3 text-xs text-slate-400">
        Can't find it? Re-enter your email on the onboarding page and we'll send a new link.
      </p>
      <Link href="/onboarding" className="fc-btn-primary mt-8">
        Get a new link
      </Link>
    </div>
  );
}

const BANNER_STYLES = {
  default: {
    wrap: "border border-gray-100 bg-gray-50/80",
    text: "text-slate-700",
    sub:  "text-slate-500",
    btn:  "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
  highlight: {
    wrap: "border border-emerald-200 bg-emerald-50",
    text: "text-emerald-900",
    sub:  "text-emerald-700",
    btn:  "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
  urgent: {
    wrap: "border border-amber-200 bg-amber-50",
    text: "text-amber-900",
    sub:  "text-amber-700",
    btn:  "bg-amber-600 hover:bg-amber-700 text-white",
  },
} as const;

function CheckinBanner({
  userId,
  checkinJustDone,
  content,
  token,
}: {
  userId: string;
  checkinJustDone?: boolean;
  content: import("@/lib/staleness").BannerContent;
  token?: string;
}) {
  if (checkinJustDone) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
        Numbers updated. Your dashboard has been recalculated.
      </div>
    );
  }

  const checkinHref = token
    ? `/checkin?user=${userId}&token=${token}`
    : `/checkin?user=${userId}`;

  const s = BANNER_STYLES[content.variant];
  return (
    <div className={`flex items-start justify-between gap-3 rounded-xl px-4 py-3 ${s.wrap}`}>
      <div className="min-w-0">
        <p className={`text-xs font-medium leading-snug ${s.text}`}>{content.message}</p>
        {content.sub && (
          <p className={`mt-0.5 text-xs leading-relaxed ${s.sub}`}>{content.sub}</p>
        )}
      </div>
      <Link
        href={checkinHref}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold ${s.btn}`}
      >
        {content.buttonLabel}
      </Link>
    </div>
  );
}

function RunwayBar({
  runwayMonths,
  targetMonths,
  projectedMonths,
  isStale,
}: {
  runwayMonths: number;
  targetMonths: number;
  projectedMonths?: number;
  isStale: boolean;
}) {
  // Bar fills proportionally; cap display at 150% of target so the bar doesn't overflow on healthy users
  const displayMax = Math.max(targetMonths * 1.5, runwayMonths);
  const fillPct = Math.min(100, (runwayMonths / displayMax) * 100);
  const targetPct = Math.min(100, (targetMonths / displayMax) * 100);
  const projectedPct = projectedMonths != null
    ? Math.min(100, (projectedMonths / displayMax) * 100)
    : null;

  const isShort = runwayMonths < targetMonths;
  const barColor = isShort ? "bg-amber-400" : "bg-emerald-500";

  return (
    <div>
      <div className="relative h-3 w-full overflow-visible rounded-full bg-slate-100">
        <div
          className={`h-3 rounded-full transition-all ${barColor}`}
          style={{ width: `${fillPct}%` }}
        />
        {projectedPct != null && projectedPct > fillPct && (
          <div
            className="absolute top-0 h-3 rounded-full bg-emerald-200"
            style={{ left: `${fillPct}%`, width: `${projectedPct - fillPct}%` }}
          />
        )}
        <div
          className="absolute top-[-4px] h-5 w-0.5 rounded-full bg-slate-400"
          style={{ left: `${targetPct}%` }}
        />
      </div>

      <div className="relative mt-2 h-5">
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold tabular-nums text-slate-700"
          style={{ left: `${Math.max(5, Math.min(95, fillPct))}%` }}
        >
          {Math.round(runwayMonths * 10) / 10} mo
          {isStale && <span className="ml-0.5 text-slate-400">*</span>}
        </span>
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap text-[11px] text-slate-400"
          style={{ left: `${Math.max(5, Math.min(92, targetPct))}%` }}
        >
          target: {Math.round(targetMonths * 10) / 10} mo
        </span>
      </div>
    </div>
  );
}

// ── Current state tile ──
function CurrentStateTile({
  result,
  fmt,
  targetRunwayMonths,
  isStale,
  projectedRunway,
  runwayDiff,
  snapshotLabel,
}: {
  result: FinancialResult;
  fmt: (n: number) => string;
  targetRunwayMonths: number;
  isStale: boolean;
  projectedRunway?: number;
  runwayDiff: number | null;
  snapshotLabel?: string;
}) {
  const m = result.financialMetrics;
  const hero = STATUS_HERO[result.status];

  return (
    <section className={`flex flex-col rounded-2xl px-5 py-6 shadow-fc-sm ${hero.border} ${hero.bg}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-white ${hero.badgeClass}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
          {hero.badge}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Current state
        </span>
      </div>

      <p className="mt-4 text-sm font-semibold uppercase tracking-[0.06em] text-slate-500">
        {DIAGNOSIS_LABEL[result.diagnosis]}
      </p>

      {/* Big runway number */}
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-5xl font-bold tabular-nums leading-none text-slate-900">
          {Math.round(m.runway * 10) / 10}
        </span>
        <span className="text-sm text-slate-500">months of runway</span>
      </div>

      <div className="mt-5">
        <RunwayBar
          runwayMonths={m.runway}
          targetMonths={targetRunwayMonths}
          projectedMonths={projectedRunway}
          isStale={isStale}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
        {m.gap > 0 ? (
          <p className="text-sm tabular-nums text-slate-700">
            <span className="font-semibold text-red-700">{fmt(m.gap)}</span>
            <span className="ml-1 text-slate-500">short of target</span>
          </p>
        ) : (
          <p className="text-sm font-medium text-emerald-700">
            At or above target buffer
          </p>
        )}
        {runwayDiff !== null && Math.abs(runwayDiff) >= 0.1 && snapshotLabel && (
          <p className={`text-xs font-medium tabular-nums ${runwayDiff > 0 ? "text-emerald-700" : "text-red-600"}`}>
            {runwayDiff > 0 ? "↑" : "↓"} {runwayDiff > 0 ? "+" : ""}{runwayDiff} mo since {snapshotLabel}
          </p>
        )}
      </div>
    </section>
  );
}

type Scenario = {
  label: string;
  headline: string;
  detail: string;
  pct: number;
};

function suggestionScenarios({
  result,
  input,
  fmt,
  savePerMonth,
  targetRunwayMonths,
}: {
  result: FinancialResult;
  input: FinancialInput;
  fmt: (n: number) => string;
  savePerMonth: number;
  targetRunwayMonths: number;
}): { headline: string; positive: Scenario; negative: Scenario } {
  const m = result.financialMetrics;
  const dx = result.diagnosis;
  const progressPct =
    m.required_cash > 0
      ? Math.min(100, Math.round((input.cash_amount / m.required_cash) * 100))
      : 100;
  const monthsToTarget =
    savePerMonth > 0 && m.gap > 0
      ? Math.min(120, Math.ceil(m.gap / savePerMonth))
      : null;
  const targetMo = Math.round(targetRunwayMonths);

  if (
    dx === Diagnosis.CriticalBuffer ||
    dx === Diagnosis.InsufficientBuffer ||
    dx === Diagnosis.LimitedBuffer
  ) {
    return {
      headline:
        dx === Diagnosis.CriticalBuffer
          ? "Build your cash buffer — urgent"
          : dx === Diagnosis.InsufficientBuffer
            ? "Build your cash buffer"
            : "Keep building your buffer",
      positive: {
        label: "If you act",
        headline:
          savePerMonth > 0 && monthsToTarget
            ? `Save ~${fmt(savePerMonth)}/mo`
            : `Add ~${fmt(m.gap)} to cash`,
        detail:
          monthsToTarget !== null
            ? `Reach your ${targetMo}-month buffer in ~${monthsToTarget} month${monthsToTarget === 1 ? "" : "s"}.`
            : `Close the ${fmt(m.gap)} gap to hit your ${targetMo}-month buffer.`,
        pct: 100,
      },
      negative: {
        label: "If you don't",
        headline: `${fmt(m.gap)} short of target`,
        detail: `Stuck at ${Math.round(m.runway * 10) / 10} of ${targetMo} months — one income shock hits hard.`,
        pct: Math.max(6, progressPct),
      },
    };
  }

  if (dx === Diagnosis.Overinvested) {
    return {
      headline: "Move some savings into cash",
      positive: {
        label: "If you act",
        headline: `Shift ~${fmt(m.gap)} into cash`,
        detail: `Restores a ${targetMo}-month cash cushion — you won't be forced to sell at a bad time.`,
        pct: 100,
      },
      negative: {
        label: "If you don't",
        headline: "Exposed to timing risk",
        detail: `${Math.round(m.runway * 10) / 10} months of cash means a market drop could force selling.`,
        pct: Math.max(10, Math.min(60, progressPct)),
      },
    };
  }

  if (dx === Diagnosis.TooConservative) {
    const surplus = -m.gap;
    return {
      headline: "Consider putting surplus to work",
      positive: {
        label: "If you act",
        headline: `Invest ~${fmt(surplus)} gradually`,
        detail: "Long-run growth on surplus cash outpaces inflation.",
        pct: 100,
      },
      negative: {
        label: "If you don't",
        headline: "Cash loses purchasing power",
        detail: "Excess cash sitting idle is eroded by inflation each year.",
        pct: 35,
      },
    };
  }

  if (dx === Diagnosis.BalancedButIdle) {
    return {
      headline: "Start adding to longer-term savings",
      positive: {
        label: "If you act",
        headline: `Invest a small monthly amount`,
        detail: "Captures compounding growth without timing the market.",
        pct: 100,
      },
      negative: {
        label: "If you don't",
        headline: "Potential growth left idle",
        detail: "Cushion stays strong, but long-term upside is limited.",
        pct: 45,
      },
    };
  }

  // Healthy
  return {
    headline: "You're in good shape",
    positive: {
      label: "If you stay the course",
      headline: "Trajectory stays strong",
      detail: "Cash and investments are well-balanced for your profile.",
      pct: 100,
    },
    negative: {
      label: "Watch for",
      headline: "Big life changes",
      detail: "Re-check after income shifts, house moves, or new goals.",
      pct: 75,
    },
  };
}

// ── Suggestions tile with positive / negative paths ──
function SuggestionsTile({
  result,
  input,
  fmt,
  savePerMonth,
  targetRunwayMonths,
}: {
  result: FinancialResult;
  input: FinancialInput;
  fmt: (n: number) => string;
  savePerMonth: number;
  targetRunwayMonths: number;
}) {
  const { headline, positive, negative } = suggestionScenarios({
    result,
    input,
    fmt,
    savePerMonth,
    targetRunwayMonths,
  });

  return (
    <section className="flex flex-col rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-fc-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
          Next step
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Suggestions
        </span>
      </div>

      <p className="mt-4 text-lg font-semibold leading-snug tracking-tight text-slate-900">
        {headline}
      </p>

      <div className="mt-5 space-y-3">
        {/* Positive path */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-emerald-600" aria-hidden>
              <path
                fill="currentColor"
                d="M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Zm3.5 6.3-4.2 4.2a.8.8 0 0 1-1.1 0L6.5 11.3a.8.8 0 0 1 1.1-1.1l1.7 1.7 3.7-3.7a.8.8 0 0 1 1.1 1.1Z"
              />
            </svg>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-700">
              {positive.label}
            </p>
          </div>
          <p className="mt-1.5 text-sm font-semibold text-slate-900">{positive.headline}</p>
          <p className="mt-1 text-xs leading-relaxed text-emerald-800/80">{positive.detail}</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-emerald-100">
            <div
              className="h-1.5 rounded-full bg-emerald-500"
              style={{ width: `${positive.pct}%` }}
            />
          </div>
        </div>

        {/* Negative path */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-amber-600" aria-hidden>
              <path
                fill="currentColor"
                d="M10 2.2c.5 0 1 .3 1.3.8l7.3 12.5c.6 1-.2 2.2-1.3 2.2H2.7c-1.1 0-1.9-1.2-1.3-2.2L8.7 3a1.5 1.5 0 0 1 1.3-.8Zm0 5.3a.9.9 0 0 0-.9.9v3.2a.9.9 0 1 0 1.8 0V8.4a.9.9 0 0 0-.9-.9Zm0 7.1a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
              />
            </svg>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-amber-700">
              {negative.label}
            </p>
          </div>
          <p className="mt-1.5 text-sm font-semibold text-slate-900">{negative.headline}</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-800/80">{negative.detail}</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-amber-100">
            <div
              className="h-1.5 rounded-full bg-amber-500"
              style={{ width: `${negative.pct}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function ClarityView({
  result,
  input,
  countryCode,
  userId,
  snapshot,
  allocations,
  checkinJustDone,
  updatedAt,
  token,
}: {
  result: FinancialResult;
  input: FinancialInput;
  onboarding: OnboardingInput;
  countryCode: string;
  userId?: string;
  snapshot?: SnapshotRow | null;
  allocations?: MonthlyAllocation[];
  checkinJustDone?: boolean;
  updatedAt?: string;
  token?: string;
}) {
  const { currency, locale } = currencyLocaleFromCountryCode(countryCode);
  const m = result.financialMetrics;
  const savePerMonth = input.monthly_income_estimate * input.monthly_savings_rate;
  const fmt = (n: number) => fmtCurrency(n, currency, locale);

  const targetRunwayMonths =
    input.monthly_expenses > 0 ? m.required_cash / input.monthly_expenses : 6;

  const totalAssets = input.cash_amount + input.investments_amount;
  const investmentNudge = buildInvestmentNudge(
    result.diagnosis,
    {
      cash_amount: input.cash_amount,
      investments_amount: input.investments_amount,
      investments_ratio: totalAssets > 0 ? input.investments_amount / totalAssets : 0,
      required_cash: m.required_cash,
      runway_months: m.runway,
      target_runway_months: targetRunwayMonths,
    },
    input.primary_fear,
    input.hasInvestments,
    fmt,
  );

  const runwayDiff = snapshot?.runway_months != null
    ? Math.round((m.runway - snapshot.runway_months) * 10) / 10
    : null;

  // Staleness, drift, confidence
  const staleness = updatedAt ? computeStaleness(updatedAt) : null;
  const drift = staleness ? estimateDrift(input, staleness.monthsElapsed) : null;
  const displayConfidence =
    staleness && staleness.level !== "fresh"
      ? applyStalenessPenalty(result.confidence, staleness)
      : result.confidence;
  const isStale = !!(staleness && staleness.level !== "fresh");

  const bannerContent = userId
    ? (checkinJustDone
        ? { message: "", sub: undefined, buttonLabel: "", variant: "default" as const }
        : computeBannerContent({
            staleness: staleness ?? computeStaleness(new Date().toISOString()),
            drift: drift ?? {
              estimatedMonthlySaving: 0,
              estimatedAddedSavings: 0,
              projectedSavingsTotal: input.savings_total,
              projectedCashAmount: input.cash_amount,
              projectedRunwayMonths: m.runway,
              meaningful: false,
            },
            status: result.status,
            currentRunwayMonths: m.runway,
            targetRunwayMonths,
            currency,
            locale,
            lastCheckinLabel: snapshot?.taken_at
              ? snapshotMonthLabel(snapshot.taken_at)
              : undefined,
          }))
    : null;

  const confidenceColor =
    displayConfidence.level === "high"
      ? "text-emerald-700"
      : displayConfidence.level === "medium"
        ? "text-amber-700"
        : "text-slate-500";

  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-base font-medium text-slate-700">Your clarity</h1>
        <Link href="/onboarding" className="fc-link-muted shrink-0">
          Start over
        </Link>
      </header>

      {userId && bannerContent && (
        <CheckinBanner
          userId={userId}
          checkinJustDone={checkinJustDone}
          content={bannerContent}
          token={token}
        />
      )}

      {/* ── TWO TILES: Current state + Suggestions ── */}
      <div className="grid gap-4 md:grid-cols-2">
        <CurrentStateTile
          result={result}
          fmt={fmt}
          targetRunwayMonths={targetRunwayMonths}
          isStale={isStale}
          projectedRunway={drift?.meaningful ? drift.projectedRunwayMonths : undefined}
          runwayDiff={runwayDiff}
          snapshotLabel={snapshot?.taken_at ? snapshotMonthLabel(snapshot.taken_at) : undefined}
        />
        <SuggestionsTile
          result={result}
          input={input}
          fmt={fmt}
          savePerMonth={savePerMonth}
          targetRunwayMonths={targetRunwayMonths}
        />
      </div>

      {isStale && (
        <p className="text-xs text-slate-400">
          * Based on figures from {staleness!.label}. Update for a fresh read.
        </p>
      )}
      <p className={`text-xs ${confidenceColor}`}>
        {displayConfidence.reason}
      </p>

      {/* Investment nudge — only for stable states */}
      <InvestmentNudgeSection nudge={investmentNudge} />

      {/* Monthly flow */}
      {userId ? (
        <CollapsibleSection
          title="Monthly flow"
          subtitle="Log income, spending, and savings each month to track your savings rate over time."
          defaultOpen={false}
        >
          <MonthlyLog
            userId={userId}
            initialEntries={allocations ?? []}
            currency={currency}
            locale={locale}
            profileSavingsRate={input.monthly_savings_rate}
          />
        </CollapsibleSection>
      ) : null}

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
  const allocations = resolved?.allocations;
  const updatedAt = resolved?.updatedAt;
  const userRow = resolved?.userRow;
  const checkinJustDone = sp.checkin === "1";
  const token = typeof sp.token === "string" ? sp.token : undefined;
  const result = input ? getFinancialStatus(input) : null;

  // Token gate: if the user has an access token set, require it in the URL.
  if (userId && userRow?.access_token && token !== userRow.access_token) {
    return (
      <main className="pb-10 pt-2">
        <TokenGate userId={userId} />
      </main>
    );
  }

  const hasProfile = !!(result && onboarding && input);

  return (
    <main className="pb-10 pt-2">
      <DashboardShell hasProfile={hasProfile} fallback={<EmptyState />}>
        <Suspense fallback={null}>
          <UserCookieSetter />
        </Suspense>
        <ClarityView
          result={result!}
          input={input!}
          onboarding={onboarding!}
          countryCode={onboarding!.country}
          userId={userId}
          snapshot={snapshot}
          allocations={allocations}
          checkinJustDone={checkinJustDone}
          updatedAt={updatedAt}
          token={token}
        />
      </DashboardShell>
    </main>
  );
}
