"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProfileRowDisplay } from "@/lib/onboarding-display";

const FIELD_OPTIONS: Record<string, { value: string; label: string }[]> = {
  incomeStability: [
    { value: "steady", label: "Fairly steady month to month" },
    { value: "variable_flat", label: "Varies — no clear up or down lately" },
    { value: "variable_improving", label: "Varies — lately moving in a better direction" },
    { value: "variable_worsening", label: "Varies — lately getting tighter" },
    { value: "irregular", label: "Hard to predict" },
  ],
  mortgagePressure: [
    { value: "housing_clear", label: "Rent or own outright — housing isn't a major strain" },
    { value: "housing_ok", label: "Mortgage or rent feels comfortable in my budget" },
    { value: "housing_tight", label: "Housing takes a noticeable slice of the budget" },
    { value: "housing_heavy", label: "Housing is a serious squeeze" },
  ],
  primaryFear: [
    { value: "income_loss", label: "Income stopping or dropping" },
    { value: "market_crash", label: "A big drop in invested savings" },
    { value: "making_mistake", label: "Doing the wrong thing with money" },
    { value: "missing_opportunities", label: "Missing chances to grow savings" },
  ],
  savingsMix: [
    { value: "all_cash", label: "All in cash or savings accounts" },
    { value: "mostly_cash", label: "Mostly cash, a little invested" },
    { value: "balanced", label: "Roughly half cash, half invested" },
    { value: "mostly_invested", label: "Mostly invested, some cash" },
    { value: "almost_all_invested", label: "Almost everything invested" },
  ],
};

/** URL query-param name for each editable field */
const FIELD_PARAM: Record<string, string> = {
  incomeStability: "incomeStability",
  mortgagePressure: "mortgage",
  primaryFear: "primaryFear",
  savingsMix: "savingsMix",
};

interface Props {
  rows: ProfileRowDisplay[];
  /** Current raw values for all onboarding fields — used to build updated URLs. */
  currentValues: Record<string, string>;
}

export default function EditableProfileRows({ rows, currentValues }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);

  function applyEdit(field: string, newValue: string) {
    const paramKey = FIELD_PARAM[field];
    if (!paramKey) return;
    const params = new URLSearchParams(currentValues);
    params.set(paramKey, newValue);
    setEditing(null);
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <dl className="mt-3 space-y-3">
      {rows.map((row) => {
        const options = row.field ? FIELD_OPTIONS[row.field] : undefined;
        const isEditing = editing === row.field;

        return (
          <div
            key={row.label}
            className="border-b border-gray-50 pb-3 last:border-0"
          >
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <dt className="text-sm text-slate-500">{row.label}</dt>
              <div className="flex items-center gap-2">
                <dd className="text-sm font-medium text-slate-900">
                  {row.value}
                </dd>
                {options && (
                  <button
                    type="button"
                    onClick={() => setEditing(isEditing ? null : row.field!)}
                    className="shrink-0 text-xs text-slate-400 underline decoration-dotted underline-offset-2 hover:text-emerald-700"
                    aria-label={`Edit ${row.label}`}
                  >
                    {isEditing ? "cancel" : "edit"}
                  </button>
                )}
              </div>
            </div>
            {isEditing && options && (
              <div className="mt-3 space-y-1.5 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                {options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => applyEdit(row.field!, opt.value)}
                    className={
                      currentValues[FIELD_PARAM[row.field!] ?? ""] === opt.value
                        ? "w-full rounded-lg bg-emerald-100 px-3 py-2 text-left text-sm font-semibold text-emerald-900 ring-1 ring-emerald-300"
                        : "w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-white hover:shadow-sm"
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </dl>
  );
}
