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
} from "@/lib/engine";
import { getUserProfile, profileToOnboardingInput, getUser, type UserRow } from "@/lib/profiles";
import { getLatestSnapshot, snapshotMonthLabel, type SnapshotRow } from "@/lib/snapshots";
import {
  computeStaleness,
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
import MonthlyLog from "./monthly-log";
import { getMonthlyAllocations, type MonthlyAllocation } from "@/lib/allocations";
import UserCookieSetter from "./user-cookie-setter";
import DashboardShell from "./dashboard-shell";
import EmptyState from "./empty-state";
import {
  buildCurriculumPath,
  nextLesson,
  pillarProgress,
  type PillarProgress,
} from "@/lib/curriculum";
import { getCompletedSlugs } from "@/lib/lesson-progress";
import {
  PILLAR_LABEL,
  PILLAR_TAGLINE,
  type Lesson,
  type Pillar,
} from "@/lib/lessons/types";

export const metadata = { title: "Your path — FundCalm" };
export const dynamic = "force-dynamic";

const DIAGNOSIS_LABEL: Record<Diagnosis, string> = {
  [Diagnosis.CriticalBuffer]: "Critical buffer",
  [Diagnosis.InsufficientBuffer]: "Insufficient buffer",
  [Diagnosis.LimitedBuffer]: "Limited buffer",
  [Diagnosis.Overinvested]: "Cash short, heavy invested",
  [Diagnosis.TooConservative]: "Heavy on cash",
  [Diagnosis.BalancedButIdle]: "Strong cushion, light long-term",
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

  if (!income || !savings || !savingsRate || !VALID_COUNTRY_CODES.has(country)) {
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
  completed?: Set<string>;
} | null> {
  const cookieStore = await cookies();
  const userId =
    typeof sp.user === "string"
      ? sp.user
      : (cookieStore.get("fundcalm_uid")?.value ?? undefined);
  if (userId) {
    try {
      const [row, snapshot, userRow, allocations, completed] = await Promise.all([
        withTimeout(getUserProfile(userId), 5_000, null),
        withTimeout(getLatestSnapshot(userId), 3_000, null),
        withTimeout(getUser(userId), 3_000, null),
        withTimeout(getMonthlyAllocations(userId), 3_000, []),
        withTimeout(getCompletedSlugs(userId), 3_000, new Set<string>()),
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
          completed,
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

function TokenGate() {
  return (
    <div className="fc-surface mt-10 px-6 py-12 text-center">
      <p className="text-lg font-semibold text-slate-900">Use your email link</p>
      <p className="mt-2 text-sm text-slate-500">
        Your dashboard is protected. Use the link we sent to your email address to access it.
      </p>
      <p className="mt-3 text-xs text-slate-400">
        Can&apos;t find it? Re-enter your email on the onboarding page and we&apos;ll send a new link.
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
        Numbers updated. Your path has been recalculated.
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

// ── Tile 1: Where you are ──
function WhereYouAreTile({
  result,
  fmt,
  targetRunwayMonths,
  primaryFearLabel,
}: {
  result: FinancialResult;
  fmt: (n: number) => string;
  targetRunwayMonths: number;
  primaryFearLabel: string;
}) {
  const m = result.financialMetrics;
  const runwayDisplay = Math.round(m.runway * 10) / 10;
  const targetDisplay = Math.round(targetRunwayMonths * 10) / 10;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-fc-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Where you are
        </span>
      </div>

      <p className="mt-3 text-base font-semibold leading-snug text-slate-900">
        {DIAGNOSIS_LABEL[result.diagnosis]}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Main concern: {primaryFearLabel}
      </p>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <div>
          <dt className="text-slate-400">Runway</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">
            {runwayDisplay} mo
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">Target</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">
            {targetDisplay} mo
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">Gap</dt>
          <dd
            className={`mt-0.5 font-semibold tabular-nums ${m.gap > 0 ? "text-amber-700" : "text-emerald-700"}`}
          >
            {m.gap > 0 ? fmt(m.gap) : "On target"}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-xs leading-relaxed text-slate-600">
        These numbers are the input. Your path below is the curriculum that fits them.
      </p>
    </section>
  );
}

// ── Tile 2: Today's lesson ──
function TodaysLessonTile({
  lesson,
  totalDone,
  totalPath,
  href,
}: {
  lesson: Lesson | null;
  totalDone: number;
  totalPath: number;
  href: string;
}) {
  if (!lesson) {
    return (
      <section className="flex flex-col rounded-2xl border border-emerald-200 bg-emerald-50/60 px-5 py-5 shadow-fc-sm">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
          Today&apos;s lesson
        </span>
        <p className="mt-3 text-base font-semibold text-emerald-900">
          You&apos;ve finished your path.
        </p>
        <p className="mt-1 text-xs leading-relaxed text-emerald-800/80">
          Re-read anything below, or come back after your next check-in for a refreshed path.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col rounded-2xl border-2 border-slate-900 bg-white px-5 py-5 shadow-fc-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
          Today&apos;s lesson
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {totalDone}/{totalPath} done
        </span>
      </div>

      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
        {PILLAR_LABEL[lesson.pillar]} · {lesson.estMinutes} min
      </p>
      <p className="mt-1.5 text-lg font-semibold leading-snug tracking-tight text-slate-900">
        {lesson.title}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{lesson.hook}</p>

      <Link
        href={href}
        className="mt-5 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
      >
        Read it →
      </Link>
    </section>
  );
}

// ── Tile 3: Your path (5 pillars in order) ──
function YourPathTile({ progress }: { progress: PillarProgress[] }) {
  const currentIdx = progress.findIndex((p) => p.completed < p.total);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-fc-sm">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        Your path
      </span>
      <p className="mt-1 text-xs text-slate-500">
        Five pillars, ordered by what your situation calls for first.
      </p>

      <ol className="mt-4 space-y-3">
        {progress.map((p, i) => {
          const isCurrent = i === currentIdx;
          const isDone = p.completed >= p.total;
          const pct = p.total > 0 ? (p.completed / p.total) * 100 : 0;
          return <PillarRow key={p.pillar} progress={p} isCurrent={isCurrent} isDone={isDone} pct={pct} index={i} />;
        })}
      </ol>
    </section>
  );
}

function PillarRow({
  progress,
  isCurrent,
  isDone,
  pct,
  index,
}: {
  progress: PillarProgress;
  isCurrent: boolean;
  isDone: boolean;
  pct: number;
  index: number;
}) {
  const pillar: Pillar = progress.pillar;
  const wrapClass = isCurrent
    ? "rounded-xl border-2 border-slate-900 bg-slate-50/60 px-3 py-2.5"
    : "rounded-xl border border-slate-100 px-3 py-2.5";
  return (
    <li className={wrapClass}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Pillar {index + 1}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900">
            {PILLAR_LABEL[pillar]}{" "}
            <span className="text-xs font-normal text-slate-400">— {PILLAR_TAGLINE[pillar]}</span>
          </p>
        </div>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-700">
          {progress.completed}/{progress.total}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-1.5 rounded-full ${isDone ? "bg-emerald-500" : "bg-slate-900"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </li>
  );
}

const FEAR_LABEL: Record<string, string> = {
  income_loss: "income loss",
  market_crash: "market drops",
  making_mistake: "making a mistake",
  missing_opportunities: "missing out",
};

function PathView({
  result,
  input,
  countryCode,
  userId,
  snapshot,
  allocations,
  checkinJustDone,
  updatedAt,
  token,
  completed,
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
  completed: ReadonlySet<string>;
}) {
  const { currency, locale } = currencyLocaleFromCountryCode(countryCode);
  const m = result.financialMetrics;
  const fmt = (n: number) => fmtCurrency(n, currency, locale);

  const targetRunwayMonths =
    input.monthly_expenses > 0 ? m.required_cash / input.monthly_expenses : 6;

  // Curriculum
  const path = buildCurriculumPath({
    diagnosis: result.diagnosis,
    fear: input.primary_fear,
    completed,
  });
  const next = nextLesson(path, completed);
  const progress = pillarProgress({
    diagnosis: result.diagnosis,
    fear: input.primary_fear,
    completed,
  });
  const totalDone = path.filter((l) => completed.has(l.slug)).length;

  const lessonHref = next
    ? userId
      ? token
        ? `/lesson/${next.slug}?user=${userId}&token=${token}`
        : `/lesson/${next.slug}?user=${userId}`
      : `/lesson/${next.slug}`
    : "#";

  // Staleness banner
  const staleness = updatedAt ? computeStaleness(updatedAt) : null;
  const drift = staleness ? estimateDrift(input, staleness.monthsElapsed) : null;
  const bannerContent = userId
    ? checkinJustDone
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
        })
    : null;

  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-base font-medium text-slate-700">Your path</h1>
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

      <div className="grid gap-4 md:grid-cols-2">
        <WhereYouAreTile
          result={result}
          fmt={fmt}
          targetRunwayMonths={targetRunwayMonths}
          primaryFearLabel={FEAR_LABEL[input.primary_fear] ?? input.primary_fear}
        />
        <TodaysLessonTile
          lesson={next}
          totalDone={totalDone}
          totalPath={path.length}
          href={lessonHref}
        />
      </div>

      <YourPathTile progress={progress} />

      {/* Monthly flow — kept as collapsible. Numbers stay relevant context. */}
      {userId ? (
        <CollapsibleSection
          title="Monthly flow"
          subtitle="Log income, spending, and savings each month — your real numbers feed the path."
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
  const completed = resolved?.completed ?? new Set<string>();
  const checkinJustDone = sp.checkin === "1";
  const token = typeof sp.token === "string" ? sp.token : undefined;
  const result = input ? getFinancialStatus(input) : null;

  if (userId && userRow?.access_token && token !== userRow.access_token) {
    return (
      <main className="pb-10 pt-2">
        <TokenGate />
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
        <PathView
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
          completed={completed}
        />
      </DashboardShell>
    </main>
  );
}
