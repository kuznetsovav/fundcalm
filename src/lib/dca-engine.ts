/**
 * DCA recommendation engine: profile → risk bucket → allocation + suggested amount.
 *
 * Pure and deterministic. No live data, no AI, no I/O. Live prices and AI
 * explanations layer on top of this in route handlers.
 *
 * Amount semantics: monthly_amount is in the user's profile currency. The
 * schedule and UI keep that currency end-to-end; Revolut applies FX on buy.
 */

import { Diagnosis } from "./diagnosis-engine";
import type {
  AssetSlice,
  DcaAllocation,
  DcaInput,
  DcaPlan,
  RiskBucket,
  SuggestedAmount,
} from "./dca-types";

export const RISK_BUCKETS: readonly RiskBucket[] = [
  "conservative",
  "balanced",
  "growth",
] as const;

const ALLOCATION_BY_BUCKET: Record<RiskBucket, AssetSlice[]> = {
  conservative: [
    { ticker: "VT", weight: 0.5 },
    { ticker: "BNDW", weight: 0.5 },
  ],
  balanced: [
    { ticker: "VT", weight: 0.75 },
    { ticker: "BNDW", weight: 0.25 },
  ],
  growth: [
    { ticker: "VT", weight: 0.9 },
    { ticker: "BNDW", weight: 0.1 },
  ],
};

export function pickRiskBucket(
  input: Pick<DcaInput, "primary_fear" | "incomeStability">,
): RiskBucket {
  // Fragile income tilts down one bucket: protects against the case where
  // income volatility forces selling into a drawdown.
  const fragile =
    input.incomeStability === "irregular" ||
    input.incomeStability === "variable_worsening";

  switch (input.primary_fear) {
    case "market_crash":
      return fragile ? "conservative" : "balanced";
    case "income_loss":
      return fragile ? "conservative" : "balanced";
    case "making_mistake":
      return "balanced";
    case "missing_opportunities":
      return fragile ? "balanced" : "growth";
  }
}

function rationaleFor(bucket: RiskBucket): string {
  switch (bucket) {
    case "conservative":
      return "Tilted toward bonds for stability. Equities still capture long-term growth, but less of your contribution rides on market swings.";
    case "balanced":
      return "Standard global mix: most in stocks for growth, a bond layer to soften drawdowns. A reasonable default for a multi-year horizon.";
    case "growth":
      return "Heavily weighted to global equities. Higher long-run expected returns, larger short-term swings — only meaningful if you can leave it untouched for years.";
  }
}

export function buildAllocation(bucket: RiskBucket): DcaAllocation {
  return {
    riskBucket: bucket,
    slices: ALLOCATION_BY_BUCKET[bucket],
    rationale: rationaleFor(bucket),
  };
}

function symbolicMonthly(monthly_income: number): number {
  return Math.max(50, Math.min(200, Math.round(monthly_income * 0.01)));
}

export function buildSuggestedAmount(input: DcaInput): SuggestedAmount {
  const {
    diagnosis,
    monthly_income,
    monthly_savings_rate,
    cash_amount,
    required_cash,
  } = input;

  if (
    diagnosis === Diagnosis.CriticalBuffer ||
    diagnosis === Diagnosis.InsufficientBuffer
  ) {
    return {
      monthly_amount: null,
      mode: "deferred",
      rationale:
        "Your cash buffer is the priority right now. Investing while runway is short means risking forced sales at a bad time. Treat this as a preview for once the cushion is in place.",
    };
  }

  if (diagnosis === Diagnosis.Overinvested) {
    return {
      monthly_amount: null,
      mode: "deferred",
      rationale:
        "You already hold significant investments while cash is thin. Adding more before rebuilding the cushion raises forced-sale risk. Use this page to plan, not to buy more yet.",
    };
  }

  if (diagnosis === Diagnosis.LimitedBuffer) {
    return {
      monthly_amount: symbolicMonthly(monthly_income),
      mode: "symbolic",
      rationale:
        "While you finish building the cushion, a small fixed amount is about habit, not impact. Once your buffer is at target, scale this up.",
    };
  }

  if (diagnosis === Diagnosis.TooConservative) {
    const surplus = Math.max(0, cash_amount - required_cash);
    const monthly = Math.max(50, Math.round((surplus * 0.1) / 12));
    return {
      monthly_amount: monthly,
      mode: "surplus",
      rationale:
        "Roughly 10% of your cash surplus, spread across a year. Gradual is fine — there is no perfect entry point.",
    };
  }

  // BalancedButIdle | Healthy
  const fromIncome = Math.max(
    50,
    Math.round(monthly_income * monthly_savings_rate * 0.5),
  );
  return {
    monthly_amount: fromIncome,
    mode: "savings_rate",
    rationale:
      "About half of your monthly savings rate routed into longer-term investments. Adjust up or down to fit your goals.",
  };
}

function fearNoteFor(
  primary_fear: DcaInput["primary_fear"],
  bucket: RiskBucket,
): string {
  switch (primary_fear) {
    case "market_crash":
      return bucket === "conservative"
        ? "The bond-heavy mix means market drops hurt you less than an all-stock portfolio would. DCA spreads the entry so no single bad day defines your average price."
        : "Buying the same amount every month means you buy more shares when prices fall. You can't time the bottom, but consistency averages your entry price across cycles.";
    case "income_loss":
      return "DCA contributions are flexible — pause them when income wobbles, resume when it is steady. The amount shown is a target, not a commitment.";
    case "making_mistake":
      return "Broad index funds are the closest thing to a non-decision in investing. You are not picking winners; you are owning the whole market in proportion.";
    case "missing_opportunities":
      return "The bigger miss is rarely picking the wrong fund — it is staying on the sidelines for years. A monthly purchase keeps you participating without having to predict.";
  }
}

export function buildDcaPlan(input: DcaInput, override?: RiskBucket): DcaPlan {
  const bucket = override ?? pickRiskBucket(input);
  return {
    allocation: buildAllocation(bucket),
    amount: buildSuggestedAmount(input),
    fearNote: fearNoteFor(input.primary_fear, bucket),
  };
}

// ---------------------------------------------------------------------------
// Test cases (run with NODE_ENV=test: npm run test:dca)
// ---------------------------------------------------------------------------

interface DcaTestCase {
  label: string;
  input: DcaInput;
  expectMode: SuggestedAmount["mode"];
  expectBucket?: RiskBucket;
  expectAmountAtLeast?: number;
  expectAmountNull?: boolean;
}

export const DCA_TEST_CASES: DcaTestCase[] = [
  {
    label: "critical buffer → deferred",
    input: {
      monthly_income: 8_000,
      monthly_savings_rate: 0.1,
      cash_amount: 2_000,
      required_cash: 24_000,
      diagnosis: Diagnosis.CriticalBuffer,
      primary_fear: "income_loss",
      incomeStability: "steady",
    },
    expectMode: "deferred",
    expectAmountNull: true,
  },
  {
    label: "insufficient buffer → deferred",
    input: {
      monthly_income: 8_000,
      monthly_savings_rate: 0.15,
      cash_amount: 10_000,
      required_cash: 24_000,
      diagnosis: Diagnosis.InsufficientBuffer,
      primary_fear: "making_mistake",
      incomeStability: "steady",
    },
    expectMode: "deferred",
    expectAmountNull: true,
  },
  {
    label: "limited buffer → symbolic habit amount",
    input: {
      monthly_income: 8_000,
      monthly_savings_rate: 0.15,
      cash_amount: 18_000,
      required_cash: 24_000,
      diagnosis: Diagnosis.LimitedBuffer,
      primary_fear: "missing_opportunities",
      incomeStability: "steady",
    },
    expectMode: "symbolic",
    expectAmountAtLeast: 50,
  },
  {
    label: "too conservative → surplus / 12",
    input: {
      monthly_income: 8_000,
      monthly_savings_rate: 0.2,
      cash_amount: 80_000,
      required_cash: 24_000,
      diagnosis: Diagnosis.TooConservative,
      primary_fear: "missing_opportunities",
      incomeStability: "steady",
    },
    expectMode: "surplus",
    expectBucket: "growth",
    expectAmountAtLeast: 400,
  },
  {
    label: "healthy → savings_rate / 2",
    input: {
      monthly_income: 10_000,
      monthly_savings_rate: 0.2,
      cash_amount: 60_000,
      required_cash: 30_000,
      diagnosis: Diagnosis.Healthy,
      primary_fear: "making_mistake",
      incomeStability: "steady",
    },
    expectMode: "savings_rate",
    expectBucket: "balanced",
    expectAmountAtLeast: 900,
  },
  {
    label: "irregular income + market_crash → conservative",
    input: {
      monthly_income: 6_000,
      monthly_savings_rate: 0.1,
      cash_amount: 40_000,
      required_cash: 30_000,
      diagnosis: Diagnosis.Healthy,
      primary_fear: "market_crash",
      incomeStability: "irregular",
    },
    expectMode: "savings_rate",
    expectBucket: "conservative",
  },
];

if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
  let failed = 0;
  for (const tc of DCA_TEST_CASES) {
    const plan = buildDcaPlan(tc.input);
    const passMode = plan.amount.mode === tc.expectMode;
    const passBucket =
      tc.expectBucket == null ||
      plan.allocation.riskBucket === tc.expectBucket;
    const passNull =
      tc.expectAmountNull == null ||
      (tc.expectAmountNull && plan.amount.monthly_amount === null) ||
      (!tc.expectAmountNull && plan.amount.monthly_amount !== null);
    const passMin =
      tc.expectAmountAtLeast == null ||
      (plan.amount.monthly_amount != null &&
        plan.amount.monthly_amount >= tc.expectAmountAtLeast);

    const weightSum = plan.allocation.slices.reduce(
      (s, x) => s + x.weight,
      0,
    );
    const passWeights = Math.abs(weightSum - 1) < 1e-9;

    const ok = passMode && passBucket && passNull && passMin && passWeights;
    if (!ok) failed++;
    console.log(
      `${ok ? "✓" : "✗"} [dca] ${tc.label}: bucket=${plan.allocation.riskBucket} mode=${plan.amount.mode} amount=${plan.amount.monthly_amount}`,
    );
  }
  if (failed) process.exitCode = 1;
}
