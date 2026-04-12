// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

import { countryLabel, countryMeta } from "./countries";
import {
  cashTierMid,
  incomeTierMid,
  minMonthlyExpenseFloor,
  savingsTierMid,
  currencyLocaleFromCountryCode,
} from "./money-tiers";
import {
  CASH_MID,
  type CashRange,
  type IncomeRange,
  type SavingsRange,
  type SavingsRateRange,
  SAVINGS_RATE_MID,
} from "./tier-reference";
import {
  buildResponse,
  classifyUser,
  calculateConfidence,
  computeTargetRunway,
  deriveMetrics,
  defaultConfidenceModel,
  Diagnosis,
  generateSensitivity,
  type ConfidenceModelInput,
  type ConfidenceLevel,
  type ConfidenceResult,
  type DiagnosisBuildContext,
  type DiagnosisResponse,
  type PrimaryFear,
  type SensitivityResult,
  DIAGNOSIS_TEST_CASES,
  coercePrimaryFear,
} from "./diagnosis-engine";

export type {
  PrimaryFear,
  DiagnosisResponse,
  DiagnosisBuildContext,
  ConfidenceModelInput,
  ConfidenceLevel,
  ConfidenceResult,
  SensitivityResult,
};
export {
  Diagnosis,
  coercePrimaryFear,
  classifyUser,
  buildResponse,
  deriveMetrics,
  computeTargetRunway,
  calculateConfidence,
  generateSensitivity,
  defaultConfidenceModel,
};
export type { CashRange, IncomeRange, SavingsRange, SavingsRateRange } from "./tier-reference";
export {
  INCOME_MID,
  SAVINGS_MID,
  SAVINGS_RATE_MID,
  SAVINGS_RATE_ORDER,
} from "./tier-reference";

export type Horizon = "short" | "long";
export type Status = "critical" | "risk" | "warning" | "ok";

export type IncomeStability =
  | "steady"
  | "variable_flat"
  | "variable_improving"
  | "variable_worsening"
  | "irregular";

export type DebtPressure = "none" | "light" | "moderate" | "heavy";

/** Housing cost situation; mapped into debtPressure for scenario logic. */
export type MortgagePressure =
  | "rent_no_mortgage"
  | "own_no_mortgage"
  | "mortgage_comfortable"
  | "mortgage_noticeable"
  | "mortgage_heavy"
  | "housing_clear"
  | "housing_ok"
  | "housing_tight"
  | "housing_heavy";

export function mortgageToDebtPressure(m: MortgagePressure): DebtPressure {
  switch (m) {
    case "rent_no_mortgage":
    case "own_no_mortgage":
    case "housing_clear":
      return "none";
    case "mortgage_comfortable":
    case "housing_ok":
      return "light";
    case "mortgage_noticeable":
    case "housing_tight":
      return "moderate";
    case "mortgage_heavy":
    case "housing_heavy":
      return "heavy";
  }
}

export type SavingsMix =
  | "all_cash"
  | "mostly_cash"
  | "balanced"
  | "mostly_invested"
  | "almost_all_invested";

export interface FinancialInput {
  savings_total: number;
  cash_amount: number;
  investments_amount: number;
  monthly_expenses: number;
  monthly_savings_rate: number;
  monthly_income_estimate: number;
  primary_fear: PrimaryFear;
  /** English display name (scenarios, legacy formatters). */
  country: string;
  /** ISO 3166-1 alpha-2 for currency/locale. */
  countryCode: string;
  hasInvestments: boolean;
  horizon: Horizon;
  incomeStability: IncomeStability;
  debtPressure: DebtPressure;
}

export interface FinancialMetrics {
  runway: number;
  required_cash: number;
  gap: number;
}

/** Diagnosis output + numeric liquidity metrics for charts and tables. */
export interface FinancialResult {
  diagnosis: Diagnosis;
  verdict: string;
  summary: string;
  /** Human-readable metric lines for UI. */
  metrics: {
    runway: string;
    target: string;
    gap: string;
  };
  insight: string;
  projection: string;
  action: string;
  reassurance: string;
  confidence: ConfidenceResult;
  sensitivity: SensitivityResult;
  status: Status;
  financialMetrics: FinancialMetrics;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const SAFE_FALLBACK: FinancialResult = {
  diagnosis: Diagnosis.InsufficientBuffer,
  verdict: "We need clearer numbers before this can be useful.",
  summary:
    "Some inputs look inconsistent. Update onboarding with realistic spending and savings.",
  metrics: { runway: "—", target: "—", gap: "—" },
  insight:
    "Without solid numbers, any read would be a guess. That is not what you want here.",
  projection:
    "Come back after you refresh your profile with figures you trust.",
  action: "Redo onboarding with your best real estimates.",
  reassurance: "Nothing needs rushing right now.",
  confidence: {
    level: "low",
    reason: "Low confidence — missing or unclear inputs.",
  },
  sensitivity: {
    what_changes: [
      "Enter spending and savings figures that match each other.",
      "Update cash and longer-term savings so totals line up.",
    ],
  },
  status: "warning",
  financialMetrics: { runway: 0, required_cash: 0, gap: 0 },
};

const VALID_FEAR = new Set<PrimaryFear>([
  "income_loss",
  "market_crash",
  "making_mistake",
  "missing_opportunities",
]);

function isValid(input: FinancialInput): boolean {
  if (!Number.isFinite(input.savings_total) || input.savings_total < 0)
    return false;
  if (!Number.isFinite(input.cash_amount) || input.cash_amount < 0)
    return false;
  if (!Number.isFinite(input.investments_amount) || input.investments_amount < 0)
    return false;
  if (!Number.isFinite(input.monthly_expenses) || input.monthly_expenses <= 0)
    return false;
  if (
    !Number.isFinite(input.monthly_savings_rate) ||
    input.monthly_savings_rate < 0 ||
    input.monthly_savings_rate > 1
  )
    return false;
  if (typeof input.country !== "string" || !input.country.trim()) return false;
  if (typeof input.countryCode !== "string" || !input.countryCode.trim())
    return false;
  if (
    !Number.isFinite(input.monthly_income_estimate) ||
    input.monthly_income_estimate <= 0
  )
    return false;
  if (typeof input.hasInvestments !== "boolean") return false;
  if (input.horizon !== "short" && input.horizon !== "long") return false;
  if (!VALID_FEAR.has(input.primary_fear)) return false;
  const st = input.incomeStability;
  const dp = input.debtPressure;
  if (
    st !== "steady" &&
    st !== "variable_flat" &&
    st !== "variable_improving" &&
    st !== "variable_worsening" &&
    st !== "irregular"
  )
    return false;
  if (dp !== "none" && dp !== "light" && dp !== "moderate" && dp !== "heavy")
    return false;
  return true;
}

// ---------------------------------------------------------------------------
// Output guardrails
// ---------------------------------------------------------------------------

const FORBIDDEN: RegExp[] = [
  /\bbitcoin\b/i,
  /\bethereum\b/i,
  /\bcrypto(?:currency)?\b/i,
  /\bnft\b/i,
  /\$[A-Z]{1,5}\b/,
  /\b(?:Tesla|Apple|Amazon|Nvidia|Google|Meta)\s+stock\b/i,
  /\b(?:TSLA|AAPL|AMZN|NVDA|GOOG|GOOGL|META)\b/,
  /\bguaranteed?\b/i,
  /\bwill\s+(?:definitely|certainly|absolutely|surely)\b/i,
  /\balways\s+goes?\s+up\b/i,
  /\bnever\s+(?:loses?|drops?|fails?)\b/i,
  /\brisk[- ]?free\b/i,
  /\b(?:act|buy|sell|invest)\s+(?:now|immediately|today|asap)\b/i,
  /\byou\s+must\s+(?:buy|sell|invest|act)\b/i,
  /\burgent(?:ly)?\b/i,
  /\bbefore\s+it(?:'s|\s+is)\s+too\s+late\b/i,
  /\bFOMO\b/i,
  /\bput\s+\d+%/i,
  /\ballocate\s+\d+%/i,
  /\binvest\s+\$[\d,]+/i,
  /\bbuy\s+\$[\d,]+\s+(?:of|in|worth)\b/i,
];

function isSafeText(text: string): boolean {
  return FORBIDDEN.every((pattern) => !pattern.test(text));
}

function sanitizeResult(result: FinancialResult): FinancialResult {
  const fields = [
    result.verdict,
    result.summary,
    result.metrics.runway,
    result.metrics.target,
    result.metrics.gap,
    result.insight,
    result.projection,
    result.action,
    result.reassurance,
    result.confidence.reason,
    ...result.sensitivity.what_changes,
  ];
  for (const text of fields) {
    if (!isSafeText(text)) return SAFE_FALLBACK;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getFinancialStatus(input: FinancialInput): FinancialResult {
  if (!isValid(input)) return SAFE_FALLBACK;
  return sanitizeResult(evaluate(input));
}

// ---------------------------------------------------------------------------
// Diagnosis pipeline
// ---------------------------------------------------------------------------

function diagnosisToStatus(d: Diagnosis): Status {
  switch (d) {
    case Diagnosis.CriticalBuffer:
      return "critical";
    case Diagnosis.InsufficientBuffer:
      return "risk";
    case Diagnosis.LimitedBuffer:
      return "warning";
    case Diagnosis.Overinvested:
      return "warning";
    case Diagnosis.TooConservative:
    case Diagnosis.BalancedButIdle:
    case Diagnosis.Healthy:
      return "ok";
    default:
      return "warning";
  }
}

function fmtMoneyForInput(input: FinancialInput): (n: number) => string {
  const { currency, locale } = currencyLocaleFromCountryCode(input.countryCode);
  return (n: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Math.round(Math.abs(n)));
}

function evaluate(input: FinancialInput): FinancialResult {
  const derived = deriveMetrics({
    monthly_expenses: input.monthly_expenses,
    cash_amount: input.cash_amount,
    investments_amount: input.investments_amount,
    incomeStability: input.incomeStability,
    debtPressure: input.debtPressure,
    primaryFear: input.primary_fear,
  });

  const diagnosis = classifyUser(derived);
  const ctx: DiagnosisBuildContext = {
    ...derived,
    monthly_expenses: input.monthly_expenses,
    primary_fear: input.primary_fear,
    fmtMoney: fmtMoneyForInput(input),
  };

  const confidenceInput: ConfidenceModelInput = {
    monthly_expenses: input.monthly_expenses,
    monthly_income_estimate: input.monthly_income_estimate,
    savings_total: input.savings_total,
    cash_amount: input.cash_amount,
    investments_amount: input.investments_amount,
  };

  const built = buildResponse(diagnosis, ctx, confidenceInput);
  const financialMetrics: FinancialMetrics = {
    runway: derived.runway_months,
    required_cash: derived.required_cash,
    gap: derived.gap,
  };

  return {
    ...built,
    status: diagnosisToStatus(diagnosis),
    financialMetrics,
  };
}

// ---------------------------------------------------------------------------
// Onboarding → numeric context
// ---------------------------------------------------------------------------

export type ExpensesRange = "lt2k" | "2k-4k" | "4k-7k" | "gt7k";

export type { CountryCode } from "./countries";

export interface OnboardingInput {
  income: IncomeRange;
  savings: SavingsRange;
  savingsRate: SavingsRateRange;
  /** ISO 3166-1 alpha-2 (or OTHER). */
  country: string;
  savingsMix: SavingsMix;
  incomeStability: IncomeStability;
  mortgagePressure: MortgagePressure;
  /** Main worry; defaults to making_mistake when omitted. */
  primaryFear?: PrimaryFear;
  /** Override for monthly expenses — uses income × (1 − savingsRate) if omitted. */
  expensesOverride?: number;
}

export const EXPENSES_MID: Record<ExpensesRange, number> = {
  lt2k: 1_500,
  "2k-4k": 3_000,
  "4k-7k": 5_500,
  gt7k: 9_000,
};

/** Maps onboarding mix choice to cash / invested split (deterministic mids). */
export function splitSavingsByMix(
  savingsTotal: number,
  mix: SavingsMix,
): {
  cash_amount: number;
  investments_amount: number;
  hasInvestments: boolean;
} {
  const t = Math.max(0, savingsTotal);
  switch (mix) {
    case "all_cash":
      return {
        cash_amount: t,
        investments_amount: 0,
        hasInvestments: false,
      };
    case "mostly_cash":
      return {
        cash_amount: t * 0.85,
        investments_amount: t * 0.15,
        hasInvestments: true,
      };
    case "balanced":
      return {
        cash_amount: t * 0.55,
        investments_amount: t * 0.45,
        hasInvestments: true,
      };
    case "mostly_invested":
      return {
        cash_amount: t * 0.3,
        investments_amount: t * 0.7,
        hasInvestments: true,
      };
    case "almost_all_invested":
      return {
        cash_amount: t * 0.12,
        investments_amount: t * 0.88,
        hasInvestments: true,
      };
  }
}

/** Nearest cash tier for persisting legacy-shaped rows. */
export function cashAmountToNearestRange(amount: number): CashRange {
  const keys = Object.keys(CASH_MID) as CashRange[];
  let best: CashRange = "1k-5k";
  let bestDiff = Infinity;
  for (const k of keys) {
    const d = Math.abs(CASH_MID[k] - amount);
    if (d < bestDiff) {
      bestDiff = d;
      best = k;
    }
  }
  return best;
}

/** Infer mix from legacy cash + savings tiers (URL / old profiles). */
export function inferSavingsMixFromLegacy(
  savings: SavingsRange,
  cash: CashRange,
  hasInvestments: boolean,
  countryCode = "US",
): SavingsMix {
  if (!hasInvestments) return "all_cash";
  const currency = countryMeta(countryCode).currency;
  const t = savingsTierMid(currency, savings);
  if (t <= 0) return "balanced";
  const c = Math.min(cashTierMid(currency, cash), t);
  const ratio = c / t;
  if (ratio >= 0.72) return "mostly_cash";
  if (ratio >= 0.42) return "balanced";
  if (ratio >= 0.18) return "mostly_invested";
  return "almost_all_invested";
}

export function fromOnboarding(input: OnboardingInput): FinancialInput {
  const code = input.country;
  const currency = countryMeta(code).currency;
  const savings_total = savingsTierMid(currency, input.savings);
  const monthly_savings_rate = SAVINGS_RATE_MID[input.savingsRate];
  const monthly_income_estimate = incomeTierMid(currency, input.income);
  const spendRatio = Math.max(0.15, Math.min(0.92, 1 - monthly_savings_rate));
  const calculatedExpenses = Math.max(
    minMonthlyExpenseFloor(currency),
    Math.round(monthly_income_estimate * spendRatio),
  );
  const monthly_expenses =
    input.expensesOverride != null && input.expensesOverride > 0
      ? Math.max(minMonthlyExpenseFloor(currency), Math.round(input.expensesOverride))
      : calculatedExpenses;
  const country = countryLabel(code);

  const { cash_amount, investments_amount, hasInvestments } =
    splitSavingsByMix(savings_total, input.savingsMix);

  const primary_fear = input.primaryFear ?? "making_mistake";

  return {
    savings_total,
    cash_amount,
    investments_amount,
    monthly_expenses,
    monthly_savings_rate,
    monthly_income_estimate,
    primary_fear,
    country,
    countryCode: code,
    hasInvestments,
    horizon: "long",
    incomeStability: input.incomeStability,
    debtPressure: mortgageToDebtPressure(input.mortgagePressure),
  };
}

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

/** End-to-end checks with full engine inputs (currency formatting path). */
export const ENGINE_INTEGRATION_CASES: {
  label: string;
  input: FinancialInput;
  expectDiagnosis: Diagnosis;
  expectConfidence: ConfidenceLevel;
}[] = [
  {
    label: "Very low runway → critical_buffer",
    input: {
      savings_total: 5_000,
      cash_amount: 800,
      investments_amount: 4_200,

      monthly_expenses: 3_000,
      monthly_savings_rate: 0.1,
      monthly_income_estimate: 4_000,
      primary_fear: "making_mistake",
      country: "United States",
      countryCode: "US",
      hasInvestments: true,
      horizon: "short",
      incomeStability: "steady",
      debtPressure: "light",
    },
    expectDiagnosis: Diagnosis.CriticalBuffer,
    expectConfidence: "high",
  },
  {
    label: "Mid runway → limited_buffer",
    input: {
      savings_total: 40_000,
      cash_amount: 15_000,
      investments_amount: 25_000,

      monthly_expenses: 4_000,
      monthly_savings_rate: 0.15,
      monthly_income_estimate: 7_500,
      primary_fear: "making_mistake",
      country: "Germany",
      countryCode: "DE",
      hasInvestments: true,
      horizon: "long",
      incomeStability: "steady",
      debtPressure: "none",
    },
    expectDiagnosis: Diagnosis.LimitedBuffer,
    expectConfidence: "high",
  },
  {
    label: "Strong buffer → healthy",
    input: {
      savings_total: 80_000,
      cash_amount: 50_000,
      investments_amount: 30_000,

      monthly_expenses: 5_000,
      monthly_savings_rate: 0.2,
      monthly_income_estimate: 12_500,
      primary_fear: "making_mistake",
      country: "United Kingdom",
      countryCode: "GB",
      hasInvestments: true,
      horizon: "long",
      incomeStability: "steady",
      debtPressure: "none",
    },
    expectDiagnosis: Diagnosis.Healthy,
    expectConfidence: "high",
  },
  {
    label: "Heavy investments, short runway → overinvested",
    input: {
      savings_total: 20_000,
      cash_amount: 3_000,
      investments_amount: 17_000,

      monthly_expenses: 2_000,
      monthly_savings_rate: 0.1,
      monthly_income_estimate: 5_000,
      primary_fear: "market_crash",
      country: "United States",
      countryCode: "US",
      hasInvestments: true,
      horizon: "long",
      incomeStability: "variable_flat",
      debtPressure: "moderate",
    },
    expectDiagnosis: Diagnosis.Overinvested,
    expectConfidence: "high",
  },
  {
    label: "Very long cash runway, little invested → too_conservative",
    input: {
      savings_total: 120_000,
      cash_amount: 120_000,
      investments_amount: 0,

      monthly_expenses: 4_000,
      monthly_savings_rate: 0.15,
      monthly_income_estimate: 8_000,
      primary_fear: "missing_opportunities",
      country: "United States",
      countryCode: "US",
      hasInvestments: false,
      horizon: "long",
      incomeStability: "steady",
      debtPressure: "none",
    },
    expectDiagnosis: Diagnosis.TooConservative,
    expectConfidence: "high",
  },
];

if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
  let failed = 0;
  const fmtTest = (n: number) => String(Math.round(Math.abs(n)));

  for (const tc of DIAGNOSIS_TEST_CASES) {
    const d = deriveMetrics(tc.input);
    const got = classifyUser(d);
    const passDx = got === tc.expect;
    if (!passDx) failed++;

    const modelIn = defaultConfidenceModel(tc);
    const conf = calculateConfidence(modelIn, d);
    const passConf = conf.level === tc.expectConfidence;
    if (!passConf) failed++;

    const sens = generateSensitivity(got, d, modelIn, fmtTest);
    let passSens = true;
    if (tc.sensitivityMustInclude?.length) {
      const blob = sens.join(" ");
      passSens = tc.sensitivityMustInclude.every((s) => blob.includes(s));
      if (!passSens) failed++;
    }

    console.log(
      `${passDx && passConf && passSens ? "\u2713" : "\u2717"} [derive] ${tc.label}: dx="${got}" conf="${conf.level}" sens=${sens.length}`,
    );
  }
  for (const tc of ENGINE_INTEGRATION_CASES) {
    const result = getFinancialStatus(tc.input);
    const passDx = result.diagnosis === tc.expectDiagnosis;
    const passConf = result.confidence.level === tc.expectConfidence;
    if (!passDx || !passConf) failed++;
    console.log(
      `${passDx && passConf ? "\u2713" : "\u2717"} [engine] ${tc.label}: dx="${result.diagnosis}" conf="${result.confidence.level}"`,
    );
  }
  if (failed) process.exitCode = 1;
}
