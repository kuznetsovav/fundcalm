"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { countryMeta } from "@/lib/countries";
import {
  incomeFromSliderPosition,
  incomeOpenThresholdLocal,
  incomeSliderPositionFromTier,
  incomeTierFromLocalMonthly,
  incomeTierMid,
  savingsOpenThresholdLocal,
  savingsSliderPositionFromTier,
  savingsTierFromLocalTotal,
  totalSavingsFromSliderPosition,
  savingsRateFromSliderPosition,
  savingsRateSliderPositionFromKey,
  nearestSavingsRateKey,
  SAVINGS_RATE_SLIDER_RAMP_FRACTION,
  currencyLocaleFromCountryCode,
  minMonthlyExpenseFloor,
} from "@/lib/money-tiers";
import {
  coerceIncomeRange,
  coerceSavingsRange,
  coerceSavingsRateRange,
} from "@/lib/onboarding-legacy";
import type { IncomeRange, SavingsRange, SavingsRateRange, SavingsMix, IncomeStability, MortgagePressure } from "@/lib/engine";

const RAMP = 5000;

interface ProfileState {
  userId: string;
  income: IncomeRange;
  savings: SavingsRange;
  savingsRate: SavingsRateRange;
  country: string;
  savingsMix: SavingsMix;
  incomeStability: IncomeStability;
  mortgagePressure: MortgagePressure;
  primaryFear?: string;
  expensesOverride?: number | null;
}

type CheckinStep = "income" | "savings" | "savingsRate" | "expenses" | "confirm";

const STEP_ORDER: CheckinStep[] = ["income", "savings", "savingsRate", "expenses", "confirm"];

export default function CheckinPage() {
  return (
    <Suspense fallback={<main className="pb-8"><div className="mt-20 text-center text-sm text-slate-500">Loading…</div></main>}>
      <CheckinContent />
    </Suspense>
  );
}

function CheckinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("user") ?? "";
  const token = searchParams.get("token") ?? undefined;

  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<CheckinStep>("income");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Editable slider state
  const [incomeSliderPos, setIncomeSliderPos] = useState(RAMP / 2);
  const [savingsSliderPos, setSavingsSliderPos] = useState(RAMP / 2);
  const [savingsRateSliderPos, setSavingsRateSliderPos] = useState(RAMP / 2);
  const [expensesSliderPos, setExpensesSliderPos] = useState(RAMP / 2);

  // Derived display values
  const [editedIncome, setEditedIncome] = useState<IncomeRange | null>(null);
  const [editedSavings, setEditedSavings] = useState<SavingsRange | null>(null);
  const [editedSavingsRate, setEditedSavingsRate] = useState<SavingsRateRange | null>(null);
  const [editedExpenses, setEditedExpenses] = useState<number | null>(null);

  const profileRef = useRef<ProfileState | null>(null);
  profileRef.current = profile;

  useEffect(() => {
    if (!userId) return;

    async function loadProfile() {
      try {
        const res = await fetch(`/api/profile/${userId}`);
        if (!res.ok) throw new Error("Profile not found");
        const data = await res.json();
        const p: ProfileState = data;
        setProfile(p);

        const cur = countryMeta(p.country).currency;

        const incPos = incomeSliderPositionFromTier(cur, p.income, RAMP);
        setIncomeSliderPos(incPos);
        setEditedIncome(p.income);

        const savPos = savingsSliderPositionFromTier(cur, p.savings, RAMP);
        setSavingsSliderPos(savPos);
        setEditedSavings(p.savings);

        const ratePos = savingsRateSliderPositionFromKey(p.savingsRate, RAMP);
        setSavingsRateSliderPos(ratePos);
        setEditedSavingsRate(p.savingsRate);

        // Expenses: use stored override or derive from income × (1 - savingsRate)
        if (p.expensesOverride != null) {
          const derived = p.expensesOverride;
          setEditedExpenses(derived);
          // Rough slider position: linear in 0–RAMP, capped at a local max
          const maxExpenses = incomeTierMid(cur, p.income) * 1.2;
          const pos = Math.round(Math.min(1, derived / maxExpenses) * RAMP);
          setExpensesSliderPos(pos);
        }
      } catch {
        setLoadError("We couldn't load your profile. Check the link and try again.");
      }
    }

    void loadProfile();
  }, [userId]);

  const moneyFmt = useMemo(() => {
    const country = profile?.country ?? "US";
    const m = countryMeta(country);
    return new Intl.NumberFormat(m.locale, {
      style: "currency",
      currency: m.currency,
      maximumFractionDigits: 0,
    });
  }, [profile?.country]);

  const currency = useMemo(() => {
    return countryMeta(profile?.country ?? "US").currency;
  }, [profile?.country]);

  function applyIncomeSlider(pos: number) {
    const { monthlyLocal, openEnded } = incomeFromSliderPosition(currency, pos, RAMP);
    setIncomeSliderPos(pos);
    setEditedIncome(incomeTierFromLocalMonthly(profile!.country, monthlyLocal, openEnded));
  }

  function applySavingsSlider(pos: number) {
    const { localAmount, openEnded } = totalSavingsFromSliderPosition(currency, pos, RAMP);
    setSavingsSliderPos(pos);
    setEditedSavings(savingsTierFromLocalTotal(profile!.country, localAmount, openEnded));
  }

  function applySavingsRateSlider(pos: number) {
    const { rate, openEnded } = savingsRateFromSliderPosition(pos, RAMP);
    const key = openEnded ? "r38p" : nearestSavingsRateKey(rate);
    setSavingsRateSliderPos(pos);
    setEditedSavingsRate(key);
  }

  async function handleSubmit() {
    if (!profile) return;
    setSaving(true);
    setSaveError(null);

    const payload: Record<string, unknown> = {
      userId,
      income: editedIncome ?? profile.income,
      savings: editedSavings ?? profile.savings,
      savingsRate: editedSavingsRate ?? profile.savingsRate,
      country: profile.country,
      savingsMix: profile.savingsMix,
      incomeStability: profile.incomeStability,
      mortgagePressure: profile.mortgagePressure,
      primaryFear: profile.primaryFear,
    };
    if (editedExpenses != null) payload.expensesOverride = editedExpenses;

    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Check-in failed");
      const redirect = token
        ? `/dashboard?user=${userId}&checkin=1&token=${token}`
        : `/dashboard?user=${userId}&checkin=1`;
      router.push(redirect);
    } catch {
      setSaveError("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  const stepIndex = STEP_ORDER.indexOf(step);

  if (!userId) {
    return (
      <main className="pb-8">
        <div className="fc-surface mt-10 px-6 py-12 text-center">
          <p className="text-lg font-semibold text-slate-900">No profile found</p>
          <p className="mt-2 text-sm text-slate-500">Use the link from your dashboard or welcome email.</p>
          <Link href="/" className="fc-btn-primary mt-8">Go home</Link>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="pb-8">
        <div className="fc-surface mt-10 px-6 py-12 text-center">
          <p className="text-lg font-semibold text-slate-900">Couldn't load profile</p>
          <p className="mt-2 text-sm text-slate-500">{loadError}</p>
          <Link href="/onboarding" className="fc-btn-primary mt-8">Start fresh</Link>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="pb-8">
        <div className="mt-20 text-center text-sm text-slate-500">Loading your profile…</div>
      </main>
    );
  }

  const incomeDisplay = (() => {
    const { monthlyLocal, openEnded } = incomeFromSliderPosition(currency, incomeSliderPos, RAMP);
    const threshold = incomeOpenThresholdLocal(currency);
    return openEnded
      ? `More than ${moneyFmt.format(threshold)} / mo`
      : `${moneyFmt.format(Math.round(monthlyLocal))} / mo`;
  })();

  const savingsDisplay = (() => {
    const { localAmount, openEnded } = totalSavingsFromSliderPosition(currency, savingsSliderPos, RAMP);
    const threshold = savingsOpenThresholdLocal(currency);
    return openEnded
      ? `More than ${moneyFmt.format(threshold)}`
      : moneyFmt.format(Math.round(localAmount));
  })();

  const savingsRateDisplay = (() => {
    const { rate, openEnded } = savingsRateFromSliderPosition(savingsRateSliderPos, RAMP);
    const pct = Math.round((openEnded ? SAVINGS_RATE_SLIDER_RAMP_FRACTION : rate) * 100);
    return openEnded ? `More than ${Math.round(SAVINGS_RATE_SLIDER_RAMP_FRACTION * 100)}%` : `${pct}%`;
  })();

  // Expenses: slider range 0–RAMP maps to floor–2×income
  const incomeAmount = (() => {
    const { monthlyLocal } = incomeFromSliderPosition(currency, incomeSliderPos, RAMP);
    return monthlyLocal;
  })();
  const expensesMax = Math.max(minMonthlyExpenseFloor(currency) * 4, incomeAmount * 1.5);
  const expensesValue = Math.max(
    minMonthlyExpenseFloor(currency),
    Math.round((expensesSliderPos / RAMP) * expensesMax),
  );
  const expensesDisplay = `${moneyFmt.format(expensesValue)} / mo`;

  function applyExpensesSlider(pos: number) {
    setExpensesSliderPos(pos);
    const val = Math.max(minMonthlyExpenseFloor(currency), Math.round((pos / RAMP) * expensesMax));
    setEditedExpenses(val);
  }

  // Confirm rows include expenses if the user explicitly set it
  const confirmRows = [
    { label: "Monthly income", value: incomeDisplay },
    { label: "Total savings", value: savingsDisplay },
    { label: "Savings rate", value: savingsRateDisplay },
    ...(editedExpenses != null ? [{ label: "Monthly expenses", value: expensesDisplay }] : []),
  ];

  const progressPct = ((stepIndex + 1) / STEP_ORDER.length) * 100;

  return (
    <main className="pb-8">
      <div className="fc-progress-bar">
        <div className="fc-progress-bar-fill" style={{ width: `${progressPct}%` }} />
      </div>

      <p className="fc-eyebrow mt-4">
        {step === "confirm" ? "Review & update" : `Quick check-in — ${stepIndex + 1} of ${STEP_ORDER.length - 1}`}
      </p>

      <div className="fc-onboarding-card mt-5">
        {step === "income" && (
          <>
            <h1 className="fc-title-lg text-center">Has your monthly income changed?</h1>
            <p className="mt-2 text-center text-[15px] leading-relaxed text-slate-500">
              Drag to update your take-home pay after tax.
            </p>
            <div className="mt-8 space-y-6">
              <div className="fc-onboarding-well px-2">
                <p className="text-center text-3xl font-semibold tabular-nums tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
                  {incomeDisplay}
                </p>
              </div>
              <div className="fc-onboarding-range-wrap">
                <input
                  type="range"
                  min={0}
                  max={RAMP}
                  step={1}
                  value={incomeSliderPos}
                  onInput={(e) => applyIncomeSlider(Number((e.target as HTMLInputElement).value))}
                  onChange={(e) => applyIncomeSlider(Number(e.target.value))}
                  className="fc-onboarding-range w-full"
                  style={{ touchAction: "none" }}
                  aria-label="Monthly income"
                />
              </div>
              <div className="flex justify-between text-xs tabular-nums text-slate-500">
                <span>0</span>
                <span>More than {moneyFmt.format(incomeOpenThresholdLocal(currency))}</span>
              </div>
            </div>
          </>
        )}

        {step === "savings" && (
          <>
            <h1 className="fc-title-lg text-center">How about your total savings?</h1>
            <p className="mt-2 text-center text-[15px] leading-relaxed text-slate-500">
              Cash plus any investments — your overall savings picture.
            </p>
            <div className="mt-8 space-y-6">
              <div className="fc-onboarding-well px-2">
                <p className="text-center text-3xl font-semibold tabular-nums tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
                  {savingsDisplay}
                </p>
              </div>
              <div className="fc-onboarding-range-wrap">
                <input
                  type="range"
                  min={0}
                  max={RAMP}
                  step={1}
                  value={savingsSliderPos}
                  onInput={(e) => applySavingsSlider(Number((e.target as HTMLInputElement).value))}
                  onChange={(e) => applySavingsSlider(Number(e.target.value))}
                  className="fc-onboarding-range w-full"
                  style={{ touchAction: "none" }}
                  aria-label="Total savings"
                />
              </div>
              <div className="flex justify-between text-xs tabular-nums text-slate-500">
                <span>0</span>
                <span>More than {moneyFmt.format(savingsOpenThresholdLocal(currency))}</span>
              </div>
            </div>
          </>
        )}

        {step === "savingsRate" && (
          <>
            <h1 className="fc-title-lg text-center">How much are you saving each month?</h1>
            <p className="mt-2 text-center text-[15px] leading-relaxed text-slate-500">
              As a share of your take-home pay.
            </p>
            <div className="mt-8 space-y-6">
              <div className="fc-onboarding-well px-2">
                <p className="text-center text-3xl font-semibold tabular-nums tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
                  {savingsRateDisplay}
                </p>
                <p className="mt-2 text-center text-xs text-slate-500">of monthly take-home</p>
              </div>
              <div className="fc-onboarding-range-wrap">
                <input
                  type="range"
                  min={0}
                  max={RAMP}
                  step={1}
                  value={savingsRateSliderPos}
                  onInput={(e) => applySavingsRateSlider(Number((e.target as HTMLInputElement).value))}
                  onChange={(e) => applySavingsRateSlider(Number(e.target.value))}
                  className="fc-onboarding-range w-full"
                  style={{ touchAction: "none" }}
                  aria-label="Monthly savings rate"
                />
              </div>
              <div className="flex justify-between text-xs tabular-nums text-slate-500">
                <span>0%</span>
                <span>More than {Math.round(SAVINGS_RATE_SLIDER_RAMP_FRACTION * 100)}%</span>
              </div>
            </div>
          </>
        )}

        {step === "expenses" && (
          <>
            <h1 className="fc-title-lg text-center">What are your monthly expenses?</h1>
            <p className="mt-2 text-center text-[15px] leading-relaxed text-slate-500">
              Total spending per month — rent, food, subscriptions, everything. This sharpens your runway calculation.
            </p>
            <div className="mt-8 space-y-6">
              <div className="fc-onboarding-well px-2">
                <p className="text-center text-3xl font-semibold tabular-nums tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
                  {expensesDisplay}
                </p>
              </div>
              <div className="fc-onboarding-range-wrap">
                <input
                  type="range"
                  min={0}
                  max={RAMP}
                  step={1}
                  value={expensesSliderPos}
                  onInput={(e) => applyExpensesSlider(Number((e.target as HTMLInputElement).value))}
                  onChange={(e) => applyExpensesSlider(Number(e.target.value))}
                  className="fc-onboarding-range w-full"
                  style={{ touchAction: "none" }}
                  aria-label="Monthly expenses"
                />
              </div>
              <div className="flex justify-between text-xs tabular-nums text-slate-500">
                <span>{moneyFmt.format(minMonthlyExpenseFloor(currency))}</span>
                <span>{moneyFmt.format(Math.round(expensesMax))}</span>
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-slate-400">
              Optional — skip if you're not sure. We'll estimate from your income and savings rate.
            </p>
          </>
        )}

        {step === "confirm" && (
          <>
            <h1 className="fc-title-lg text-center">Looks good?</h1>
            <p className="mt-2 text-center text-[15px] leading-relaxed text-slate-500">
              We'll save these as your updated numbers and recalculate your dashboard.
            </p>
            <div className="mt-6 space-y-2">
              {confirmRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3"
                >
                  <span className="text-sm text-slate-500">{row.label}</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-900">{row.value}</span>
                </div>
              ))}
            </div>
            {saveError && (
              <p className="mt-4 text-center text-sm text-red-600">{saveError}</p>
            )}
          </>
        )}

        <div className="mt-10 flex gap-3">
          {step === "income" ? (
            <Link
              href={token ? `/dashboard?user=${userId}&token=${token}` : `/dashboard?user=${userId}`}
              className="fc-btn-secondary"
            >
              Cancel
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setStep(STEP_ORDER[stepIndex - 1])}
              className="fc-btn-secondary"
            >
              Back
            </button>
          )}
          {step === "confirm" ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className={saving ? "flex min-w-0 flex-1 cursor-not-allowed items-center justify-center rounded-xl bg-gray-200 py-3.5 text-sm font-semibold text-gray-400" : "fc-btn-primary-block min-w-0 flex-1 rounded-xl"}
            >
              {saving ? "Saving…" : "Update my numbers"}
            </button>
          ) : step === "expenses" ? (
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <button
                type="button"
                onClick={() => setStep(STEP_ORDER[stepIndex + 1])}
                className="fc-btn-primary-block w-full rounded-xl"
              >
                {editedExpenses != null ? "Continue" : "Skip"}
              </button>
              {editedExpenses != null && (
                <button
                  type="button"
                  onClick={() => { setEditedExpenses(null); setStep(STEP_ORDER[stepIndex + 1]); }}
                  className="text-center text-xs text-slate-400 underline underline-offset-2 hover:text-slate-600"
                >
                  Skip — use estimated expenses
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setStep(STEP_ORDER[stepIndex + 1])}
              className="fc-btn-primary-block min-w-0 flex-1 rounded-xl"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
