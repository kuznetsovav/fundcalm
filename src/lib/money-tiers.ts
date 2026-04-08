import type {
  CashRange,
  IncomeRange,
  SavingsRange,
  SavingsRateRange,
} from "./tier-reference";
import {
  INCOME_MID,
  INCOME_TIER_ORDER,
  SAVINGS_MID,
  SAVINGS_RATE_MID,
  SAVINGS_RATE_ORDER,
  SAVINGS_TIER_ORDER,
} from "./tier-reference";
import { countryMeta } from "./countries";

/**
 * Converts USD-reference tier midpoints into local currency amounts.
 * Tuned so PLN / EUR / etc. feel realistic (not “tiny” vs local wages).
 */
const AMOUNT_SCALE: Record<string, number> = {
  USD: 1,
  CAD: 1.38,
  AUD: 1.55,
  NZD: 1.72,
  GBP: 0.79,
  EUR: 0.93,
  CHF: 0.9,
  PLN: 4.45,
  CZK: 23,
  RON: 4.65,
  SEK: 11.2,
  NOK: 11.2,
  DKK: 7.05,
  TRY: 34,
  RUB: 98,
  UAH: 42,
  MXN: 18.5,
  BRL: 5.35,
  ARS: 950,
  CLP: 960,
  COP: 4200,
  INR: 84,
  CNY: 7.28,
  JPY: 155,
  KRW: 1390,
  SGD: 1.36,
  THB: 36.5,
  VND: 25200,
  PHP: 58,
  IDR: 15900,
  MYR: 4.78,
  AED: 3.67,
  SAR: 3.75,
  ILS: 3.68,
  ZAR: 18.8,
  NGN: 1580,
  EGP: 50,
  KES: 135,
  DEFAULT: 1,
};

function scaleFor(currency: string): number {
  return AMOUNT_SCALE[currency] ?? AMOUNT_SCALE.DEFAULT;
}

/** Extra bump for savings stock in higher-scale currencies (vs flow). */
function savingsScale(currency: string): number {
  const s = scaleFor(currency);
  return s * (s >= 2.5 ? 1.1 : 1);
}

export function incomeTierMid(currency: string, tier: IncomeRange): number {
  return Math.round(INCOME_MID[tier] * scaleFor(currency));
}

export function savingsTierMid(currency: string, tier: SavingsRange): number {
  return Math.round(SAVINGS_MID[tier] * savingsScale(currency));
}

const CASH_USD: Record<CashRange, number> = {
  lt1k: 500,
  "1k-5k": 3000,
  "5k-15k": 10000,
  "15k-40k": 27500,
  gt40k: 55000,
};

function cashMidScaled(currency: string, r: CashRange): number {
  return Math.round(CASH_USD[r] * savingsScale(currency));
}

/** Scaled cash-tier midpoint (for legacy URL / profile inference). */
export function cashTierMid(currency: string, r: CashRange): number {
  return cashMidScaled(currency, r);
}

export function cashAmountToNearestRangeForCurrency(
  currency: string,
  amount: number,
): CashRange {
  const keys = Object.keys(CASH_USD) as CashRange[];
  let best: CashRange = "1k-5k";
  let bestDiff = Infinity;
  for (const k of keys) {
    const d = Math.abs(cashMidScaled(currency, k) - amount);
    if (d < bestDiff) {
      bestDiff = d;
      best = k;
    }
  }
  return best;
}

export function minMonthlyExpenseFloor(currency: string): number {
  const s = scaleFor(currency);
  const raw = Math.round(320 * Math.pow(s, 0.88));
  if (currency === "JPY") return Math.max(raw, 130_000);
  if (currency === "KRW") return Math.max(raw, 1_200_000);
  if (currency === "VND") return Math.max(raw, 8_500_000);
  if (currency === "IDR") return Math.max(raw, 5_500_000);
  return Math.max(raw, 400);
}

/** Upper edge of each income band in USD (last tier is open-ended). */
const INCOME_CAP_USD: Record<IncomeRange, number> = {
  lt2k: 2_000,
  "2k-3k": 3_000,
  "3k-4k": 4_000,
  "4k-6k": 6_000,
  "6k-8k": 8_000,
  "8k-11k": 11_000,
  "11k-16k": 16_000,
  gt16k: 16_000,
};

/** Human-readable bracket for onboarding lists (localized currency). */
export function incomeBracketDescription(
  countryCode: string,
  tier: IncomeRange,
): string {
  const meta = countryMeta(countryCode);
  const c = meta.currency;
  const loc = meta.locale;
  const fmt = (n: number) =>
    new Intl.NumberFormat(loc, {
      style: "currency",
      currency: c,
      maximumFractionDigits: 0,
    }).format(Math.round(n));

  const s = scaleFor(c);
  if (tier === "lt2k") {
    const cap = Math.round(INCOME_CAP_USD.lt2k * s);
    return `Under ${fmt(cap)} / mo`;
  }
  if (tier === "gt16k") {
    const floor = Math.round(INCOME_CAP_USD["11k-16k"] * s);
    return `Over ${fmt(floor)} / mo`;
  }
  const idx = INCOME_TIER_ORDER.indexOf(tier);
  const prevCapUsd =
    idx <= 0 ? 0 : INCOME_CAP_USD[INCOME_TIER_ORDER[idx - 1]!];
  const hiUsd = INCOME_CAP_USD[tier];
  const lo = Math.round(prevCapUsd * s);
  const hi = Math.round(hiUsd * s);
  return `${fmt(lo)} – ${fmt(hi)} / mo`;
}

/** USD/month at which the UI switches to “more than this” (open top band). */
export const INCOME_OPEN_BAND_USD = 16_000;

export function incomeOpenThresholdLocal(currency: string): number {
  return Math.round(INCOME_OPEN_BAND_USD * scaleFor(currency));
}

/**
 * Map slider position → continuous monthly amount (local) or open-ended top.
 * `rampMax` = slider index for “more than threshold” (e.g. 5000 → values 0..4999 ramp, 5000 = open).
 */
export function incomeFromSliderPosition(
  currency: string,
  position: number,
  rampMax: number,
): { monthlyLocal: number; openEnded: boolean } {
  const cap = incomeOpenThresholdLocal(currency);
  if (position >= rampMax) {
    return { monthlyLocal: cap, openEnded: true };
  }
  const monthlyLocal = (position / rampMax) * cap;
  return { monthlyLocal, openEnded: false };
}

export function incomeTierFromUsdRefMonthly(usdRef: number): IncomeRange {
  if (usdRef < 2_000) return "lt2k";
  if (usdRef < 3_000) return "2k-3k";
  if (usdRef < 4_000) return "3k-4k";
  if (usdRef < 6_000) return "4k-6k";
  if (usdRef < 8_000) return "6k-8k";
  if (usdRef < 11_000) return "8k-11k";
  if (usdRef < 16_000) return "11k-16k";
  return "gt16k";
}

export function incomeTierFromLocalMonthly(
  countryCode: string,
  monthlyLocal: number,
  openEnded: boolean,
): IncomeRange {
  if (openEnded) return "gt16k";
  const s = scaleFor(countryMeta(countryCode).currency);
  return incomeTierFromUsdRefMonthly(monthlyLocal / s);
}

/** Pick slider index from an existing tier (for back navigation). */
export function incomeSliderPositionFromTier(
  currency: string,
  tier: IncomeRange,
  rampMax: number,
): number {
  if (tier === "gt16k") return rampMax;
  const mid = incomeTierMid(currency, tier);
  const cap = incomeOpenThresholdLocal(currency);
  if (cap <= 0) return 0;
  const p = Math.round((mid / cap) * rampMax);
  return Math.min(rampMax - 1, Math.max(0, p));
}

/** Top of linear ramp for “save monthly” slider (open step = above this). */
export const SAVINGS_RATE_SLIDER_RAMP_FRACTION = 0.42;

export function savingsRateFromSliderPosition(
  position: number,
  rampMax: number,
): { rate: number; openEnded: boolean } {
  if (position >= rampMax) {
    return { rate: SAVINGS_RATE_MID.r38p, openEnded: true };
  }
  const rate = (position / rampMax) * SAVINGS_RATE_SLIDER_RAMP_FRACTION;
  return { rate, openEnded: false };
}

export function nearestSavingsRateKey(rate: number): SavingsRateRange {
  let best: SavingsRateRange = "r0";
  let bestD = Infinity;
  for (const k of SAVINGS_RATE_ORDER) {
    const d = Math.abs(SAVINGS_RATE_MID[k] - rate);
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return best;
}

export function savingsRateSliderPositionFromKey(
  key: SavingsRateRange,
  rampMax: number,
): number {
  const r = SAVINGS_RATE_MID[key];
  const p = Math.round((r / SAVINGS_RATE_SLIDER_RAMP_FRACTION) * rampMax);
  return Math.min(rampMax - 1, Math.max(0, p));
}

/** USD-ref total savings at which UI uses “more than this” (open top). */
export const SAVINGS_OPEN_BAND_USD = 500_000;

export function savingsOpenThresholdLocal(currency: string): number {
  return Math.round(SAVINGS_OPEN_BAND_USD * savingsScale(currency));
}

export function totalSavingsFromSliderPosition(
  currency: string,
  position: number,
  rampMax: number,
): { localAmount: number; openEnded: boolean } {
  const cap = savingsOpenThresholdLocal(currency);
  if (position >= rampMax) {
    return { localAmount: cap, openEnded: true };
  }
  const localAmount = (position / rampMax) * cap;
  return { localAmount, openEnded: false };
}

export function savingsTierFromLocalTotal(
  countryCode: string,
  localAmount: number,
  openEnded: boolean,
): SavingsRange {
  if (openEnded) return "gt500k";
  const s = savingsScale(countryMeta(countryCode).currency);
  const ref = localAmount / s;
  if (ref < 1_000) return "lt1k";
  if (ref < 4_000) return "1k-4k";
  if (ref < 10_000) return "4k-10k";
  if (ref < 25_000) return "10k-25k";
  if (ref < 60_000) return "25k-60k";
  if (ref < 120_000) return "60k-120k";
  if (ref < 250_000) return "120k-250k";
  if (ref < 500_000) return "250k-500k";
  return "gt500k";
}

export function savingsSliderPositionFromTier(
  currency: string,
  tier: SavingsRange,
  rampMax: number,
): number {
  if (tier === "gt500k") return rampMax;
  const mid = savingsTierMid(currency, tier);
  const cap = savingsOpenThresholdLocal(currency);
  if (cap <= 0) return 0;
  const p = Math.round((mid / cap) * rampMax);
  return Math.min(rampMax - 1, Math.max(0, p));
}

const SAVINGS_CAP_USD: Record<SavingsRange, number> = {
  lt1k: 1_000,
  "1k-4k": 4_000,
  "4k-10k": 10_000,
  "10k-25k": 25_000,
  "25k-60k": 60_000,
  "60k-120k": 120_000,
  "120k-250k": 250_000,
  "250k-500k": 500_000,
  gt500k: 500_000,
};

export function savingsBracketDescription(
  countryCode: string,
  tier: SavingsRange,
): string {
  const meta = countryMeta(countryCode);
  const c = meta.currency;
  const loc = meta.locale;
  const fmt = (n: number) =>
    new Intl.NumberFormat(loc, {
      style: "currency",
      currency: c,
      maximumFractionDigits: 0,
    }).format(Math.round(n));

  const sc = savingsScale(c);
  if (tier === "lt1k") {
    return `Under ${fmt(Math.round(SAVINGS_CAP_USD.lt1k * sc))}`;
  }
  if (tier === "gt500k") {
    return `Over ${fmt(Math.round(SAVINGS_CAP_USD["250k-500k"] * sc))}`;
  }
  const idx = SAVINGS_TIER_ORDER.indexOf(tier);
  const prevCapUsd =
    idx <= 0 ? 0 : SAVINGS_CAP_USD[SAVINGS_TIER_ORDER[idx - 1]!];
  const hiUsd = SAVINGS_CAP_USD[tier];
  const lo = Math.round(prevCapUsd * sc);
  const hi = Math.round(hiUsd * sc);
  return `${fmt(lo)} – ${fmt(hi)}`;
}

/** ISO country code → locale + currency for formatting. */
export function currencyLocaleFromCountryCode(code: string): {
  currency: string;
  locale: string;
} {
  const m = countryMeta(code);
  return { currency: m.currency, locale: m.locale };
}
