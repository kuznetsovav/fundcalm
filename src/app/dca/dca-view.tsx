"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { DcaPlan, RiskBucket, ScheduledPurchase } from "@/lib/dca-types";
import type { Diagnosis, PrimaryFear } from "@/lib/diagnosis-engine";
import type { EtfQuote } from "@/lib/dca-quotes";
import { RISK_BUCKETS } from "@/lib/dca-engine";
import AllocationDonut from "./allocation-donut";
import EtfCard from "./etf-card";
import ScheduleCalendar from "./schedule-calendar";
import ExplainButton from "./explain-button";

const BUCKET_LABEL: Record<RiskBucket, string> = {
  conservative: "Conservative",
  balanced: "Balanced",
  growth: "Growth",
};

const BUCKET_SUBLABEL: Record<RiskBucket, string> = {
  conservative: "More bonds, smaller swings",
  balanced: "Standard global mix",
  growth: "Mostly equities, longer horizon",
};

const AMOUNT_MODE_LABEL = {
  surplus: "From your cash surplus",
  savings_rate: "From your savings rate",
  symbolic: "Habit-building amount",
  deferred: "Plan for later",
} as const;

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function DcaView({
  plan,
  schedule,
  currency,
  locale,
  userId,
  token,
  diagnosis,
  primaryFear,
  isOverride,
  savedAt: initialSavedAt,
  savedBucket,
  savedAmount,
}: {
  plan: DcaPlan;
  schedule: ScheduledPurchase[];
  currency: string;
  locale: string;
  userId: string;
  token?: string;
  diagnosis: Diagnosis;
  primaryFear: PrimaryFear;
  isOverride: boolean;
  savedAt: string | null;
  savedBucket: RiskBucket | null;
  savedAmount: number | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [savedAt, setSavedAt] = useState<string | null>(initialSavedAt);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const tickerKey = plan.allocation.slices.map((s) => s.ticker).join(",");
  const [quotes, setQuotes] = useState<Record<string, EtfQuote>>({});
  const [quotesLoading, setQuotesLoading] = useState(true);

  const planDiffersFromSaved =
    savedBucket !== plan.allocation.riskBucket ||
    savedAmount !== plan.amount.monthly_amount;

  useEffect(() => {
    let cancelled = false;
    setQuotesLoading(true);
    fetch(`/api/dca/quotes?tickers=${encodeURIComponent(tickerKey)}`)
      .then((r) => (r.ok ? r.json() : { quotes: [] }))
      .then((data: { quotes: EtfQuote[] }) => {
        if (cancelled) return;
        const map: Record<string, EtfQuote> = {};
        for (const q of data.quotes ?? []) map[q.ticker] = q;
        setQuotes(map);
      })
      .catch(() => {
        if (!cancelled) setQuotes({});
      })
      .finally(() => {
        if (!cancelled) setQuotesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tickerKey]);

  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Math.round(Math.abs(n)));

  const activeBucket = plan.allocation.riskBucket;
  const amount = plan.amount;

  function selectBucket(bucket: RiskBucket) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("bucket", bucket);
    if (userId) params.set("user", userId);
    if (token) params.set("token", token);
    startTransition(() => {
      router.replace(`/dca?${params.toString()}`, { scroll: false });
    });
  }

  function resetBucket() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("bucket");
    if (userId) params.set("user", userId);
    if (token) params.set("token", token);
    startTransition(() => {
      router.replace(`/dca?${params.toString()}`, { scroll: false });
    });
  }

  async function savePlan() {
    if (plan.amount.monthly_amount == null) return;
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/dca/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          monthly_amount: plan.amount.monthly_amount,
          risk_bucket: plan.allocation.riskBucket,
          allocation: plan.allocation,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { plan: { updated_at: string } };
      setSavedAt(data.plan.updated_at);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }

  const dashboardHref = token
    ? `/dashboard?user=${userId}&token=${token}`
    : `/dashboard?user=${userId}`;

  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-base font-medium text-slate-700">
          Investment plan
        </h1>
        <Link href={dashboardHref} className="fc-link-muted shrink-0">
          ← Dashboard
        </Link>
      </header>

      {/* ── Suggested amount tile ── */}
      <section className="fc-surface px-5 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {AMOUNT_MODE_LABEL[amount.mode]}
        </p>

        {amount.monthly_amount != null ? (
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-bold tabular-nums leading-none text-slate-900">
              {fmt(amount.monthly_amount)}
            </span>
            <span className="text-sm text-slate-500">per month</span>
          </div>
        ) : (
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            Focus on cash buffer first
          </p>
        )}

        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {amount.rationale}
        </p>

        {amount.monthly_amount != null && (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
            <div className="min-w-0 text-xs text-slate-500">
              {savedAt == null ? (
                <span>No plan saved yet.</span>
              ) : planDiffersFromSaved ? (
                <span>
                  Saved plan differs ({savedBucket}, {fmt(savedAmount ?? 0)}). Save to overwrite.
                </span>
              ) : (
                <span>
                  Saved {new Date(savedAt).toLocaleDateString(locale)}.
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={savePlan}
              disabled={saveStatus === "saving" || (savedAt != null && !planDiffersFromSaved)}
              className="fc-btn-secondary shrink-0 text-sm"
            >
              {saveStatus === "saving"
                ? "Saving…"
                : saveStatus === "saved"
                  ? "Saved ✓"
                  : saveStatus === "error"
                    ? "Retry"
                    : savedAt == null
                      ? "Save plan"
                      : "Update saved plan"}
            </button>
          </div>
        )}
      </section>

      {/* ── Risk bucket selector ── */}
      <section className="fc-surface px-5 py-5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Risk profile
          </p>
          {isOverride && (
            <button
              type="button"
              onClick={resetBucket}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Reset to auto
            </button>
          )}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {RISK_BUCKETS.map((b) => {
            const active = b === activeBucket;
            return (
              <button
                key={b}
                type="button"
                onClick={() => selectBucket(b)}
                disabled={pending}
                aria-pressed={active}
                className={`fc-option text-left ${active ? "fc-option-selected" : ""} ${pending ? "opacity-60" : ""}`}
              >
                <p className="text-sm font-semibold text-slate-900">
                  {BUCKET_LABEL[b]}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {BUCKET_SUBLABEL[b]}
                </p>
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          {plan.allocation.rationale}
        </p>
      </section>

      {/* ── Allocation + ETF list ── */}
      <section className="fc-surface px-5 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Allocation
        </p>

        <div className="mt-4 grid gap-6 md:grid-cols-[180px_minmax(0,1fr)] md:items-start">
          <AllocationDonut slices={plan.allocation.slices} />
          <div className="space-y-3">
            {plan.allocation.slices.map((s) => (
              <EtfCard
                key={s.ticker}
                ticker={s.ticker}
                weight={s.weight}
                quote={quotes[s.ticker]}
                loading={quotesLoading && !quotes[s.ticker]}
              />
            ))}
          </div>
        </div>

        <p className="mt-4 border-t border-gray-100 pt-4 text-sm leading-relaxed text-slate-600">
          {plan.fearNote}
        </p>
      </section>

      {/* ── Schedule ── */}
      <section className="fc-surface px-5 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Schedule
        </p>

        {amount.monthly_amount != null ? (
          <div className="mt-4">
            <p className="text-sm text-slate-600">
              Buying on the 15th of each month spreads your entry across the year — no need to time anything.
            </p>
            <div className="mt-4">
              <ScheduleCalendar schedule={schedule} fmt={fmt} />
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Once your cash buffer is at target, this section will show a 12-month purchase schedule. The allocation above is here so you can think about it ahead of time.
          </p>
        )}
      </section>

      {/* ── AI explanation ── */}
      <section className="fc-surface px-5 py-5">
        <ExplainButton
          plan={plan}
          currency={currency}
          primary_fear={primaryFear}
          diagnosis={diagnosis}
        />
      </section>

      <Link href={dashboardHref} className="fc-link-muted inline-block py-2">
        ← Back to dashboard
      </Link>
    </div>
  );
}
