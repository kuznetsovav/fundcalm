import {
  Diagnosis,
  type FinancialInput,
  type FinancialMetrics,
  type FinancialResult,
  type OnboardingInput,
  type PrimaryFear,
} from "./engine";
import { SAVINGS_RATE_MID } from "./engine";
import { countryLabel, countryMeta } from "./countries";
import {
  currencyLocaleFromCountryCode,
  incomeBracketDescription,
  incomeTierMid,
  savingsBracketDescription,
} from "./money-tiers";

const MIX_LABEL: Record<OnboardingInput["savingsMix"], string> = {
  all_cash: "All in cash or savings accounts",
  mostly_cash: "Mostly cash, a little invested",
  balanced: "Roughly half cash, half invested",
  mostly_invested: "Mostly invested, some cash",
  almost_all_invested: "Almost everything invested",
};

const STABILITY_LABEL: Record<OnboardingInput["incomeStability"], string> = {
  steady: "Fairly steady month to month",
  variable_flat: "Varies — no clear up or down lately",
  variable_improving: "Varies — lately moving in a better direction",
  variable_worsening: "Varies — lately getting tighter",
  irregular: "Hard to predict",
};

const PRIMARY_FEAR_LABEL: Record<PrimaryFear, string> = {
  income_loss: "Income stopping or dropping",
  market_crash: "A big drop in invested savings",
  making_mistake: "Doing the wrong thing with money",
  missing_opportunities: "Missing chances to grow savings",
};

const MORTGAGE_LABEL: Record<OnboardingInput["mortgagePressure"], string> = {
  rent_no_mortgage: "I rent (no mortgage)",
  own_no_mortgage: "I own with no mortgage payment",
  mortgage_comfortable: "Mortgage feels comfortable",
  mortgage_noticeable: "Mortgage is a noticeable part of my budget",
  mortgage_heavy: "Mortgage is a heavy burden",
  housing_clear: "Rent or own outright — housing isn’t a major strain",
  housing_ok: "Mortgage or rent feels comfortable",
  housing_tight: "Housing takes a noticeable slice of the budget",
  housing_heavy: "Housing is a serious squeeze",
};

export type ProfileRowDisplay = { label: string; value: string };

function fmtShort(
  n: number,
  currency: string,
  locale: string,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Math.round(Math.abs(n)));
}

/** Savings rate row: % of take-home plus typical monthly amount. */
export function savingsRateAnswerForDisplay(o: OnboardingInput): string {
  const meta = countryMeta(o.country);
  const incMid = incomeTierMid(meta.currency, o.income);
  const r = SAVINGS_RATE_MID[o.savingsRate];
  const pct = Math.round(r * 100);
  if (r <= 0) return "0% of take-home (not saving lately)";
  const abs = Math.round(incMid * r);
  return `${pct}% of take-home (~${fmtShort(abs, meta.currency, meta.locale)} / mo)`;
}

/** Human-readable rows for everything collected in onboarding. */
export function onboardingAnswersForDisplay(
  o: OnboardingInput,
): ProfileRowDisplay[] {
  return [
    { label: "Country", value: countryLabel(o.country) },
    {
      label: "Earn after taxes (range)",
      value: incomeBracketDescription(o.country, o.income),
    },
    { label: "Save monthly (rate)", value: savingsRateAnswerForDisplay(o) },
    {
      label: "Total savings (range)",
      value: savingsBracketDescription(o.country, o.savings),
    },
    { label: "Money allocation", value: MIX_LABEL[o.savingsMix] },
    { label: "Main concern", value: STABILITY_LABEL[o.incomeStability] },
    { label: "Mortgage / housing", value: MORTGAGE_LABEL[o.mortgagePressure] },
    ...(o.primaryFear
      ? [
          {
            label: "Main worry",
            value: PRIMARY_FEAR_LABEL[o.primaryFear],
          },
        ]
      : []),
  ];
}

function fmtCurrency(
  n: number,
  currency: string,
  locale: string,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Math.round(Math.abs(n)));
}

/** Estimated numbers used by the engine (from range midpoints). */
export function financialEstimatesForDisplay(
  input: FinancialInput,
  metrics: FinancialMetrics,
): ProfileRowDisplay[] {
  const { currency, locale } = currencyLocaleFromCountryCode(input.countryCode);
  const total =
    input.cash_amount + input.investments_amount;
  const cashPct =
    total > 0 ? Math.round((input.cash_amount / total) * 100) : 100;
  const invPct =
    total > 0 ? Math.round((input.investments_amount / total) * 100) : 0;
  const runway = Math.round(metrics.runway * 10) / 10;

  const gapLabel =
    metrics.gap <= 0
      ? `${fmtCurrency(-metrics.gap, currency, locale)} ahead of target`
      : `${fmtCurrency(metrics.gap, currency, locale)} below target`;

  return [
    {
      label: "Estimated monthly spending",
      value: fmtCurrency(input.monthly_expenses, currency, locale),
    },
    {
      label: "Estimated take-home income",
      value: fmtCurrency(input.monthly_income_estimate, currency, locale),
    },
    {
      label: "Estimated total savings",
      value: fmtCurrency(input.savings_total, currency, locale),
    },
    {
      label: "Estimated cash (liquid)",
      value: fmtCurrency(input.cash_amount, currency, locale),
    },
    {
      label: "Estimated investments",
      value: fmtCurrency(input.investments_amount, currency, locale),
    },
    {
      label: "Split (cash / invested)",
      value: `${cashPct}% cash · ${invPct}% invested`,
    },
    {
      label: "Months of spending in cash",
      value: `${runway} mo`,
    },
    {
      label: "Six-month cash target",
      value: fmtCurrency(metrics.required_cash, currency, locale),
    },
    { label: "Gap vs target", value: gapLabel },
  ];
}

function dedupeSuggestionLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const key = line.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(line.trim());
  }
  return out;
}

/**
 * Multi-year, allocation-aware hints (cash vs investing) — complements the engine’s
 * immediate action copy. Wording stays educational, not product- or ticker-specific.
 */
function strategicAllocationSuggestions(
  result: FinancialResult,
  input: FinancialInput,
  onboarding: OnboardingInput,
): string[] {
  const { runway } = result.financialMetrics;
  const dx = result.diagnosis;
  const mix = onboarding.savingsMix;
  const stim = onboarding.incomeStability;
  const unevenIncome =
    stim === "irregular" ||
    stim === "variable_worsening" ||
    stim === "variable_flat";

  const thinCash =
    dx === Diagnosis.CriticalBuffer ||
    dx === Diagnosis.InsufficientBuffer ||
    dx === Diagnosis.LimitedBuffer;
  const out: string[] = [];

  if (dx === Diagnosis.Overinvested) {
    out.push(
      "Rebuild cash mainly from new savings if you can, rather than selling investments in a hurry—unless you need liquidity for something planned soon.",
    );
  } else if (dx === Diagnosis.TooConservative) {
    out.push(
      "With plenty of cash on hand, a calm multi-year path is to learn one simple diversified approach and move small amounts from excess cash only when you feel clear—not your emergency slice.",
    );
  } else if (thinCash && unevenIncome) {
    out.push(
      "With uneven income and a thin cash layer, the next few years usually favor building liquidity first; shift attention to longer-term investing once bills feel reliably covered.",
    );
  } else if (thinCash) {
    out.push(
      "Looking a few years ahead: build the cash cushion first; adding to investments is easier to consider once you sit near your target months of spending in cash.",
    );
  } else if (dx === Diagnosis.Healthy) {
    if (mix === "all_cash" || mix === "mostly_cash") {
      out.push(
        "Longer term, if you want growth beyond inflation, consider gradually directing part of new savings (above your buffer) into diversified investing—only at a pace and level you understand.",
      );
    } else if (mix === "mostly_invested" || mix === "almost_all_invested") {
      out.push(
        "Over a five-year horizon, keeping your buffer in cash while leaving long-term money invested and occasionally rebalanced often balances safety and growth.",
      );
    } else {
      out.push(
        "Across several years, modest tweaks to cash versus invested savings—more cash when life is uncertain, more invested when the cushion is full—tend to beat reacting to short news cycles.",
      );
    }
  } else if (dx === Diagnosis.BalancedButIdle) {
    out.push(
      "Once the cushion feels boringly solid, small, steady additions to longer-term savings can add up over years without big one-off moves.",
    );
  }

  if (
    unevenIncome &&
    runway < 6 &&
    dx !== Diagnosis.Overinvested &&
    !thinCash
  ) {
    out.push(
      "Because income varies, many people delay new investment risk until the cash runway feels comfortable—sequencing priorities, not timing the market.",
    );
  }

  return dedupeSuggestionLines(out).slice(0, 3);
}

/** Ordered suggestions for the dashboard (engine copy + housing/income context + allocation horizon). */
export function suggestionsForDisplay(
  result: FinancialResult,
  input?: FinancialInput | null,
  onboarding?: OnboardingInput | null,
): string[] {
  const lines = [result.action, result.insight];
  if (!input) return dedupeSuggestionLines(lines);

  if (input.debtPressure === "heavy" || input.debtPressure === "moderate") {
    lines.push(
      "Housing costs are taking meaningful budget space—extra cash while you stabilise usually helps.",
    );
  }
  if (
    !onboarding &&
    (input.incomeStability === "irregular" ||
      input.incomeStability === "variable_worsening")
  ) {
    lines.push(
      "Uneven or tightening income pairs well with a bit more cash on hand than the usual target.",
    );
  }

  if (onboarding) {
    lines.push(...strategicAllocationSuggestions(result, input, onboarding));
  }

  return dedupeSuggestionLines(lines);
}
