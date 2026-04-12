/**
 * Diagnosis-based financial state: single mutually exclusive label + structured copy.
 * Deterministic only; all strings avoid tickers, product names, and banned hype patterns.
 */

export enum Diagnosis {
  CriticalBuffer = "critical_buffer",
  InsufficientBuffer = "insufficient_buffer",
  LimitedBuffer = "limited_buffer",
  Overinvested = "overinvested",
  TooConservative = "too_conservative",
  BalancedButIdle = "balanced_but_idle",
  Healthy = "healthy",
}

export type PrimaryFear =
  | "income_loss"
  | "market_crash"
  | "making_mistake"
  | "missing_opportunities";

export const PRIMARY_FEARS: readonly PrimaryFear[] = [
  "income_loss",
  "market_crash",
  "making_mistake",
  "missing_opportunities",
] as const;

export function coercePrimaryFear(raw: string): PrimaryFear | null {
  const t = raw.trim().toLowerCase().replace(/-/g, "_");
  if (
    t === "income_loss" ||
    t === "market_crash" ||
    t === "making_mistake" ||
    t === "missing_opportunities"
  ) {
    return t as PrimaryFear;
  }
  return null;
}

export interface DiagnosisDerived {
  liquid_savings: number;
  runway_months: number;
  total_assets: number;
  cash_ratio: number;
  investments_ratio: number;
  target_runway_months: number;
  required_cash: number;
  gap: number;
}

export interface DiagnosisBuildContext extends DiagnosisDerived {
  monthly_expenses: number;
  primary_fear: PrimaryFear;
  fmtMoney: (n: number) => string;
}

export type ConfidenceLevel = "high" | "medium" | "low";

export interface ConfidenceResult {
  level: ConfidenceLevel;
  /** Single sentence. */
  reason: string;
}

export interface SensitivityResult {
  what_changes: string[];
}

export interface DiagnosisResponse {
  diagnosis: Diagnosis;
  verdict: string;
  summary: string;
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
}

/** Fields used to judge how trustworthy the diagnosis is (no circular import from engine). */
export interface ConfidenceModelInput {
  monthly_expenses: number;
  monthly_income_estimate: number;
  savings_total: number;
  cash_amount: number;
  investments_amount: number;
}

const REASON_HIGH =
  "High confidence — your inputs give a clear picture.";
const REASON_LOW = "Low confidence — missing or unclear inputs.";
const REASON_LOW_MISMATCH =
  "Low confidence — totals and splits you entered don't line up well; revisiting 'Money allocation' in onboarding would sharpen this.";
const REASON_LOW_SPEND =
  "Low confidence — spending is higher than income in your entries; check the income and savings-rate steps.";

function totalAssets(inp: ConfidenceModelInput): number {
  return inp.cash_amount + inp.investments_amount;
}

function savingsMismatchRatio(inp: ConfidenceModelInput): number {
  const t = inp.savings_total;
  const parts = totalAssets(inp);
  if (t <= 0) return 0;
  return Math.abs(parts - t) / t;
}

/**
 * How reliable the label is given coarse ranges and internal consistency.
 */
export function calculateConfidence(
  input: ConfidenceModelInput,
  derived: DiagnosisDerived,
): ConfidenceResult {
  const r = derived.runway_months;
  const invR = derived.investments_ratio;
  const target = derived.target_runway_months;
  const mismatch = savingsMismatchRatio(input);

  if (input.monthly_expenses > input.monthly_income_estimate) {
    return { level: "low", reason: REASON_LOW_SPEND };
  }

  if (input.cash_amount === 0 && input.investments_amount > 0) {
    return {
      level: "low",
      reason:
        "Low confidence — no cash was entered with investments present; confirm your cash amount in onboarding.",
    };
  }

  if (input.savings_total >= 2_000 && mismatch > 0.35) {
    return { level: "low", reason: REASON_LOW_MISMATCH };
  }

  if (input.savings_total >= 2_000 && mismatch >= 0.12 && mismatch <= 0.35) {
    return {
      level: "medium",
      reason:
        "Medium confidence — your total savings and the cash/investment split don't quite align; refining 'Money allocation' in onboarding would tighten the read.",
    };
  }

  if (r > (target - 0.25) && r < (target + 0.25)) {
    return {
      level: "medium",
      reason: `Medium confidence — your cash runway is right on the ${target}-month boundary; a small change in spending or savings could shift the diagnosis.`,
    };
  }

  if (r > 2.75 && r < 3.25) {
    return {
      level: "medium",
      reason:
        "Medium confidence — your runway is near the 3-month boundary; small changes in spending or cash shift the diagnosis.",
    };
  }

  if (r < 3 && invR >= 0.55 && invR <= 0.65) {
    return {
      level: "medium",
      reason:
        "Medium confidence — thin cash with significant investments means the label could flip with a small adjustment to your mix.",
    };
  }

  if (r > 84) {
    return {
      level: "medium",
      reason:
        "Medium confidence — very high savings relative to expenses; estimates are wider when totals are large.",
    };
  }

  return { level: "high", reason: REASON_HIGH };
}

function runwayGainMonths(
  cash: number,
  exp: number,
  reduceExpBy: number,
): number {
  if (reduceExpBy <= 0 || exp <= reduceExpBy) return 0;
  const before = cash / exp;
  const after = cash / (exp - reduceExpBy);
  return Math.round((after - before) * 10) / 10;
}

function runwayLossFromHigherSpending(
  cash: number,
  currentExp: number,
  increase: number,
): number {
  if (increase <= 0 || currentExp <= 0) return 0;
  const before = cash / currentExp;
  const after = cash / (currentExp + increase);
  return Math.round((before - after) * 10) / 10;
}

/**
 * Concrete, deterministic bullets for what could change the diagnosis.
 */
export function generateSensitivity(
  diagnosis: Diagnosis,
  derived: DiagnosisDerived,
  input: ConfidenceModelInput,
  fmt: (n: number) => string,
): string[] {
  const out: string[] = [];
  const exp = input.monthly_expenses;
  const cash = input.cash_amount;
  const inv = input.investments_amount;
  const gap = derived.gap;
  const req = derived.required_cash;
  const trim = Math.max(0, Math.round(exp * 0.1));
  const stepCash = Math.max(500, Math.round(gap / 3));

  switch (diagnosis) {
    case Diagnosis.CriticalBuffer:
    case Diagnosis.InsufficientBuffer:
    case Diagnosis.LimitedBuffer: {
      const tgt = derived.target_runway_months;
      if (gap > 0) {
        out.push(
          `Adding about ${fmt(stepCash)} in cash you can use soon moves you toward your ${tgt}-month cushion.`,
        );
        if (trim > 0) {
          const addM = runwayGainMonths(cash, exp, trim);
          if (addM > 0) {
            out.push(
              `Lowering monthly outgoings by about ${fmt(trim)} adds roughly ${addM} months of runway with your current cash.`,
            );
          }
        }
      }
      out.push(
        "Saving more of your take-home to cash instead of spending it widens the buffer the same way.",
      );
      out.push(
        "A steady bump in income that you bank as cash shortens the time to a full cushion.",
      );
      break;
    }

    case Diagnosis.Overinvested: {
      const tgt = derived.target_runway_months;
      const shift = Math.min(inv * 0.15, Math.max(gap, Math.round(inv * 0.05)));
      const shiftRounded = Math.max(500, Math.round(shift));
      out.push(
        `Moving about ${fmt(shiftRounded)} from longer-term savings into everyday cash over time lifts liquidity.`,
      );
      out.push(
        `Building cash toward about ${fmt(req)} matches the ${tgt}-month target for your profile.`,
      );
      out.push(
        "Trimming spending while you add to cash speeds the shift without forced sales.",
      );
      break;
    }

    case Diagnosis.TooConservative: {
      const surplus = Math.max(0, cash - req);
      const slice =
        surplus > 0
          ? Math.max(1_000, Math.round(surplus * 0.1))
          : Math.max(1_000, Math.round(cash * 0.05));
      out.push(
        `Keeping your cushion intact, moving about ${fmt(slice)} from extra cash into longer-term savings each year is one steady path.`,
      );
      out.push(
        "If spending rises a lot, today's surplus cash may shrink—recheck before moving money.",
      );
      out.push(
        "Higher returns usually mean accepting more ups and downs than cash in the bank.",
      );
      break;
    }

    case Diagnosis.BalancedButIdle: {
      const tgt = derived.target_runway_months;
      const add = Math.max(1_000, Math.round(totalAssets(input) * 0.05));
      out.push(
        `Adding about ${fmt(add)} to longer-term savings over the next year tilts the mix without touching your cushion.`,
      );
      out.push(
        "A drop in income or a jump in spending could shrink runway enough to change this label.",
      );
      out.push(
        `Large one-off costs paid from cash can temporarily pull you below ${tgt} months.`,
      );
      break;
    }

    case Diagnosis.Healthy: {
      const tgt = derived.target_runway_months;
      if (trim > 0) {
        const loss = runwayLossFromHigherSpending(cash, exp, trim);
        if (loss > 0) {
          out.push(
            `Raising monthly spending by about ${fmt(trim)} without adding cash would cut runway by roughly ${loss} months.`,
          );
        }
      }
      out.push(
        `Losing income or adding fixed costs can move you below ${tgt} months of cash faster than it feels.`,
      );
      out.push(
        "Moving a big slice of cash into longer-term savings at once could flip you toward thin cash if bills stay the same.",
      );
      break;
    }
  }

  return out.filter(Boolean).slice(0, 4);
}

/**
 * Personalised cash-runway target based on income stability and housing pressure.
 *
 * Profile → target months:
 *   Steady + light housing  → 4
 *   Steady + heavy housing  → 6
 *   Variable income         → 7
 *   Variable + heavy housing→ 8
 *   Irregular income        → 8
 *   Irregular + heavy housing → 10
 */
export function computeTargetRunway(
  incomeStability?: string,
  debtPressure?: string,
  primaryFear?: string,
): number {
  const irregular = incomeStability === "irregular";
  const variable =
    !irregular &&
    (incomeStability === "variable_flat" ||
      incomeStability === "variable_improving" ||
      incomeStability === "variable_worsening");
  const heavy = debtPressure === "heavy" || debtPressure === "moderate";

  let base: number;
  if (irregular && heavy) base = 10;
  else if (irregular) base = 8;
  else if (variable && heavy) base = 8;
  else if (variable) base = 7;
  else if (heavy) base = 6;
  else base = 4;

  // Income anxiety warrants 1 extra month of buffer; market-crash fear needs
  // accessible cash before selling investments, so 0.5 months extra.
  const fearExtra =
    primaryFear === "income_loss" ? 1 :
    primaryFear === "market_crash" ? 0.5 : 0;

  return base + fearExtra;
}

export function deriveMetrics(input: {
  monthly_expenses: number;
  cash_amount: number;
  investments_amount: number;
  /** Optional — used to personalise the cash-runway target. */
  incomeStability?: string;
  /** Optional — used to personalise the cash-runway target. */
  debtPressure?: string;
  /** Optional — fear-based target adjustment. */
  primaryFear?: string;
}): DiagnosisDerived {
  const liquid_savings = input.cash_amount;
  const monthly_expenses = input.monthly_expenses;
  const runway_months = liquid_savings / monthly_expenses;
  const total_assets = input.cash_amount + input.investments_amount;
  const cash_ratio = total_assets > 0 ? input.cash_amount / total_assets : 1;
  const investments_ratio =
    total_assets > 0 ? input.investments_amount / total_assets : 0;
  const target_runway_months = computeTargetRunway(
    input.incomeStability,
    input.debtPressure,
    input.primaryFear,
  );
  const required_cash = monthly_expenses * target_runway_months;
  const gap = required_cash - liquid_savings;

  return {
    liquid_savings,
    runway_months,
    total_assets,
    cash_ratio,
    investments_ratio,
    target_runway_months,
    required_cash,
    gap,
  };
}

/**
 * Mutually exclusive diagnosis; first matching rule wins.
 * Uses the personalised target_runway_months from derived metrics.
 */
export function classifyUser(derived: DiagnosisDerived): Diagnosis {
  const r = derived.runway_months;
  const inv = derived.investments_ratio;
  const cashR = derived.cash_ratio;
  const target = derived.target_runway_months;

  if (r < 1) return Diagnosis.CriticalBuffer;
  if (r < 3 && inv > 0.6) return Diagnosis.Overinvested;
  if (r >= 1 && r < 3) return Diagnosis.InsufficientBuffer;
  if (r >= 3 && r < target) return Diagnosis.LimitedBuffer;
  if (r >= target && cashR > 0.7) return Diagnosis.TooConservative;
  if (r >= target && inv < 0.3) return Diagnosis.BalancedButIdle;
  if (r >= target && inv >= 0.3 && inv <= 0.7) return Diagnosis.Healthy;
  return Diagnosis.Healthy;
}

function roundRunway(r: number): string {
  const x = Math.round(r * 10) / 10;
  return x % 1 === 0 ? String(Math.round(x)) : String(x);
}

function insightFor(diagnosis: Diagnosis): string {
  switch (diagnosis) {
    case Diagnosis.CriticalBuffer:
      return "With almost no cash buffer, small surprises can feel like emergencies. The fix is adding cash you can reach quickly, not chasing returns.";
    case Diagnosis.InsufficientBuffer:
      return "You have some breathing room, but not enough months of spending in cash to feel steady through a rough patch.";
    case Diagnosis.LimitedBuffer:
      return "You are partway to a full cushion. The gap is mostly about time and habit, not about being bad with money.";
    case Diagnosis.Overinvested:
      return "A large share of savings sits outside everyday cash while your runway is short. Bills are paid from cash, not from longer-term balances.";
    case Diagnosis.TooConservative:
      return "Most of what you own is very safe cash. That lowers stress today but may grow slowly for goals years away.";
    case Diagnosis.BalancedButIdle:
      return "Your cushion looks solid, but longer-term savings are small. You are safe now; growth may be light later.";
    case Diagnosis.Healthy:
      return "Cash for near-term bills and longer-term savings look balanced for the simple rule we use here.";
    default:
      return "";
  }
}

function projectionFor(
  diagnosis: Diagnosis,
  fear: PrimaryFear,
  ctx: DiagnosisBuildContext,
): string {
  const r = roundRunway(ctx.runway_months);
  const gapUp = ctx.gap > 0;

  if (fear === "income_loss") {
    const a = `If income stopped tomorrow, cash would last about ${r} months at your spending level.`;
    const b = gapUp
      ? "Building the cushion shortens how long a gap would feel."
      : "That runway is the first line of defense while you replace income.";
    return `${a} ${b}`;
  }

  if (fear === "market_crash") {
    if (diagnosis === Diagnosis.Overinvested) {
      return "A drop in longer-term savings does not pay next month's rent. Thin cash can push people to sell at a bad time. Growing cash first lowers that pressure.";
    }
    return "Everyday spending is covered from cash. Longer-term savings can move up and down; your cushion is what keeps daily life steady.";
  }

  if (fear === "making_mistake") {
    const b =
      diagnosis === Diagnosis.Healthy || diagnosis === Diagnosis.TooConservative
        ? "Nothing here says you chose wrong—only how your numbers line up with a simple cushion rule."
        : "The setup is readable: more cash months first, then room to think about longer-term growth.";
    return `We target ${ctx.target_runway_months} months of spending in cash as a comfort line for your profile. You are ${gapUp ? "below" : "at or above"} that line for cash. ${b}`;
  }

  // missing_opportunities
  if (
    diagnosis === Diagnosis.TooConservative ||
    diagnosis === Diagnosis.BalancedButIdle
  ) {
    return "Extra cash beyond the cushion may grow slowly in a savings account. Longer-term options can help later—only when you feel ready and keep the cushion intact.";
  }
  if (gapUp) {
    return "The first opportunity is a calmer everyday life: finish the cash cushion. After that, longer-term growth is easier to think about.";
  }
  return "You are not obviously leaving safety behind. Any move toward growth should stay small and slow compared with the cushion.";
}

function verdictFor(diagnosis: Diagnosis): string {
  switch (diagnosis) {
    case Diagnosis.CriticalBuffer:
    case Diagnosis.InsufficientBuffer:
    case Diagnosis.LimitedBuffer:
    case Diagnosis.Overinvested:
      return "You don't have enough financial buffer.";
    case Diagnosis.TooConservative:
    case Diagnosis.BalancedButIdle:
      return "Your setup is safe but inefficient.";
    case Diagnosis.Healthy:
      return "You're financially stable.";
    default:
      return "";
  }
}

function summaryFor(diagnosis: Diagnosis, ctx: DiagnosisBuildContext): string {
  const r = roundRunway(ctx.runway_months);
  const fmt = ctx.fmtMoney;
  const need = fmt(ctx.required_cash);
  const target = ctx.target_runway_months;

  if (ctx.gap > 0) {
    return `Your ${fmt(ctx.liquid_savings)} in cash covers about ${r} months of expenses. We target ${target} months (${need}) for your income pattern — you're short by about ${fmt(ctx.gap)}.`;
  }
  if (ctx.gap < 0) {
    return `Your ${fmt(ctx.liquid_savings)} in cash covers about ${r} months of expenses. We target ${target} months (${need}) for your income pattern — you're about ${fmt(-ctx.gap)} above that.`;
  }
  return `Your ${fmt(ctx.liquid_savings)} in cash covers about ${r} months of expenses. We target ${target} months (${need}) for your income pattern — you're right on target.`;
}

function metricsStrings(ctx: DiagnosisBuildContext): DiagnosisResponse["metrics"] {
  const r = roundRunway(ctx.runway_months);
  const gap = ctx.gap;
  const fmt = ctx.fmtMoney;
  return {
    runway: `About ${r} months`,
    target: `${ctx.target_runway_months} months`,
    gap:
      gap > 0
        ? `About ${fmt(gap)} below target`
        : gap < 0
          ? `About ${fmt(-gap)} above target`
          : "On target",
  };
}

function actionFor(diagnosis: Diagnosis, ctx: DiagnosisBuildContext): string {
  const fmt = ctx.fmtMoney;
  switch (diagnosis) {
    case Diagnosis.CriticalBuffer:
    case Diagnosis.InsufficientBuffer:
    case Diagnosis.LimitedBuffer:
      return `Increase cash buffer to ${fmt(ctx.required_cash)}`;
    case Diagnosis.Overinvested:
      return "Reduce risk exposure";
    case Diagnosis.TooConservative:
    case Diagnosis.BalancedButIdle:
      return "Start investing gradually";
    case Diagnosis.Healthy:
      return "Do nothing";
    default:
      return "Do nothing";
  }
}

function reassuranceFor(diagnosis: Diagnosis): string {
  switch (diagnosis) {
    case Diagnosis.CriticalBuffer:
    case Diagnosis.InsufficientBuffer:
    case Diagnosis.LimitedBuffer:
    case Diagnosis.Overinvested:
      return "Better to act soon, but no panic needed.";
    case Diagnosis.TooConservative:
    case Diagnosis.BalancedButIdle:
    case Diagnosis.Healthy:
      return "Nothing needs rushing right now.";
    default:
      return "Nothing needs rushing right now.";
  }
}

function derivedFromContext(ctx: DiagnosisBuildContext): DiagnosisDerived {
  return {
    liquid_savings: ctx.liquid_savings,
    runway_months: ctx.runway_months,
    total_assets: ctx.total_assets,
    cash_ratio: ctx.cash_ratio,
    investments_ratio: ctx.investments_ratio,
    target_runway_months: ctx.target_runway_months,
    required_cash: ctx.required_cash,
    gap: ctx.gap,
  };
}

export function buildResponse(
  diagnosis: Diagnosis,
  ctx: DiagnosisBuildContext,
  confidenceInput: ConfidenceModelInput,
): DiagnosisResponse {
  const derived = derivedFromContext(ctx);
  return {
    diagnosis,
    verdict: verdictFor(diagnosis),
    summary: summaryFor(diagnosis, ctx),
    metrics: metricsStrings(ctx),
    insight: insightFor(diagnosis),
    projection: projectionFor(diagnosis, ctx.primary_fear, ctx),
    action: actionFor(diagnosis, ctx),
    reassurance: reassuranceFor(diagnosis),
    confidence: calculateConfidence(confidenceInput, derived),
    sensitivity: {
      what_changes: generateSensitivity(
        diagnosis,
        derived,
        confidenceInput,
        ctx.fmtMoney,
      ),
    },
  };
}

// ---------------------------------------------------------------------------
// Test cases (run with NODE_ENV=test: npm run test:diagnosis)
// ---------------------------------------------------------------------------

export type DiagnosisDerivationTestCase = {
  label: string;
  input: {
    monthly_expenses: number;
    cash_amount: number;
    investments_amount: number;
  };
  savings_total?: number;
  monthly_income_estimate?: number;
  expect: Diagnosis;
  expectConfidence: ConfidenceLevel;
  /** Each substring must appear in some sensitivity line. */
  sensitivityMustInclude?: string[];
};

export function defaultConfidenceModel(
  tc: DiagnosisDerivationTestCase,
): ConfidenceModelInput {
  const sum =
    tc.input.cash_amount +
    tc.input.investments_amount;
  return {
    monthly_expenses: tc.input.monthly_expenses,
    cash_amount: tc.input.cash_amount,
    investments_amount: tc.input.investments_amount,
    savings_total: tc.savings_total ?? sum,
    monthly_income_estimate:
      tc.monthly_income_estimate ??
      Math.max(
        Math.round(tc.input.monthly_expenses * 1.35),
        tc.input.monthly_expenses + 1,
      ),
  };
}

export const DIAGNOSIS_TEST_CASES: DiagnosisDerivationTestCase[] = [
  {
    label: "low cash, high investments → overinvested",
    input: {
      monthly_expenses: 2_000,
      cash_amount: 3_000,
      investments_amount: 17_000,

    },
    expect: Diagnosis.Overinvested,
    expectConfidence: "high",
    sensitivityMustInclude: ["Moving about", "month target"],
  },
  {
    label: "low savings runway → insufficient_buffer",
    input: {
      monthly_expenses: 2_000,
      cash_amount: 4_000,
      investments_amount: 1_000,

    },
    expect: Diagnosis.InsufficientBuffer,
    expectConfidence: "high",
    sensitivityMustInclude: ["Adding about"],
  },
  {
    label: "high cash, no investments → too_conservative",
    input: {
      monthly_expenses: 4_000,
      cash_amount: 120_000,
      investments_amount: 0,

    },
    expect: Diagnosis.TooConservative,
    expectConfidence: "high",
    sensitivityMustInclude: ["Keeping your cushion"],
  },
  {
    label: "strong setup → healthy",
    input: {
      monthly_expenses: 5_000,
      cash_amount: 35_000,
      investments_amount: 45_000,

    },
    expect: Diagnosis.Healthy,
    expectConfidence: "high",
    sensitivityMustInclude: ["income"],
  },
  {
    label: "medium runway → limited_buffer",
    input: {
      monthly_expenses: 2_500,
      cash_amount: 9_000,
      investments_amount: 15_000,

    },
    expect: Diagnosis.LimitedBuffer,
    expectConfidence: "high",
    sensitivityMustInclude: ["Adding about"],
  },
  {
    label: "spending above income → low confidence",
    input: {
      monthly_expenses: 6_000,
      cash_amount: 20_000,
      investments_amount: 5_000,

    },
    savings_total: 25_000,
    monthly_income_estimate: 4_000,
    expect: Diagnosis.LimitedBuffer,
    expectConfidence: "low",
  },
  {
    label: "near 4-month runway boundary (default target) → medium confidence",
    input: {
      monthly_expenses: 2_000,
      cash_amount: 7_800,
      investments_amount: 2_000,

    },
    expect: Diagnosis.LimitedBuffer,
    expectConfidence: "medium",
    sensitivityMustInclude: ["month cushion"],
  },
  {
    label: "large savings total mismatch → low confidence",
    input: {
      monthly_expenses: 2_000,
      cash_amount: 5_000,
      investments_amount: 5_000,

    },
    savings_total: 50_000,
    monthly_income_estimate: 5_000,
    expect: Diagnosis.InsufficientBuffer,
    expectConfidence: "low",
  },
];

