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
import { getUserProfile, profileToOnboardingInput, getUser, type UserRow } from "@/lib/profiles";
import { getLatestSnapshot, getAllSnapshots, snapshotMonthLabel, type SnapshotRow } from "@/lib/snapshots";
import WhatIfPanel from "./what-if-panel";
import {
  computeStaleness,
  applyStalenessPenalty,
  estimateDrift,
  computeBannerContent,
} from "@/lib/staleness";
import { financialResultToContextText } from "@/lib/explain";
import {
  financialEstimatesForDisplay,
  onboardingAnswersForDisplay,
  suggestionsForDisplay,
} from "@/lib/onboarding-display";
import { dashboardSituationNarrative } from "@/lib/dashboard-attention";
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
import InvestmentNudgeSection from "./investment-nudge";
import { buildInvestmentNudge } from "@/lib/investment-nudge";

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
  allSnapshots?: SnapshotRow[];
  updatedAt?: string;
  userRow?: UserRow | null;
} | null> {
  const userId = typeof sp.user === "string" ? sp.user : undefined;
  if (userId) {
    try {
      const [row, snapshot, allSnapshots, userRow] = await Promise.all([
        withTimeout(getUserProfile(userId), 5_000, null),
        withTimeout(getLatestSnapshot(userId), 3_000, null),
        withTimeout(getAllSnapshots(userId), 3_000, []),
        withTimeout(getUser(userId), 3_000, null),
      ]);
      if (row) {
        const onboarding = profileToOnboardingInput(row);
        return {
          onboarding,
          financial: fromOnboarding(onboarding),
          userId,
          snapshot,
          allSnapshots,
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

// ── Action card: the single most prominent element in Section 2 ──
function ActionCard({
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
  const m = result.financialMetrics;
  const dx = result.diagnosis;

  type CardConfig = {
    headline: string;
    card: string;
    headingColor: string;
    showBar: boolean;
  };

  const configs: Record<Diagnosis, CardConfig> = {
    [Diagnosis.CriticalBuffer]: {
      headline: "Build your cash buffer — urgent",
      card: "border-red-200 bg-red-50/70",
      headingColor: "text-red-800",
      showBar: true,
    },
    [Diagnosis.InsufficientBuffer]: {
      headline: "Build your cash buffer",
      card: "border-amber-200 bg-amber-50/70",
      headingColor: "text-amber-900",
      showBar: true,
    },
    [Diagnosis.LimitedBuffer]: {
      headline: "Keep building your buffer",
      card: "border-amber-100 bg-amber-50/40",
      headingColor: "text-amber-800",
      showBar: true,
    },
    [Diagnosis.Overinvested]: {
      headline: "Move some savings into cash",
      card: "border-amber-200 bg-amber-50/70",
      headingColor: "text-amber-900",
      showBar: true,
    },
    [Diagnosis.TooConservative]: {
      headline: "Consider putting surplus to work",
      card: "border-slate-200 bg-slate-50/60",
      headingColor: "text-slate-700",
      showBar: false,
    },
    [Diagnosis.BalancedButIdle]: {
      headline: "Start adding to longer-term savings",
      card: "border-slate-200 bg-slate-50/60",
      headingColor: "text-slate-700",
      showBar: false,
    },
    [Diagnosis.Healthy]: {
      headline: "You're in good shape",
      card: "border-emerald-200 bg-emerald-50/60",
      headingColor: "text-emerald-800",
      showBar: false,
    },
  };

  const { headline, card, headingColor, showBar } = configs[dx];

  // One concrete, specific sentence
  let ctaLine: string;
  if (
    dx === Diagnosis.CriticalBuffer ||
    dx === Diagnosis.InsufficientBuffer ||
    dx === Diagnosis.LimitedBuffer
  ) {
    ctaLine = `You need ${fmt(m.gap)} more in accessible cash to reach your ${Math.round(targetRunwayMonths)}-month cushion.`;
  } else if (dx === Diagnosis.Overinvested) {
    ctaLine = `Move about ${fmt(m.gap)} from investments into accessible cash to reduce your risk.`;
  } else if (dx === Diagnosis.TooConservative) {
    ctaLine = `You have ${fmt(-m.gap)} above your cushion — that surplus could grow faster outside of cash.`;
  } else if (dx === Diagnosis.BalancedButIdle) {
    ctaLine = "Your cushion is solid. Adding gradually to longer-term savings is the natural next step.";
  } else {
    ctaLine = "Cash and investments are balanced for your profile. No action needed.";
  }

  // Progress toward cash target (buffer and overinvested states)
  const progressPct =
    m.required_cash > 0
      ? Math.min(100, Math.round((input.cash_amount / m.required_cash) * 100))
      : 100;
  const barColor =
    progressPct >= 80
      ? "bg-emerald-500"
      : progressPct >= 50
        ? "bg-amber-400"
        : "bg-red-400";

  // Months to close the gap at current saving rate
  const monthsToTarget =
    savePerMonth > 0 && m.gap > 0
      ? Math.min(120, Math.ceil(m.gap / savePerMonth))
      : null;

  return (
    <div className={`rounded-xl border px-4 py-4 ${card}`}>
      <p className={`text-sm font-semibold ${headingColor}`}>{headline}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{ctaLine}</p>

      {/* Progress bar — only for buffer / overinvested */}
      {showBar && (
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-xs tabular-nums text-slate-400">
            <span>{fmt(input.cash_amount)} now</span>
            <span>{fmt(m.required_cash)} target</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/70">
            <div
              className={`h-2 rounded-full ${barColor}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs tabular-nums text-slate-400">
            {progressPct < 100
              ? `${progressPct}% of target${
                  monthsToTarget !== null
                    ? ` · ~${fmt(savePerMonth)}/mo → ${monthsToTarget} month${monthsToTarget === 1 ? "" : "s"} away`
                    : ""
                }`
              : "At or above target"}
          </p>
        </div>
      )}

      {/* Surplus label for non-buffer stable states */}
      {!showBar && m.gap < 0 && dx !== Diagnosis.Healthy && (
        <p className="mt-2 text-xs tabular-nums text-slate-400">
          {fmt(-m.gap)} above your {Math.round(targetRunwayMonths)}-month cushion
        </p>
      )}
    </div>
  );
}

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

function TokenGate({ userId }: { userId: string }) {
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

function RunwayHistoryChart({
  snapshots,
  currentRunway,
  targetRunway,
}: {
  snapshots: SnapshotRow[];
  currentRunway: number;
  targetRunway: number;
}) {
  // Need at least 2 points to draw a line
  const points = snapshots.filter((s) => s.runway_months != null);
  if (points.length < 2) return null;

  const W = 560;
  const H = 110;
  const PAD = { top: 14, right: 16, bottom: 24, left: 36 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const allRunways = [...points.map((p) => p.runway_months as number), currentRunway, targetRunway];
  const maxY = Math.ceil(Math.max(...allRunways) * 1.25);

  function xFor(i: number) {
    return PAD.left + (i / (points.length)) * cW;
  }
  function yFor(v: number) {
    return PAD.top + (1 - v / maxY) * cH;
  }

  // Current point (right edge)
  const currentX = PAD.left + cW;
  const currentY = yFor(currentRunway);
  const targetY = yFor(targetRunway);

  const linePath = [
    ...points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(p.runway_months as number)}`),
    `L ${currentX} ${currentY}`,
  ].join(" ");

  // Y-axis labels (0, half, max)
  const yLabels = [0, Math.round(maxY / 2), maxY];

  return (
    <div className="mt-5 overflow-x-auto">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
        Runway history
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minWidth: 260 }}
        aria-label="Runway history chart"
      >
        {/* Target runway dashed line */}
        <line
          x1={PAD.left}
          y1={targetY}
          x2={W - PAD.right}
          y2={targetY}
          stroke="#059669"
          strokeWidth={1}
          strokeDasharray="4 3"
          opacity={0.5}
        />
        <text x={W - PAD.right + 2} y={targetY + 4} fontSize={9} fill="#059669" opacity={0.7}>
          target
        </text>

        {/* Y-axis labels */}
        {yLabels.map((v) => (
          <text key={v} x={PAD.left - 4} y={yFor(v) + 4} fontSize={9} fill="#9ca3af" textAnchor="end">
            {v}
          </text>
        ))}

        {/* Line */}
        <path d={linePath} fill="none" stroke="#059669" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {/* Snapshot dots with tooltips */}
        {points.map((p, i) => (
          <circle key={p.id} cx={xFor(i)} cy={yFor(p.runway_months as number)} r={3} fill="#059669" opacity={0.7}>
            <title>{snapshotMonthLabel(p.taken_at)}: {Math.round((p.runway_months as number) * 10) / 10} mo</title>
          </circle>
        ))}

        {/* Current dot (highlighted) */}
        <circle cx={currentX} cy={currentY} r={4.5} fill="#059669">
          <title>Now: {Math.round(currentRunway * 10) / 10} mo</title>
        </circle>
        <circle cx={currentX} cy={currentY} r={7} fill="none" stroke="#059669" strokeWidth={1.5} opacity={0.3} />

        {/* X-axis date labels (first, middle, last snapshot) */}
        {[0, Math.floor(points.length / 2)].map((i) =>
          points[i] ? (
            <text key={i} x={xFor(i)} y={H - 4} fontSize={9} fill="#9ca3af" textAnchor="middle">
              {snapshotMonthLabel(points[i].taken_at)}
            </text>
          ) : null
        )}
        <text x={currentX} y={H - 4} fontSize={9} fill="#374151" textAnchor="end">
          now
        </text>
      </svg>
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
  runwayDiff,
  snapshotLabel,
}: {
  runwayMonths: number;
  targetMonths: number;
  projectedMonths?: number;
  isStale: boolean;
  runwayDiff: number | null;
  snapshotLabel?: string;
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
    <div className="mt-5">
      {/* Bar */}
      <div className="relative h-3 w-full overflow-visible rounded-full bg-slate-100">
        {/* Fill */}
        <div
          className={`h-3 rounded-full transition-all ${barColor}`}
          style={{ width: `${fillPct}%` }}
        />
        {/* Projected fill (ghost) */}
        {projectedPct != null && projectedPct > fillPct && (
          <div
            className="absolute top-0 h-3 rounded-full bg-emerald-200"
            style={{ left: `${fillPct}%`, width: `${projectedPct - fillPct}%` }}
          />
        )}
        {/* Target marker */}
        <div
          className="absolute top-[-4px] h-5 w-0.5 rounded-full bg-slate-400"
          style={{ left: `${targetPct}%` }}
        />
      </div>

      {/* Labels row */}
      <div className="relative mt-2 h-5">
        {/* Current runway label */}
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold tabular-nums text-slate-700"
          style={{ left: `${Math.max(5, Math.min(95, fillPct))}%` }}
        >
          {Math.round(runwayMonths * 10) / 10} mo
          {isStale && <span className="ml-0.5 text-slate-400">*</span>}
        </span>
        {/* Target label */}
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap text-[11px] text-slate-400"
          style={{ left: `${Math.max(5, Math.min(92, targetPct))}%` }}
        >
          target: {Math.round(targetMonths * 10) / 10} mo
        </span>
      </div>

      {/* Delta and projected lines */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {runwayDiff !== null && Math.abs(runwayDiff) >= 0.1 && snapshotLabel && (
          <p className={`text-xs font-medium tabular-nums ${runwayDiff > 0 ? "text-emerald-700" : "text-red-600"}`}>
            {runwayDiff > 0 ? "↑" : "↓"} {runwayDiff > 0 ? "+" : ""}{runwayDiff} mo since {snapshotLabel}
          </p>
        )}
        {projectedMonths != null && isStale && (
          <p className="text-xs text-slate-400">
            ~{Math.round(projectedMonths * 10) / 10} mo estimated now
          </p>
        )}
      </div>
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
  allSnapshots,
  checkinJustDone,
  updatedAt,
  token,
}: {
  result: FinancialResult;
  input: FinancialInput;
  onboarding: OnboardingInput;
  countryCode: string;
  suggestionLines: string[];
  explainContext?: string;
  editableParams: Record<string, string>;
  userId?: string;
  snapshot?: SnapshotRow | null;
  allSnapshots?: SnapshotRow[];
  checkinJustDone?: boolean;
  updatedAt?: string;
  token?: string;
}) {
  const { currency, locale } = currencyLocaleFromCountryCode(countryCode);
  const m = result.financialMetrics;
  const macro = economicOverviewForCountry(countryCode);
  const inflationRate = illustrativeInflationRate(countryCode);
  const yearProjections = projectSavingsYears(input, 5, inflationRate);
  const hero = STATUS_HERO[result.status];
  const savePerMonth = input.monthly_income_estimate * input.monthly_savings_rate;
  const fmt = (n: number) => fmtCurrency(n, currency, locale);

  const targetRunwayMonths =
    input.monthly_expenses > 0 ? m.required_cash / input.monthly_expenses : 6;

  // Investment nudge — only shown for stable states (TooConservative, BalancedButIdle, Healthy)
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

  const profileRows = onboardingAnswersForDisplay(onboarding);
  const estimateRows = financialEstimatesForDisplay(input, m);

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

      {/* Update banner */}
      {userId && bannerContent && (
        <CheckinBanner
          userId={userId}
          checkinJustDone={checkinJustDone}
          content={bannerContent}
          token={token}
        />
      )}

      {/* ── SECTION 1: Status card ── */}
      <section className={`rounded-2xl px-5 py-6 shadow-fc-sm ${hero.border} ${hero.bg}`}>

        {/* Badge + diagnosis label */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-white ${hero.badgeClass}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
            {hero.badge}
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            {DIAGNOSIS_LABEL[result.diagnosis]}
          </span>
        </div>

        {/* One-sentence summary */}
        <p className="mt-3 text-lg font-semibold leading-snug tracking-tight text-slate-900 sm:text-xl">
          {result.summary}
        </p>

        {/* Runway bar */}
        <RunwayBar
          runwayMonths={m.runway}
          targetMonths={targetRunwayMonths}
          projectedMonths={drift?.meaningful ? drift.projectedRunwayMonths : undefined}
          isStale={isStale}
          runwayDiff={runwayDiff}
          snapshotLabel={snapshot?.taken_at ? snapshotMonthLabel(snapshot.taken_at) : undefined}
        />
        {isStale && (
          <p className="mt-1 text-xs text-slate-400">
            * Based on figures from {staleness!.label}. Update for a fresh read.
          </p>
        )}

        {/* Gap stat — only when meaningful */}
        {m.gap > 0 && (
          <p className="mt-4 text-sm text-slate-600">
            <span className="font-semibold tabular-nums text-slate-900">{fmt(m.gap)}</span>
            {" "}short of your target buffer.
          </p>
        )}
        {m.gap <= 0 && (
          <p className="mt-4 text-sm text-slate-600">
            You're at or above your target buffer.
          </p>
        )}

        {/* Confidence — inline, unobtrusive */}
        <p className={`mt-3 text-xs ${confidenceColor}`}>
          {displayConfidence.reason}
        </p>
      </section>

      {/* ── SECTION 2: What to do ── */}
      <section className="fc-surface px-5 py-5">

        {/* Action card — prominent, diagnosis-specific */}
        <ActionCard
          result={result}
          input={input}
          fmt={fmt}
          savePerMonth={savePerMonth}
          targetRunwayMonths={targetRunwayMonths}
        />

        {/* Fear context — one paragraph, no bullet overflow */}
        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            {FEAR_LABEL[input.primary_fear] ?? "Given your main worry"}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            {result.projection}
          </p>
        </div>

      </section>

      {/* ── SECTION 2b: Investment nudge (stable states only) ── */}
      <InvestmentNudgeSection nudge={investmentNudge} />

      {/* ── SECTION 3: Deeper detail (collapsed) ── */}
      <CollapsibleSection
        title="More detail"
        subtitle="Adjust expenses, worry context, history, trajectory, and your inputs."
        defaultOpen={false}
      >
        <div className="space-y-8">

          {/* What-if expense slider */}
          <div>
            <WhatIfPanel input={input} />
          </div>

          {/* Fear bullets — expanded context for main worry */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              More on your main worry
            </h3>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
              {fearExtraBullets(input.primary_fear, m.gap <= 0, input.hasInvestments).map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          {/* Runway history chart */}
          {allSnapshots && allSnapshots.length >= 2 && (
            <div>
              <RunwayHistoryChart
                snapshots={allSnapshots}
                currentRunway={m.runway}
                targetRunway={targetRunwayMonths}
              />
            </div>
          )}

          {/* What could shift this */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              What could change this read
            </h3>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
              {result.sensitivity.what_changes.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          {/* Savings trajectory */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              Illustrative savings trajectory (5 years)
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Nominal growth at your current pace.{input.hasInvestments ? ` "With returns" applies ~4% to your invested portion.` : ""}{" "}
              "Real value" deflates by ~{Math.round(inflationRate * 100)}% illustrative inflation. Not a forecast.
            </p>
            <div className="mt-3 overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full min-w-[280px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80">
                    <th className="px-3 py-2.5 font-medium text-slate-500">Year</th>
                    <th className="px-3 py-2.5 font-medium text-slate-500">Nominal</th>
                    {input.hasInvestments && (
                      <th className="px-3 py-2.5 font-medium text-slate-500">With returns</th>
                    )}
                    <th className="px-3 py-2.5 font-medium text-slate-500">Real value</th>
                  </tr>
                </thead>
                <tbody>
                  {yearProjections.map((row) => (
                    <tr key={row.label} className="border-b border-gray-50 last:border-0">
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
                          input.hasInvestments ? row.balanceWithReturnsReal : row.balanceReal,
                          currency,
                          locale,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Economic context */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              Economic context — {macro.countryLabel}
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Illustrative ranges — not live data or advice.
            </p>
            <p className="mt-3 text-sm font-medium text-slate-700">{macro.headline}</p>
            <ul className="mt-3 space-y-2">
              {macro.bullets.map((b) => (
                <li key={b} className="flex gap-3 text-sm leading-relaxed text-slate-600">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" aria-hidden />
                  {b}
                </li>
              ))}
            </ul>
          </div>

          {/* AI explanation (non-ok status only) */}
          {result.status !== "ok" && (
            <div className="border-t border-gray-100 pt-5">
              <Explanation result={result} contextText={explainContext} />
            </div>
          )}

          {/* Your inputs */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              Your inputs
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Tap "edit" to update any answer and recalculate.
            </p>
            <EditableProfileRows rows={profileRows} currentValues={editableParams} />

            <h3 className="mt-6 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              Model estimates
            </h3>
            <dl className="mt-3 space-y-3">
              {estimateRows.map((row) => (
                <div
                  key={row.label}
                  className="flex flex-col gap-0.5 border-b border-gray-50 pb-3 last:border-0 sm:flex-row sm:justify-between sm:gap-4"
                >
                  <dt className="text-sm text-slate-500">{row.label}</dt>
                  <dd className="text-sm font-semibold tabular-nums text-slate-900">{row.value}</dd>
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
  const allSnapshots = resolved?.allSnapshots;
  const updatedAt = resolved?.updatedAt;
  const userRow = resolved?.userRow;
  const checkinJustDone = sp.checkin === "1";
  const token = typeof sp.token === "string" ? sp.token : undefined;
  const result = input ? getFinancialStatus(input) : null;

  // Token gate: if the user has an access token set, require it in the URL.
  // Anonymous users (no token) are never gated.
  if (userId && userRow?.access_token && token !== userRow.access_token) {
    return (
      <main className="pb-10 pt-2">
        <TokenGate userId={userId} />
      </main>
    );
  }

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
          allSnapshots={allSnapshots}
          checkinJustDone={checkinJustDone}
          updatedAt={updatedAt}
          token={token}
        />
      ) : (
        <EmptyState />
      )}
    </main>
  );
}
