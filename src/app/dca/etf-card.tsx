"use client";

import { etfByTicker } from "@/lib/dca-etf-catalog";
import type { EtfQuote } from "@/lib/dca-quotes";
import Sparkline from "./sparkline";

export default function EtfCard({
  ticker,
  weight,
  quote,
  loading,
}: {
  ticker: string;
  weight: number;
  quote?: EtfQuote;
  loading?: boolean;
}) {
  const meta = etfByTicker(ticker);
  if (!meta) return null;

  const positive = (quote?.change_pct ?? 0) >= 0;
  const priceLabel =
    quote != null
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: quote.currency,
          maximumFractionDigits: 2,
        }).format(quote.price)
      : null;
  const changeLabel =
    quote != null
      ? `${positive ? "+" : ""}${quote.change_pct.toFixed(2)}%`
      : null;

  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold tabular-nums text-slate-900">
            {meta.ticker}
          </p>
          <p className="truncate text-xs text-slate-500">{meta.name}</p>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-emerald-700">
          {Math.round(weight * 100)}%
        </span>
      </div>

      {/* Live price + sparkline */}
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-center gap-3">
        <div>
          {loading ? (
            <div className="space-y-1.5">
              <div className="h-5 w-20 animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-12 animate-pulse rounded bg-slate-100" />
            </div>
          ) : quote ? (
            <>
              <p className="text-lg font-semibold tabular-nums text-slate-900">
                {priceLabel}
              </p>
              <p
                className={`text-xs font-semibold tabular-nums ${positive ? "text-emerald-600" : "text-rose-600"}`}
              >
                {changeLabel}
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-400">Price unavailable</p>
          )}
        </div>
        <div className="min-w-0">
          {loading ? (
            <div className="h-12 w-full animate-pulse rounded bg-slate-100" />
          ) : quote && quote.history.length >= 2 ? (
            <Sparkline data={quote.history} positive={positive} />
          ) : null}
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        {meta.description}
      </p>

      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <div className="flex gap-1">
          <dt>Expense ratio:</dt>
          <dd className="font-semibold tabular-nums text-slate-700">
            {(meta.expense_ratio * 100).toFixed(2)}%
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>ISIN:</dt>
          <dd className="font-mono text-[11px] text-slate-700">{meta.isin}</dd>
        </div>
      </dl>
    </div>
  );
}
