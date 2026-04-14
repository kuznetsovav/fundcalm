/**
 * Investment nudge: shown only when the user is financially stable and has
 * surplus cash or existing investments worth reviewing.
 *
 * Deterministic — no AI, no live data, no product names.
 */

import { Diagnosis, type PrimaryFear } from "./diagnosis-engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InvestmentNudgeMode = "invest" | "review" | null;

export interface InvestmentNudge {
  mode: InvestmentNudgeMode;
  title: string;
  /** Opening paragraph — sets the context. */
  body: string;
  /** Formatted amount suggested to move per year (Mode A only). */
  suggestedSliceLabel: string | null;
  /** Formatted excess cash above the target (Mode A only). */
  excessLabel: string | null;
  /** Months above target, rounded to 1 decimal (Mode A only). */
  excessMonths: number | null;
  /** Investments as % of total savings, rounded to int. */
  investmentsPercent: number | null;
  /** Formatted investment amount. */
  investmentsLabel: string | null;
  /** One sentence tailored to the user's primary fear. */
  fearNote: string;
  /** Three or four questions shown as bullets (Mode B only). */
  reviewQuestions: string[];
}

// ---------------------------------------------------------------------------
// Fear-aware copy
// ---------------------------------------------------------------------------

function fearNoteInvest(fear: PrimaryFear): string {
  switch (fear) {
    case "missing_opportunities":
      return "This is exactly where longer-term growth comes from. Your cushion is funded — you've already done the hard part.";
    case "market_crash":
      return "Moving money gradually and staying spread across options is how you reduce the impact of any single bad moment in markets.";
    case "income_loss":
      return "Your runway is covered. Surplus cash beyond the cushion doesn't need the same instant access, so it can work harder without putting your protection at risk.";
    case "making_mistake":
      return "Moving a small amount gradually is harder to get badly wrong than a large lump sum at once. There's no perfect timing here — slow and steady is fine.";
  }
}

function fearNoteReview(fear: PrimaryFear, investPct: number): string {
  switch (fear) {
    case "missing_opportunities":
      return `You already have a foothold in longer-term savings (${investPct}% of your total). Now is a reasonable time to think about whether it's doing what you want.`;
    case "market_crash":
      return "Market drops hurt most when you're forced to sell. Your cash buffer prevents that — your invested portion can ride out swings without threatening daily life.";
    case "income_loss":
      return "It's worth checking that your investments aren't too concentrated or tied up in something illiquid given how your income works.";
    case "making_mistake":
      return "Reviewing isn't committing to anything. It just means knowing where you stand — and that's never a mistake.";
  }
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

const NULL_NUDGE: InvestmentNudge = {
  mode: null,
  title: "",
  body: "",
  suggestedSliceLabel: null,
  excessLabel: null,
  excessMonths: null,
  investmentsPercent: null,
  investmentsLabel: null,
  fearNote: "",
  reviewQuestions: [],
};

export function buildInvestmentNudge(
  diagnosis: Diagnosis,
  derived: {
    cash_amount: number;
    investments_amount: number;
    investments_ratio: number;
    required_cash: number;
    runway_months: number;
    target_runway_months: number;
  },
  fear: PrimaryFear,
  hasInvestments: boolean,
  fmtMoney: (n: number) => string,
): InvestmentNudge {
  const {
    cash_amount,
    investments_amount,
    investments_ratio,
    required_cash,
    runway_months,
    target_runway_months,
  } = derived;

  // ── Mode A: TooConservative — lots of cash sitting idle ──
  if (diagnosis === Diagnosis.TooConservative) {
    const excess = Math.max(0, cash_amount - required_cash);
    const excessMonths =
      Math.round((runway_months - target_runway_months) * 10) / 10;
    const slicePerYear = Math.max(1_000, Math.round(excess * 0.1));
    const investPct = Math.round(investments_ratio * 100);

    const body =
      excess > 500
        ? `You have about ${excessMonths} month${excessMonths === 1 ? "" : "s"} above your target — roughly ${fmtMoney(excess)} beyond your safety net. That surplus doesn't have to sit still.`
        : `Your cash is above your target. Most of what you have is in cash — safe, but slow to grow over time.`;

    return {
      mode: "invest",
      title: "Beyond your cushion",
      body,
      suggestedSliceLabel: fmtMoney(slicePerYear),
      excessLabel: excess > 500 ? fmtMoney(excess) : null,
      excessMonths: excessMonths > 0 ? excessMonths : null,
      investmentsPercent: investPct,
      investmentsLabel:
        investments_amount > 0 ? fmtMoney(investments_amount) : null,
      fearNote: fearNoteInvest(fear),
      reviewQuestions: [],
    };
  }

  // ── Mode A: BalancedButIdle — solid cushion, light long-term savings ──
  if (diagnosis === Diagnosis.BalancedButIdle) {
    const excess = Math.max(0, cash_amount - required_cash);
    const excessMonths =
      Math.round((runway_months - target_runway_months) * 10) / 10;
    const slicePerYear = Math.max(
      1_000,
      Math.round((cash_amount + investments_amount) * 0.05),
    );
    const investPct = Math.round(investments_ratio * 100);

    const body =
      excess > 500
        ? `Your cushion is solid — about ${excessMonths} month${excessMonths === 1 ? "" : "s"} above your target. Longer-term savings are relatively light, which means there's room to build them without touching your buffer.`
        : `Your cash covers your target cushion. Your longer-term savings are relatively small — a reasonable point to start building them up.`;

    return {
      mode: "invest",
      title: "Beyond your cushion",
      body,
      suggestedSliceLabel: fmtMoney(slicePerYear),
      excessLabel: excess > 500 ? fmtMoney(excess) : null,
      excessMonths: excessMonths > 0 ? excessMonths : null,
      investmentsPercent: investPct,
      investmentsLabel:
        investments_amount > 0 ? fmtMoney(investments_amount) : null,
      fearNote: fearNoteInvest(fear),
      reviewQuestions: [],
    };
  }

  // ── Mode B: Healthy with investments — suggest periodic review ──
  if (diagnosis === Diagnosis.Healthy && hasInvestments) {
    const investPct = Math.round(investments_ratio * 100);

    const body = `You have ${fmtMoney(investments_amount)} in longer-term savings — about ${investPct}% of your total. Your cushion and your growth savings look balanced for your profile.`;

    return {
      mode: "review",
      title: "Your longer-term savings",
      body,
      suggestedSliceLabel: null,
      excessLabel: null,
      excessMonths: null,
      investmentsPercent: investPct,
      investmentsLabel: fmtMoney(investments_amount),
      fearNote: fearNoteReview(fear, investPct),
      reviewQuestions: [
        "Are you happy with how your investments are spread across different options?",
        "Does the level of risk still match how long you plan to leave the money there?",
        "Has your income stability or housing situation changed since you set it up?",
        "Are you adding to longer-term savings regularly, or just leaving the existing amount?",
      ],
    };
  }

  return NULL_NUDGE;
}
