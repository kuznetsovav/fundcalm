"use client";

import { useState, useMemo } from "react";
import type { MonthlyAllocation } from "@/lib/allocations";
import { allocationSavingsRate } from "@/lib/allocations";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function monthLabel(year: number, month: number) {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function generateMonthOptions(): { year: number; month: number; label: string }[] {
  const now = new Date();
  const options = [];
  for (let i = 0; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: monthLabel(d.getFullYear(), d.getMonth() + 1),
    });
  }
  return options;
}

// ---------------------------------------------------------------------------
// Chart sub-component
// ---------------------------------------------------------------------------

type ChartPoint = {
  label: string;
  rate: number;
  income: number;
  year: number;
  month: number;
};

function AllocationChart({
  data,
  targetRate,
  recentAvg,
  fmt,
}: {
  data: ChartPoint[];
  targetRate: number;
  recentAvg: number | null;
  fmt: (n: number) => string;
}) {
  if (data.length < 2) return null;

  const W = 560;
  const H = 130;
  const PAD = { top: 16, right: 36, bottom: 28, left: 38 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const ratesPct = data.map((d) => d.rate * 100);
  const maxY = Math.max(
    Math.ceil(Math.max(...ratesPct, targetRate * 100) * 1.35),
    10,
  );

  function xFor(i: number) {
    return PAD.left + (i / Math.max(data.length - 1, 1)) * cW;
  }
  function yFor(pct: number) {
    return PAD.top + (1 - pct / maxY) * cH;
  }

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(d.rate * 100)}`)
    .join(" ");

  const targetY = yFor(targetRate * 100);
  const yLabels = [0, Math.round(maxY / 2), maxY];

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          Savings rate
        </p>
        {recentAvg != null && (
          <span className="text-xs text-slate-500">
            3-month avg:{" "}
            <span
              className={`font-semibold tabular-nums ${
                recentAvg >= targetRate ? "text-emerald-700" : "text-amber-700"
              }`}
            >
              {Math.round(recentAvg * 100)}%
            </span>
          </span>
        )}
        <span className="text-xs text-slate-400">
          Profile target: {Math.round(targetRate * 100)}%
        </span>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ minWidth: 240 }}
          aria-label="Monthly savings rate chart"
        >
          {/* Target dashed line */}
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
          <text
            x={W - PAD.right + 4}
            y={targetY + 4}
            fontSize={9}
            fill="#059669"
            opacity={0.7}
          >
            target
          </text>

          {/* Y-axis labels */}
          {yLabels.map((v) => (
            <text
              key={v}
              x={PAD.left - 5}
              y={yFor(v) + 4}
              fontSize={9}
              fill="#9ca3af"
              textAnchor="end"
            >
              {v}%
            </text>
          ))}

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#475569"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Dots */}
          {data.map((d, i) => (
            <circle
              key={i}
              cx={xFor(i)}
              cy={yFor(d.rate * 100)}
              r={3.5}
              fill={d.rate >= targetRate ? "#059669" : "#f59e0b"}
            >
              <title>
                {monthLabel(d.year, d.month)}: {Math.round(d.rate * 100)}%
                saved{d.income ? ` (income: ${fmt(d.income)})` : ""}
              </title>
            </circle>
          ))}

          {/* X-axis labels */}
          {data.map((d, i) => {
            if (data.length > 6 && i % 2 !== 0 && i !== data.length - 1)
              return null;
            return (
              <text
                key={i}
                x={xFor(i)}
                y={H - 4}
                fontSize={9}
                fill="#9ca3af"
                textAnchor="middle"
              >
                {d.label}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  userId: string;
  initialEntries: MonthlyAllocation[];
  currency: string;
  locale: string;
  /** Profile savings rate (0–1) — used for drift detection and chart target line. */
  profileSavingsRate: number;
}

export default function MonthlyLog({
  userId,
  initialEntries,
  currency,
  locale,
  profileSavingsRate,
}: Props) {
  const monthOptions = useMemo(generateMonthOptions, []);
  const now = new Date();

  const [entries, setEntries] = useState<MonthlyAllocation[]>(initialEntries);
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [incomeRaw, setIncomeRaw] = useState("");
  const [spentRaw, setSpentRaw] = useState("");
  const [savedRaw, setSavedRaw] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Math.round(Math.abs(n)));

  // Parsed values
  const incomeVal =
    incomeRaw !== "" ? parseFloat(incomeRaw) : null;
  const spentVal =
    spentRaw !== "" ? parseFloat(spentRaw) : null;
  const savedVal =
    savedRaw !== "" ? parseFloat(savedRaw) : null;

  // Auto-calculation
  const computedSaved =
    incomeVal != null &&
    Number.isFinite(incomeVal) &&
    spentVal != null &&
    Number.isFinite(spentVal) &&
    savedRaw === ""
      ? incomeVal - spentVal
      : null;

  const computedSpent =
    incomeVal != null &&
    Number.isFinite(incomeVal) &&
    savedVal != null &&
    Number.isFinite(savedVal) &&
    spentRaw === ""
      ? incomeVal - savedVal
      : null;

  const effSaved = savedVal ?? computedSaved;
  const effSpent = spentVal ?? computedSpent;

  const savingsRateDisplay =
    incomeVal != null && incomeVal > 0 && effSaved != null
      ? Math.round((effSaved / incomeVal) * 100)
      : null;

  // Pre-fill form from an existing entry
  function loadEntry(entry: MonthlyAllocation) {
    setSelYear(entry.year);
    setSelMonth(entry.month);
    setIncomeRaw(entry.income != null ? String(entry.income) : "");
    setSpentRaw(entry.spent != null ? String(entry.spent) : "");
    setSavedRaw(entry.saved != null ? String(entry.saved) : "");
    setFormError(null);
  }

  function handleMonthChange(val: string) {
    const [y, m] = val.split("-").map(Number);
    setSelYear(y);
    setSelMonth(m);
    const existing = entries.find((e) => e.year === y && e.month === m);
    if (existing) {
      loadEntry(existing);
    } else {
      setIncomeRaw("");
      setSpentRaw("");
      setSavedRaw("");
      setFormError(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (incomeVal == null || !Number.isFinite(incomeVal) || incomeVal < 0) {
      setFormError("Enter a valid income amount.");
      return;
    }
    if (effSaved == null && effSpent == null) {
      setFormError("Enter either Spent or Saved (or both).");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          year: selYear,
          month: selMonth,
          income: incomeVal,
          spent: effSpent ?? null,
          saved: effSaved ?? null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setFormError((j as { error?: string }).error ?? "Save failed — please try again.");
        return;
      }

      // Optimistic local update
      const newEntry: MonthlyAllocation = {
        id: `${selYear}-${selMonth}-local`,
        user_id: userId,
        year: selYear,
        month: selMonth,
        income: incomeVal,
        spent: effSpent ?? null,
        saved: effSaved ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setEntries((prev) => {
        const without = prev.filter(
          (e) => !(e.year === selYear && e.month === selMonth),
        );
        return [newEntry, ...without].sort((a, b) =>
          a.year !== b.year ? b.year - a.year : b.month - a.month,
        );
      });

      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2500);
    } catch {
      setFormError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  // Chart data: valid entries sorted ascending, last 12
  const chartData = useMemo<ChartPoint[]>(() => {
    return [...entries]
      .filter((e) => {
        const r = allocationSavingsRate(e);
        return r != null;
      })
      .sort((a, b) =>
        a.year !== b.year ? a.year - b.year : a.month - b.month,
      )
      .map((e) => ({
        label: MONTH_NAMES[e.month - 1],
        rate: allocationSavingsRate(e)!,
        income: e.income ?? 0,
        year: e.year,
        month: e.month,
      }))
      .slice(-12);
  }, [entries]);

  // 3-month rolling average (last 3 chart points)
  const recentAvg = useMemo(() => {
    const recent = chartData.slice(-3);
    if (recent.length < 2) return null;
    return recent.reduce((sum, d) => sum + d.rate, 0) / recent.length;
  }, [chartData]);

  // Drift: actual average vs profile rate, flag if >5pp off with 3+ months
  const drift = useMemo(() => {
    const recent = chartData.slice(-3);
    if (recent.length < 3) return null;
    const avg = recent.reduce((sum, d) => sum + d.rate, 0) / recent.length;
    if (Math.abs(avg - profileSavingsRate) <= 0.05) return null;
    return {
      actualPct: Math.round(avg * 100),
      profilePct: Math.round(profileSavingsRate * 100),
    };
  }, [chartData, profileSavingsRate]);

  return (
    <div className="space-y-5">
      {/* Chart — shown once 2+ valid entries exist */}
      {chartData.length >= 2 ? (
        <AllocationChart
          data={chartData}
          targetRate={profileSavingsRate}
          recentAvg={recentAvg}
          fmt={fmt}
        />
      ) : (
        <p className="text-xs text-slate-400">
          Chart appears after you log 2 or more months.
        </p>
      )}

      {/* Drift banner */}
      {drift && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
          <p className="text-sm leading-relaxed text-amber-900">
            Your last 3 months average{" "}
            <span className="font-semibold tabular-nums">{drift.actualPct}%</span>{" "}
            saved — your profile shows{" "}
            <span className="font-semibold tabular-nums">{drift.profilePct}%</span>.
            Updating it would give a more accurate runway read.
          </p>
          <a
            href={`/checkin?user=${userId}`}
            className="mt-1.5 inline-block text-xs font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900"
          >
            Update profile →
          </a>
        </div>
      )}

      {/* Entry form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-slate-200 bg-slate-50/40 px-4 py-4"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          Log a month
        </p>

        {/* Month selector */}
        <div className="mt-3">
          <label className="block text-xs text-slate-500">Month</label>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
            value={`${selYear}-${selMonth}`}
            onChange={(e) => handleMonthChange(e.target.value)}
          >
            {monthOptions.map((opt) => {
              const hasEntry = entries.some(
                (e) => e.year === opt.year && e.month === opt.month,
              );
              return (
                <option
                  key={`${opt.year}-${opt.month}`}
                  value={`${opt.year}-${opt.month}`}
                >
                  {opt.label}
                  {hasEntry ? " ·" : ""}
                </option>
              );
            })}
          </select>
        </div>

        {/* Three number fields */}
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {/* Income */}
          <div>
            <label className="block text-xs text-slate-500">Income</label>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="0"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
              value={incomeRaw}
              onChange={(e) => setIncomeRaw(e.target.value)}
            />
          </div>

          {/* Spent */}
          <div>
            <label className="block text-xs text-slate-500">
              Spent
              {computedSpent != null && spentRaw === "" && (
                <span className="ml-1 text-slate-400">(auto)</span>
              )}
            </label>
            <input
              type="number"
              min="0"
              step="1"
              placeholder={
                computedSpent != null
                  ? Math.round(computedSpent).toString()
                  : "0"
              }
              className={`mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-300 ${
                computedSpent != null && spentRaw === ""
                  ? "bg-slate-50 text-slate-400"
                  : "bg-white text-slate-900"
              }`}
              value={spentRaw}
              onChange={(e) => setSpentRaw(e.target.value)}
            />
          </div>

          {/* Saved */}
          <div>
            <label className="block text-xs text-slate-500">
              Saved
              {computedSaved != null && savedRaw === "" && (
                <span className="ml-1 text-slate-400">(auto)</span>
              )}
            </label>
            <input
              type="number"
              min="0"
              step="1"
              placeholder={
                computedSaved != null
                  ? Math.round(computedSaved).toString()
                  : "0"
              }
              className={`mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-300 ${
                computedSaved != null && savedRaw === ""
                  ? "bg-slate-50 text-slate-400"
                  : "bg-white text-slate-900"
              }`}
              value={savedRaw}
              onChange={(e) => setSavedRaw(e.target.value)}
            />
          </div>
        </div>

        {/* Live savings rate preview */}
        {savingsRateDisplay != null && (
          <p className="mt-2 text-xs text-slate-500">
            Savings rate:{" "}
            <span
              className={`font-semibold tabular-nums ${
                savingsRateDisplay >= Math.round(profileSavingsRate * 100)
                  ? "text-emerald-700"
                  : "text-amber-700"
              }`}
            >
              {savingsRateDisplay}%
            </span>{" "}
            <span className="text-slate-400">
              (profile: {Math.round(profileSavingsRate * 100)}%)
            </span>
          </p>
        )}

        {formError && (
          <p className="mt-2 text-xs text-red-600">{formError}</p>
        )}

        <div className="mt-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {savedFeedback && (
            <span className="text-xs font-medium text-emerald-700">Saved ✓</span>
          )}
        </div>
      </form>

      {/* History table */}
      {entries.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            History
          </p>
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-left text-sm sm:min-w-[320px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  <th className="px-3 py-2 font-medium text-slate-400">Month</th>
                  <th className="px-3 py-2 font-medium text-slate-400">Income</th>
                  <th className="px-3 py-2 font-medium text-slate-400">Spent</th>
                  <th className="px-3 py-2 font-medium text-slate-400">Saved</th>
                  <th className="px-3 py-2 font-medium text-slate-400">Rate</th>
                </tr>
              </thead>
              <tbody>
                {entries.slice(0, 12).map((entry) => {
                  const rate = allocationSavingsRate(entry);
                  const isSelected =
                    entry.year === selYear && entry.month === selMonth;
                  return (
                    <tr
                      key={`${entry.year}-${entry.month}`}
                      className={`cursor-pointer border-b border-gray-50 last:border-0 hover:bg-slate-50 ${
                        isSelected ? "bg-slate-50" : ""
                      }`}
                      onClick={() => loadEntry(entry)}
                    >
                      <td className="px-3 py-2.5 text-slate-500">
                        {monthLabel(entry.year, entry.month)}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-slate-700">
                        {entry.income != null ? fmt(entry.income) : "—"}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-slate-500">
                        {entry.spent != null ? fmt(entry.spent) : "—"}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-slate-700">
                        {entry.saved != null ? fmt(entry.saved) : "—"}
                      </td>
                      <td
                        className={`px-3 py-2.5 font-medium tabular-nums ${
                          rate != null && rate >= profileSavingsRate
                            ? "text-emerald-700"
                            : "text-slate-400"
                        }`}
                      >
                        {rate != null ? `${Math.round(rate * 100)}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-xs text-slate-400">Tap a row to edit it</p>
        </div>
      )}
    </div>
  );
}
