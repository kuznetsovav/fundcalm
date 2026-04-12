"use client";

import { useMemo, useState } from "react";
import { getFinancialStatus } from "@/lib/engine";
import type { FinancialInput } from "@/lib/engine";
import { currencyLocaleFromCountryCode } from "@/lib/money-tiers";

interface Props {
  input: FinancialInput;
}

const STATUS_COLORS: Record<string, string> = {
  ok: "text-emerald-700",
  warning: "text-amber-700",
  risk: "text-amber-800",
  critical: "text-red-700",
};
const STATUS_LABELS: Record<string, string> = {
  ok: "Comfortable",
  warning: "Limited",
  risk: "Attention",
  critical: "Urgent",
};

export default function WhatIfPanel({ input }: Props) {
  const [adjustment, setAdjustment] = useState(0); // -50 to +50 %

  const { currency, locale } = currencyLocaleFromCountryCode(input.countryCode);
  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Math.round(Math.abs(n)));

  const result = useMemo(() => {
    const factor = 1 + adjustment / 100;
    const adjustedExpenses = Math.max(1, Math.round(input.monthly_expenses * factor));
    const modified: FinancialInput = { ...input, monthly_expenses: adjustedExpenses };
    return getFinancialStatus(modified);
  }, [input, adjustment]);

  const adjustedExpenses = Math.max(1, Math.round(input.monthly_expenses * (1 + adjustment / 100)));
  const currentRunway = Math.round((input.cash_amount / input.monthly_expenses) * 10) / 10;
  const newRunway = Math.round(result.financialMetrics.runway * 10) / 10;
  const runwayDiff = Math.round((newRunway - currentRunway) * 10) / 10;

  const targetMonths = input.monthly_expenses > 0
    ? Math.round(result.financialMetrics.required_cash / adjustedExpenses * 10) / 10
    : 6;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-5 py-5">
      <h2 className="text-base font-semibold text-slate-900">What-if: adjust expenses</h2>
      <p className="mt-1 text-xs text-slate-500">
        Drag to see how your runway changes if monthly spending goes up or down.
      </p>

      <div className="mt-5">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-slate-500">Monthly expenses</span>
          <span className="text-sm font-semibold tabular-nums text-slate-900">
            {fmt(adjustedExpenses)} / mo
            {adjustment !== 0 && (
              <span className={`ml-1.5 text-xs font-medium ${adjustment > 0 ? "text-red-600" : "text-emerald-600"}`}>
                ({adjustment > 0 ? "+" : ""}{adjustment}%)
              </span>
            )}
          </span>
        </div>

        <input
          type="range"
          min={-50}
          max={50}
          step={5}
          value={adjustment}
          onChange={(e) => setAdjustment(Number(e.target.value))}
          className="fc-onboarding-range mt-3 w-full"
          style={{ touchAction: "none" }}
          aria-label="Expense adjustment"
        />
        <div className="mt-1 flex justify-between text-xs tabular-nums text-slate-400">
          <span>−50%</span>
          <span className="text-slate-300">0</span>
          <span>+50%</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          <p className="text-xs text-slate-500">Runway</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
            {newRunway} mo
          </p>
          {adjustment !== 0 && (
            <p className={`mt-0.5 text-xs font-medium tabular-nums ${runwayDiff >= 0 ? "text-emerald-700" : "text-red-600"}`}>
              {runwayDiff >= 0 ? "+" : ""}{runwayDiff} mo
            </p>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          <p className="text-xs text-slate-500">Target</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
            {targetMonths} mo
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          <p className="text-xs text-slate-500">Status</p>
          <p className={`mt-0.5 text-sm font-semibold ${STATUS_COLORS[result.status] ?? "text-slate-900"}`}>
            {STATUS_LABELS[result.status] ?? result.status}
          </p>
        </div>
      </div>

      {adjustment !== 0 && (
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          {adjustment > 0
            ? `At ${fmt(adjustedExpenses)}/mo your runway shortens to ${newRunway} months.`
            : `At ${fmt(adjustedExpenses)}/mo your runway extends to ${newRunway} months.`}
          {result.financialMetrics.gap > 0
            ? ` Still ${fmt(result.financialMetrics.gap)} short of your ${targetMonths}-month target.`
            : " You'd be at or above your target."}
        </p>
      )}

      {adjustment !== 0 && (
        <button
          type="button"
          onClick={() => setAdjustment(0)}
          className="mt-3 text-xs text-slate-400 underline underline-offset-2 hover:text-slate-600"
        >
          Reset to current
        </button>
      )}
    </div>
  );
}
