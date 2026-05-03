/**
 * Server-only ETF quote fetcher.
 *
 * In-memory TTL cache survives warm Vercel invocations; cold starts re-fetch.
 * No persistent cache table — quotes are cheap to refetch and 15 minutes is
 * fresh enough for DCA decisions that execute monthly.
 */

import "server-only";
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance();
yf._notices.suppress(["yahooSurvey", "ripHistorical"]);

export interface QuoteHistoryPoint {
  /** YYYY-MM-DD */
  date: string;
  close: number;
}

export interface EtfQuote {
  ticker: string;
  price: number;
  currency: string;
  /** Day-over-day percent change. */
  change_pct: number;
  /** Weekly closes for the past ~52 weeks. */
  history: QuoteHistoryPoint[];
  fetched_at: number;
}

const CACHE = new Map<string, { data: EtfQuote; expires: number }>();
const TTL_MS = 15 * 60 * 1000;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

async function fetchOne(ticker: string): Promise<EtfQuote | null> {
  try {
    const period1 = new Date(Date.now() - ONE_YEAR_MS);
    const [quote, chart] = await Promise.all([
      yf.quote(ticker),
      yf.chart(ticker, { period1, interval: "1wk", return: "array" }),
    ]);

    const history: QuoteHistoryPoint[] = chart.quotes
      .filter(
        (q): q is typeof q & { close: number; date: Date } =>
          q.close != null && q.date != null,
      )
      .map((q) => ({
        date: q.date.toISOString().slice(0, 10),
        close: q.close,
      }));

    return {
      ticker,
      price: quote.regularMarketPrice ?? 0,
      currency: quote.currency ?? "USD",
      change_pct: quote.regularMarketChangePercent ?? 0,
      history,
      fetched_at: Date.now(),
    };
  } catch {
    return null;
  }
}

export async function getQuotes(tickers: string[]): Promise<EtfQuote[]> {
  const now = Date.now();
  const fromCache: EtfQuote[] = [];
  const missing: string[] = [];

  for (const t of tickers) {
    const cached = CACHE.get(t);
    if (cached && cached.expires > now) {
      fromCache.push(cached.data);
    } else {
      missing.push(t);
    }
  }

  if (missing.length === 0) return fromCache;

  const fresh = await Promise.all(missing.map(fetchOne));
  for (const q of fresh) {
    if (q) CACHE.set(q.ticker, { data: q, expires: now + TTL_MS });
  }

  const ordered: EtfQuote[] = [];
  for (const t of tickers) {
    const found =
      fromCache.find((q) => q.ticker === t) ??
      fresh.find((q): q is EtfQuote => q != null && q.ticker === t);
    if (found) ordered.push(found);
  }
  return ordered;
}
