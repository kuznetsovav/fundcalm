import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
import {
  fromOnboarding,
  getFinancialStatus,
  deriveMetrics,
} from "@/lib/engine";
import { getUserProfile, profileToOnboardingInput, getUser } from "@/lib/profiles";
import { currencyLocaleFromCountryCode } from "@/lib/money-tiers";
import { buildDcaPlan, RISK_BUCKETS } from "@/lib/dca-engine";
import { buildSchedule } from "@/lib/dca-schedule";
import { getDcaPlan } from "@/lib/dca-plans";
import type { DcaInput, RiskBucket } from "@/lib/dca-types";
import DashboardShell from "../dashboard/dashboard-shell";
import EmptyState from "../dashboard/empty-state";
import UserCookieSetter from "../dashboard/user-cookie-setter";
import DcaView from "./dca-view";

export const metadata = { title: "Investment plan — FundCalm" };
export const dynamic = "force-dynamic";

function coerceBucket(raw: unknown): RiskBucket | undefined {
  if (typeof raw !== "string") return undefined;
  return (RISK_BUCKETS as readonly string[]).includes(raw)
    ? (raw as RiskBucket)
    : undefined;
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

function TokenGate() {
  return (
    <div className="fc-surface mt-10 px-6 py-12 text-center">
      <p className="text-lg font-semibold text-slate-900">Use your email link</p>
      <p className="mt-2 text-sm text-slate-500">
        Your investment plan is protected. Use the link we sent to your email to access it.
      </p>
      <Link href="/onboarding" className="fc-btn-primary mt-8">
        Get a new link
      </Link>
    </div>
  );
}

export default async function DcaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const cookieStore = await cookies();
  const userId =
    typeof sp.user === "string"
      ? sp.user
      : (cookieStore.get("fundcalm_uid")?.value ?? undefined);
  const token = typeof sp.token === "string" ? sp.token : undefined;

  if (!userId) {
    return (
      <main className="pb-10 pt-2">
        <DashboardShell hasProfile={false} fallback={<EmptyState />}>
          <Suspense fallback={null}>
            <UserCookieSetter />
          </Suspense>
          <div />
        </DashboardShell>
      </main>
    );
  }

  const [row, userRow, savedPlan] = await Promise.all([
    withTimeout(getUserProfile(userId), 5_000, null),
    withTimeout(getUser(userId), 3_000, null),
    withTimeout(getDcaPlan(userId), 3_000, null),
  ]);

  if (userRow?.access_token && token !== userRow.access_token) {
    return (
      <main className="pb-10 pt-2">
        <TokenGate />
      </main>
    );
  }

  if (!row) {
    return (
      <main className="pb-10 pt-2">
        <div className="fc-surface mt-10 px-6 py-12 text-center">
          <p className="text-lg font-semibold text-slate-900">No profile yet</p>
          <p className="mt-2 text-sm text-slate-500">
            Finish onboarding to see an investment plan tailored to your numbers.
          </p>
          <Link href="/onboarding" className="fc-btn-primary mt-8">
            Start onboarding
          </Link>
        </div>
      </main>
    );
  }

  const onboarding = profileToOnboardingInput(row);
  const input = fromOnboarding(onboarding);
  const result = getFinancialStatus(input);
  const derived = deriveMetrics({
    monthly_expenses: input.monthly_expenses,
    cash_amount: input.cash_amount,
    investments_amount: input.investments_amount,
    incomeStability: input.incomeStability,
    debtPressure: input.debtPressure,
    primaryFear: input.primary_fear,
  });

  const dcaInput: DcaInput = {
    monthly_income: input.monthly_income_estimate,
    monthly_savings_rate: input.monthly_savings_rate,
    cash_amount: input.cash_amount,
    required_cash: derived.required_cash,
    diagnosis: result.diagnosis,
    primary_fear: input.primary_fear,
    incomeStability: input.incomeStability,
  };

  const overrideBucket = coerceBucket(sp.bucket);
  const plan = buildDcaPlan(dcaInput, overrideBucket);
  const isOverride = overrideBucket != null && overrideBucket !== buildDcaPlan(dcaInput).allocation.riskBucket;

  const schedule = plan.amount.monthly_amount != null
    ? buildSchedule(plan.allocation, plan.amount.monthly_amount)
    : [];

  const { currency, locale } = currencyLocaleFromCountryCode(input.countryCode);

  return (
    <main className="pb-10 pt-2">
      <DcaView
        plan={plan}
        schedule={schedule}
        currency={currency}
        locale={locale}
        userId={userId}
        token={token}
        diagnosis={result.diagnosis}
        primaryFear={input.primary_fear}
        isOverride={isOverride}
        savedAt={savedPlan?.updated_at ?? null}
        savedBucket={savedPlan?.risk_bucket ?? null}
        savedAmount={savedPlan?.monthly_amount ?? null}
      />
    </main>
  );
}
