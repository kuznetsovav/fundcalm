"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  SavingsMix,
  SavingsRange,
  IncomeRange,
  PrimaryFear,
} from "@/lib/engine";
import { COUNTRY_OPTIONS, countryMeta, VALID_COUNTRY_CODES } from "@/lib/countries";
import {
  incomeFromSliderPosition,
  incomeOpenThresholdLocal,
  incomeSliderPositionFromTier,
  incomeTierBoundsLocal,
  incomeTierFromLocalMonthly,
  incomeTierMid,
  nearestSavingsRateKey,
  savingsOpenThresholdLocal,
  savingsRateFromSliderPosition,
  savingsRateSliderPositionFromKey,
  SAVINGS_RATE_SLIDER_RAMP_FRACTION,
  savingsSliderPositionFromTier,
  savingsTierFromLocalTotal,
  savingsTierMid,
  totalSavingsFromSliderPosition,
} from "@/lib/money-tiers";
import {
  coerceIncomeRange,
  coerceSavingsRange,
  coerceSavingsRateRange,
} from "@/lib/onboarding-legacy";

type StepKey =
  | "country"
  | "income"
  | "savingsRate"
  | "savings"
  | "savingsMix"
  | "incomeStability"
  | "primaryFear"
  | "mortgage";

const ORDER: StepKey[] = [
  "country",
  "income",
  "savingsRate",
  "savings",
  "savingsMix",
  "incomeStability",
  "primaryFear",
  "mortgage",
];

const STEPS: Record<StepKey, { title: string; hint?: string }> = {
  country: {
    title: "Where do you live?",
    hint: "Choose your country—we use it for currency and context on your dashboard.",
  },
  income: {
    title: "Earn after taxes",
    hint: "Drag smoothly from zero up, or pick “more than” if exact pay doesn’t matter for your plan.",
  },
  savingsRate: {
    title: "Save monthly",
    hint: "Drag to match what you usually save or invest from take-home—the % and typical monthly amount move together.",
  },
  savings: {
    title: "Total savings",
    hint: "Drag from zero up, or choose “more than” if the exact total doesn’t matter for your plan.",
  },
  savingsMix: {
    title: "Money allocation",
    hint: "How is your money distributed? Adjust sliders; amounts update from your savings total.",
  },
  incomeStability: {
    title: "Concern",
    hint: "What best describes your income lately?",
  },
  primaryFear: {
    title: "Main worry",
    hint: "Pick what matches you most—we use it only to shape how we talk about your numbers.",
  },
  mortgage: {
    title: "Housing",
    hint: "How does rent or mortgage fit in your budget?",
  },
};

const STABILITY_OPTIONS = [
  { value: "steady", label: "Fairly steady month to month" },
  {
    value: "variable_flat",
    label: "It varies — no clear up or down lately",
  },
  {
    value: "variable_improving",
    label: "It varies — lately moving in a better direction",
  },
  {
    value: "variable_worsening",
    label: "It varies — lately getting tighter",
  },
  { value: "irregular", label: "Hard to predict" },
] as const;

const PRIMARY_FEAR_OPTIONS: { value: PrimaryFear; label: string }[] = [
  { value: "income_loss", label: "Income stopping or dropping" },
  { value: "market_crash", label: "A big drop in invested savings" },
  { value: "making_mistake", label: "Doing the wrong thing with money" },
  { value: "missing_opportunities", label: "Missing chances to grow savings" },
];

const MORTGAGE_OPTIONS = [
  {
    value: "housing_clear",
    label: "Rent or own outright — housing isn’t a major strain",
  },
  {
    value: "housing_ok",
    label: "Mortgage or rent feels comfortable in my budget",
  },
  {
    value: "housing_tight",
    label: "Housing takes a noticeable slice of the budget",
  },
  {
    value: "housing_heavy",
    label: "Housing is a serious squeeze",
  },
] as const;

const SAVINGS_MIX_OPTIONS = [
  { value: "all_cash", label: "All in cash or savings accounts" },
  { value: "mostly_cash", label: "Mostly cash, a little invested" },
  { value: "balanced", label: "Roughly half cash, half invested" },
  { value: "mostly_invested", label: "Mostly invested, some cash" },
  { value: "almost_all_invested", label: "Almost everything invested" },
];

const MIX_TRIPLETS: Record<SavingsMix, [number, number]> = {
  all_cash: [100, 0],
  mostly_cash: [85, 15],
  balanced: [55, 45],
  mostly_invested: [30, 70],
  almost_all_invested: [12, 88],
};

const MIX_CASH_RATIO: Record<SavingsMix, number> = {
  all_cash: 1,
  mostly_cash: 0.85,
  balanced: 0.55,
  mostly_invested: 0.3,
  almost_all_invested: 0.12,
};

const MIX_ORDER: SavingsMix[] = [
  "all_cash",
  "mostly_cash",
  "balanced",
  "mostly_invested",
  "almost_all_invested",
];

function nearestSavingsMix(c: number, i: number): SavingsMix {
  const t = c + i;
  if (t <= 0) return "balanced";
  const r = c / t;
  let best: SavingsMix = "balanced";
  let bestD = Infinity;
  for (const m of MIX_ORDER) {
    const d = Math.abs(r - MIX_CASH_RATIO[m]);
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}

function clampInt(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function rebalance(
  which: 0 | 1,
  next: number,
  prev: [number, number],
): [number, number] {
  let [c, iv] = prev;
  next = clampInt(next, 0, 100);
  if (which === 0) {
    c = next;
    iv = 100 - c;
    return [c, iv];
  }
  iv = next;
  c = 100 - iv;
  return [c, iv];
}

type FormData = Record<StepKey, string>;

const EMPTY: FormData = {
  country: "",
  income: "",
  savingsRate: "",
  savings: "",
  savingsMix: "",
  incomeStability: "",
  primaryFear: "",
  mortgage: "",
};

/**
 * Shared ramp: 0..rampMax-1 = linear scale; rampMax = top “more than” step
 * (income, total savings) or “above ~42%” (save monthly).
 */
const ONBOARDING_SLIDER_RAMP_MAX = 5000;

const INCOME_SLIDER_RAMP_MAX = ONBOARDING_SLIDER_RAMP_MAX;
const SAVINGS_RATE_SLIDER_RAMP_MAX = ONBOARDING_SLIDER_RAMP_MAX;
const TOTAL_SAVINGS_SLIDER_RAMP_MAX = ONBOARDING_SLIDER_RAMP_MAX;

export default function Onboarding() {
  const router = useRouter();
  const [stepKey, setStepKey] = useState<StepKey>("country");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FormData>({ ...EMPTY });
  const [countryQuery, setCountryQuery] = useState("");
  const [alloc, setAlloc] = useState<[number, number]>(
    MIX_TRIPLETS.balanced,
  );
  const [incomeSliderPos, setIncomeSliderPos] = useState(
    Math.round(INCOME_SLIDER_RAMP_MAX / 2),
  );
  const [savingsRateSliderPos, setSavingsRateSliderPos] = useState(
    Math.round(SAVINGS_RATE_SLIDER_RAMP_MAX / 2),
  );
  const [savingsSliderPos, setSavingsSliderPos] = useState(
    Math.round(TOTAL_SAVINGS_SLIDER_RAMP_MAX / 2),
  );
  const prevStepRef = useRef<StepKey | null>(null);
  const incomeStepPrimedRef = useRef(false);
  const savingsRateStepPrimedRef = useRef(false);
  const savingsTotalStepPrimedRef = useRef(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  const moneyFmt = useMemo(() => {
    const m = countryMeta(data.country || "OTHER");
    return new Intl.NumberFormat(m.locale, {
      style: "currency",
      currency: m.currency,
      maximumFractionDigits: 0,
    });
  }, [data.country]);

  const countryKey = data.country || "OTHER";

  const optionsByStep = useMemo((): Record<
    StepKey,
    { value: string; label: string; sub?: string }[]
  > => {
    return {
      country: [],
      income: [],
      savingsRate: [],
      savings: [],
      savingsMix: SAVINGS_MIX_OPTIONS,
      incomeStability: [...STABILITY_OPTIONS],
      primaryFear: PRIMARY_FEAR_OPTIONS.map((o) => ({
        value: o.value,
        label: o.label,
      })),
      mortgage: [...MORTGAGE_OPTIONS],
    };
  }, []);

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return COUNTRY_OPTIONS;
    return COUNTRY_OPTIONS.filter(
      (c) =>
        c.label.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [countryQuery]);

  const visible = useMemo(() => ORDER, []);
  const stepIndex = visible.indexOf(stepKey);
  const safeIndex = stepIndex >= 0 ? stepIndex : 0;
  const currentKey = visible[safeIndex] ?? "country";
  const value = data[currentKey];
  const options = optionsByStep[currentKey];
  const isLast = safeIndex === visible.length - 1;
  const totalSteps = visible.length;
  const progressPct = ((safeIndex + 1) / totalSteps) * 100;

  const totalSavingsEstimate = useMemo(() => {
    const cur = countryMeta(countryKey).currency;
    const sav =
      coerceSavingsRange(data.savings) ?? ("10k-25k" as SavingsRange);
    return savingsTierMid(cur, sav);
  }, [countryKey, data.savings]);

  useLayoutEffect(() => {
    if (currentKey !== "income") {
      incomeStepPrimedRef.current = false;
      return;
    }
    if (incomeStepPrimedRef.current) return;
    incomeStepPrimedRef.current = true;

    const cur = countryMeta(countryKey).currency;
    const existing = dataRef.current.income;
    if (existing === "") {
      const p = Math.round(INCOME_SLIDER_RAMP_MAX / 2);
      setIncomeSliderPos(p);
      const { monthlyLocal, openEnded } = incomeFromSliderPosition(
        cur,
        p,
        INCOME_SLIDER_RAMP_MAX,
      );
      setData((prev) => ({
        ...prev,
        income: incomeTierFromLocalMonthly(
          countryKey,
          monthlyLocal,
          openEnded,
        ),
      }));
    } else {
      const t = coerceIncomeRange(existing);
      if (t) {
        setIncomeSliderPos(
          incomeSliderPositionFromTier(cur, t, INCOME_SLIDER_RAMP_MAX),
        );
      }
    }
  }, [currentKey, countryKey]);

  useLayoutEffect(() => {
    if (currentKey !== "savingsRate") {
      savingsRateStepPrimedRef.current = false;
      return;
    }
    if (savingsRateStepPrimedRef.current) return;
    savingsRateStepPrimedRef.current = true;

    const existing = dataRef.current.savingsRate;
    if (existing === "") {
      const p = Math.round(SAVINGS_RATE_SLIDER_RAMP_MAX / 2);
      setSavingsRateSliderPos(p);
      const { rate, openEnded } = savingsRateFromSliderPosition(
        p,
        SAVINGS_RATE_SLIDER_RAMP_MAX,
      );
      const key = openEnded ? "r38p" : nearestSavingsRateKey(rate);
      setData((prev) => ({ ...prev, savingsRate: key }));
    } else {
      const k = coerceSavingsRateRange(existing);
      if (k) {
        setSavingsRateSliderPos(
          savingsRateSliderPositionFromKey(k, SAVINGS_RATE_SLIDER_RAMP_MAX),
        );
      }
    }
  }, [currentKey]);

  useLayoutEffect(() => {
    if (currentKey !== "savings") {
      savingsTotalStepPrimedRef.current = false;
      return;
    }
    if (savingsTotalStepPrimedRef.current) return;
    savingsTotalStepPrimedRef.current = true;

    const cur = countryMeta(countryKey).currency;
    const existing = dataRef.current.savings;
    if (existing === "") {
      const p = Math.round(TOTAL_SAVINGS_SLIDER_RAMP_MAX / 2);
      setSavingsSliderPos(p);
      const { localAmount, openEnded } = totalSavingsFromSliderPosition(
        cur,
        p,
        TOTAL_SAVINGS_SLIDER_RAMP_MAX,
      );
      setData((prev) => ({
        ...prev,
        savings: savingsTierFromLocalTotal(
          countryKey,
          localAmount,
          openEnded,
        ),
      }));
    } else {
      const t = coerceSavingsRange(existing);
      if (t) {
        setSavingsSliderPos(
          savingsSliderPositionFromTier(cur, t, TOTAL_SAVINGS_SLIDER_RAMP_MAX),
        );
      }
    }
  }, [currentKey, countryKey]);

  useEffect(() => {
    const prev = prevStepRef.current;
    prevStepRef.current = currentKey;
    const enteredMix = prev !== "savingsMix" && currentKey === "savingsMix";
    if (!enteredMix) return;
    const d = dataRef.current;
    if (d.savingsMix) {
      setAlloc(MIX_TRIPLETS[d.savingsMix as SavingsMix]);
    } else {
      setAlloc(MIX_TRIPLETS.balanced);
      setData((p) => ({ ...p, savingsMix: "balanced" }));
    }
  }, [currentKey]);

  function select(v: string) {
    setData((prev) => ({ ...prev, [currentKey]: v }));
    setError(null);
  }

  function setAllocAndMix(t: [number, number]) {
    setAlloc(t);
    select(nearestSavingsMix(t[0], t[1]));
  }

  function applyIncomeSlider(pos: number) {
    const cur = countryMeta(countryKey).currency;
    const { monthlyLocal, openEnded } = incomeFromSliderPosition(
      cur,
      pos,
      INCOME_SLIDER_RAMP_MAX,
    );
    setIncomeSliderPos(pos);
    setData((prev) => ({
      ...prev,
      income: incomeTierFromLocalMonthly(countryKey, monthlyLocal, openEnded),
    }));
    setError(null);
  }

  function applySavingsRateSlider(pos: number) {
    const { rate, openEnded } = savingsRateFromSliderPosition(
      pos,
      SAVINGS_RATE_SLIDER_RAMP_MAX,
    );
    const key = openEnded ? "r38p" : nearestSavingsRateKey(rate);
    setSavingsRateSliderPos(pos);
    setData((prev) => ({ ...prev, savingsRate: key }));
    setError(null);
  }

  function applyTotalSavingsSlider(pos: number) {
    const cur = countryMeta(countryKey).currency;
    const { localAmount, openEnded } = totalSavingsFromSliderPosition(
      cur,
      pos,
      TOTAL_SAVINGS_SLIDER_RAMP_MAX,
    );
    setSavingsSliderPos(pos);
    setData((prev) => ({
      ...prev,
      savings: savingsTierFromLocalTotal(countryKey, localAmount, openEnded),
    }));
    setError(null);
  }

  async function submitProfile() {
    const payload = {
      income: data.income,
      savings: data.savings,
      savingsRate: data.savingsRate,
      country: data.country,
      savingsMix: data.savingsMix,
      incomeStability: data.incomeStability,
      mortgagePressure: data.mortgage,
      primaryFear: data.primaryFear || "making_mistake",
    };

    setSaving(true);
    setError(null);

    // Build dashboard URL from profile data (dashboard parses these directly)
    const qs = new URLSearchParams(payload).toString();
    const dashboardUrl = `/dashboard?${qs}`;

    // Try saving to Supabase in the background with a timeout;
    // navigate to dashboard regardless so the user is never stuck.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const body = await res.json();
        if (body.userId) {
          router.push(`/dashboard?user=${body.userId}`);
          return;
        }
      }
    } catch {
      // API unavailable or timed out — fall through to query-param navigation
    }

    router.push(dashboardUrl);
  }

  function next() {
    if (!value) return;

    if (!isLast) {
      setStepKey(visible[safeIndex + 1]);
      return;
    }
    void submitProfile();
  }

  function back() {
    if (safeIndex > 0) setStepKey(visible[safeIndex - 1]);
  }

  const meta = STEPS[currentKey];
  const primaryLabel = saving
    ? "Saving\u2026"
    : isLast
      ? "See my situation"
      : "Continue";

  const renderStepBody = () => {
    if (currentKey === "country") {
      return (
        <div className="mt-6 space-y-4">
          <input
            type="search"
            value={countryQuery}
            onChange={(e) => setCountryQuery(e.target.value)}
            placeholder="Search country…"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-slate-900 outline-none ring-emerald-500/30 placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2"
            autoComplete="off"
            aria-label="Search countries"
          />
          <div className="max-h-[min(22rem,50dvh)] space-y-1 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50/50 p-2">
            {filteredCountries.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => select(c.code)}
                className={
                  value === c.code
                    ? "w-full rounded-lg bg-emerald-50 px-3 py-3 text-left text-sm font-semibold text-emerald-900 ring-1 ring-emerald-200"
                    : "w-full rounded-lg px-3 py-3 text-left text-sm text-slate-800 transition-colors hover:bg-white"
                }
              >
                {c.label}
              </button>
            ))}
            {filteredCountries.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-slate-500">
                No match—try another spelling.
              </p>
            )}
          </div>
        </div>
      );
    }

    if (currentKey === "income") {
      const cur = countryMeta(countryKey).currency;
      const { monthlyLocal, openEnded } = incomeFromSliderPosition(
        cur,
        incomeSliderPos,
        INCOME_SLIDER_RAMP_MAX,
      );
      const threshold = incomeOpenThresholdLocal(cur);
      const display = openEnded
        ? `More than ${moneyFmt.format(threshold)} / mo`
        : moneyFmt.format(Math.round(monthlyLocal));

      return (
        <div className="mt-8 space-y-6">
          <div className="fc-onboarding-well px-2">
            <p className="text-center text-4xl font-semibold tabular-nums tracking-tight text-slate-900 sm:text-5xl">
              {display}
            </p>
            <p className="mt-2 text-center text-xs text-slate-500">
              {openEnded
                ? "We’ll treat this as a high earn band—precision isn’t needed here."
                : "Take-home after tax, typical month."}
            </p>
          </div>
          <div className="fc-onboarding-range-wrap">
            <input
              type="range"
              min={0}
              max={INCOME_SLIDER_RAMP_MAX}
              step={1}
              value={incomeSliderPos}
              onInput={(e) =>
                applyIncomeSlider(Number((e.target as HTMLInputElement).value))
              }
              onChange={(e) => applyIncomeSlider(Number(e.target.value))}
              className="fc-onboarding-range w-full"
              style={{ touchAction: "none" }}
              aria-valuetext={display}
              aria-label={meta.title}
            />
          </div>
          <div className="flex justify-between text-xs tabular-nums text-slate-500">
            <span>0</span>
            <span>More than {moneyFmt.format(threshold)}</span>
          </div>
        </div>
      );
    }

    if (currentKey === "savingsRate") {
      const cur = countryMeta(countryKey).currency;
      const inc =
        coerceIncomeRange(data.income) ?? ("4k-6k" as IncomeRange);
      const { rate, openEnded } = savingsRateFromSliderPosition(
        savingsRateSliderPos,
        SAVINGS_RATE_SLIDER_RAMP_MAX,
      );
      const pctWhole = Math.round(
        (openEnded ? SAVINGS_RATE_SLIDER_RAMP_FRACTION : rate) * 100,
      );
      const displayPct = openEnded
        ? `More than ${Math.round(SAVINGS_RATE_SLIDER_RAMP_FRACTION * 100)}%`
        : `${pctWhole}%`;

      // Show a range based on income tier bounds rather than a single midpoint.
      const bounds = incomeTierBoundsLocal(cur, inc);
      const effectiveRate = openEnded ? SAVINGS_RATE_SLIDER_RAMP_FRACTION : rate;
      const loAmount = Math.round(bounds.lo * effectiveRate);
      const hiAmount = Math.round(bounds.hi * effectiveRate);
      const displayRange =
        loAmount > 0
          ? `${moneyFmt.format(loAmount)} – ${moneyFmt.format(hiAmount)} / mo`
          : `Up to ${moneyFmt.format(hiAmount)} / mo`;
      const ariaText = `${displayPct} of take-home, roughly ${displayRange}`;

      return (
        <div className="mt-8 space-y-6">
          <div className="fc-onboarding-well px-2">
            <p className="text-center text-4xl font-semibold tabular-nums tracking-tight text-slate-900 sm:text-5xl">
              {displayPct}
            </p>
            <p className="mt-2 text-center text-sm font-medium tabular-nums text-slate-700">
              {displayRange}
            </p>
            <p className="mt-2 text-center text-xs text-slate-500">
              {openEnded
                ? "We’ll use a strong saver rate—exact % doesn’t need to be precise."
                : "Estimated range at your income band, after tax."}
            </p>
          </div>
          <div className="fc-onboarding-range-wrap">
            <input
              type="range"
              min={0}
              max={SAVINGS_RATE_SLIDER_RAMP_MAX}
              step={1}
              value={savingsRateSliderPos}
              onInput={(e) =>
                applySavingsRateSlider(
                  Number((e.target as HTMLInputElement).value),
                )
              }
              onChange={(e) =>
                applySavingsRateSlider(Number(e.target.value))
              }
              className="fc-onboarding-range w-full"
              style={{ touchAction: "none" }}
              aria-valuetext={ariaText}
              aria-label={meta.title}
            />
          </div>
          <div className="flex justify-between text-xs tabular-nums text-slate-500">
            <span>0%</span>
            <span>
              More than {Math.round(SAVINGS_RATE_SLIDER_RAMP_FRACTION * 100)}%
            </span>
          </div>
        </div>
      );
    }

    if (currentKey === "savings") {
      const cur = countryMeta(countryKey).currency;
      const { localAmount, openEnded } = totalSavingsFromSliderPosition(
        cur,
        savingsSliderPos,
        TOTAL_SAVINGS_SLIDER_RAMP_MAX,
      );
      const threshold = savingsOpenThresholdLocal(cur);
      const display = openEnded
        ? `More than ${moneyFmt.format(threshold)}`
        : moneyFmt.format(Math.round(localAmount));

      return (
        <div className="mt-8 space-y-6">
          <div className="fc-onboarding-well px-2">
            <p className="text-center text-4xl font-semibold tabular-nums tracking-tight text-slate-900 sm:text-5xl">
              {display}
            </p>
            <p className="mt-2 text-center text-xs text-slate-500">
              {openEnded
                ? "We’ll treat this as a large nest egg—precision isn’t needed here."
                : "Cash plus investments you count as savings."}
            </p>
          </div>
          <div className="fc-onboarding-range-wrap">
            <input
              type="range"
              min={0}
              max={TOTAL_SAVINGS_SLIDER_RAMP_MAX}
              step={1}
              value={savingsSliderPos}
              onInput={(e) =>
                applyTotalSavingsSlider(
                  Number((e.target as HTMLInputElement).value),
                )
              }
              onChange={(e) => applyTotalSavingsSlider(Number(e.target.value))}
              className="fc-onboarding-range w-full"
              style={{ touchAction: "none" }}
              aria-valuetext={display}
              aria-label={meta.title}
            />
          </div>
          <div className="flex justify-between text-xs tabular-nums text-slate-500">
            <span>0</span>
            <span>More than {moneyFmt.format(threshold)}</span>
          </div>
        </div>
      );
    }

    if (currentKey === "savingsMix") {
      const [c, iv] = alloc;
      const total = c + iv;
      const cashAbs = Math.round((totalSavingsEstimate * c) / 100);
      const invAbs = Math.round((totalSavingsEstimate * iv) / 100);
      return (
        <div className="mt-8 space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between gap-3 text-sm">
              <span className="font-medium text-slate-800">Cash</span>
              <span className="shrink-0 text-right tabular-nums text-slate-600">
                {c}% · {moneyFmt.format(cashAbs)}
              </span>
            </div>
            <div className="fc-onboarding-range-wrap">
              <input
                type="range"
                min={0}
                max={100}
                value={c}
                onChange={(e) =>
                  setAllocAndMix(rebalance(0, Number(e.target.value), alloc))
                }
                className="fc-onboarding-range w-full"
                aria-label="Cash percentage"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between gap-3 text-sm">
              <span className="font-medium text-slate-800">Investments</span>
              <span className="shrink-0 text-right tabular-nums text-slate-600">
                {iv}% · {moneyFmt.format(invAbs)}
              </span>
            </div>
            <div className="fc-onboarding-range-wrap">
              <input
                type="range"
                min={0}
                max={100}
                value={iv}
                onChange={(e) =>
                  setAllocAndMix(rebalance(1, Number(e.target.value), alloc))
                }
                className="fc-onboarding-range w-full"
                aria-label="Investments percentage"
              />
            </div>
          </div>
          <div
            className={`flex justify-between rounded-xl px-4 py-3 text-sm ${
              c + iv === 100 ? "bg-gray-100" : "bg-amber-50"
            }`}
          >
            <span className="text-slate-500">Total</span>
            <span
              className={`font-semibold tabular-nums ${
                c + iv === 100 ? "text-emerald-600" : "text-amber-700"
              }`}
            >
              {c + iv}% · {moneyFmt.format(cashAbs + invAbs)}
            </span>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {SAVINGS_MIX_OPTIONS.map(({ value: mixVal, label }) => (
              <button
                key={mixVal}
                type="button"
                onClick={() => {
                  const t = MIX_TRIPLETS[mixVal as SavingsMix];
                  setAlloc(t);
                  select(mixVal);
                }}
                className={
                  value === mixVal
                    ? "rounded-full border border-emerald-500 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900"
                    : "rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-gray-300 hover:bg-gray-50"
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="mt-8 space-y-3">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => select(opt.value)}
            className={
              value === opt.value
                ? "fc-option fc-option-selected"
                : "fc-option"
            }
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  };

  const canContinue =
    currentKey === "country"
      ? value !== "" && VALID_COUNTRY_CODES.has(value)
      : currentKey === "savingsMix"
        ? value !== "" && alloc[0] + alloc[1] === 100
        : value !== "";

  return (
    <main className="pb-8">
      <div className="fc-progress-bar">
        <div
          className="fc-progress-bar-fill"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <p className="fc-eyebrow mt-4">
        Step {safeIndex + 1} of {totalSteps}
      </p>

      <div className="fc-onboarding-card mt-5">
        <h1 className="fc-title-lg text-center">{meta.title}</h1>
        {meta.hint && (
          <p className="mt-2 text-center text-[15px] leading-relaxed text-slate-500">
            {meta.hint}
          </p>
        )}

        {renderStepBody()}

        {error && (
          <p className="mt-4 text-center text-sm text-red-600">{error}</p>
        )}

        <div className="mt-10 flex gap-3">
          {safeIndex > 0 ? (
            <button type="button" onClick={back} className="fc-btn-secondary">
              Back
            </button>
          ) : (
            <Link href="/" className="fc-btn-secondary">
              Back
            </Link>
          )}
          <button
            type="button"
            onClick={next}
            disabled={!canContinue || saving}
            className={
              canContinue && !saving
                ? "fc-btn-primary-block min-w-0 flex-1 rounded-xl"
                : "flex min-w-0 flex-1 cursor-not-allowed items-center justify-center rounded-xl bg-gray-200 py-3.5 text-sm font-semibold text-gray-400"
            }
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </main>
  );
}
