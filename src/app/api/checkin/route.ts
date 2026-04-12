/**
 * POST /api/checkin
 *
 * Takes a snapshot of the user's current profile (before the update),
 * then upserts the new profile data. Sends a milestone email if the user
 * just crossed their cash-runway target for the first time.
 *
 * Body: { userId, income, savings, savingsRate, country, savingsMix,
 *          incomeStability, mortgagePressure, primaryFear?, expensesOverride? }
 * Returns: { userId }
 */

import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { saveUserProfile, getUserProfile, profileToOnboardingInput, getUserEmail } from "@/lib/profiles";
import { saveSnapshot } from "@/lib/snapshots";
import { VALID_COUNTRY_CODES } from "@/lib/countries";
import {
  INCOME_TIER_ORDER,
  SAVINGS_RATE_ORDER,
  SAVINGS_TIER_ORDER,
} from "@/lib/tier-reference";
import {
  getFinancialStatus,
  fromOnboarding,
  type IncomeRange,
  type SavingsRange,
  type SavingsRateRange,
  type SavingsMix,
  type IncomeStability,
  type MortgagePressure,
} from "@/lib/engine";
import { isEmailConfigured, sendMilestoneEmail } from "@/lib/email";
import { currencyLocaleFromCountryCode } from "@/lib/money-tiers";

const VALID_INCOME = new Set<string>(INCOME_TIER_ORDER);
const VALID_SAVINGS = new Set<string>(SAVINGS_TIER_ORDER);
const VALID_SAVINGS_RATE = new Set<string>(SAVINGS_RATE_ORDER);
const VALID_SAVINGS_MIX = new Set<string>([
  "all_cash", "mostly_cash", "balanced", "mostly_invested", "almost_all_invested",
]);
const VALID_STABILITY = new Set<string>([
  "steady", "variable_flat", "variable_improving", "variable_worsening", "irregular",
]);
const VALID_MORTGAGE = new Set<string>([
  "housing_clear", "housing_ok", "housing_tight", "housing_heavy",
]);
const VALID_FEAR = new Set<string>([
  "income_loss", "market_crash", "making_mistake", "missing_opportunities",
]);

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    userId,
    income,
    savings,
    savingsRate,
    country,
    savingsMix,
    incomeStability,
    mortgagePressure,
    primaryFear,
    expensesOverride,
  } = body;

  if (typeof userId !== "string" || !userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  if (typeof income !== "string" || !VALID_INCOME.has(income)) return NextResponse.json({ error: "Invalid income" }, { status: 400 });
  if (typeof savings !== "string" || !VALID_SAVINGS.has(savings)) return NextResponse.json({ error: "Invalid savings" }, { status: 400 });
  if (typeof savingsRate !== "string" || !VALID_SAVINGS_RATE.has(savingsRate)) return NextResponse.json({ error: "Invalid savingsRate" }, { status: 400 });
  if (typeof country !== "string" || !VALID_COUNTRY_CODES.has(country)) return NextResponse.json({ error: "Invalid country" }, { status: 400 });
  if (typeof savingsMix !== "string" || !VALID_SAVINGS_MIX.has(savingsMix)) return NextResponse.json({ error: "Invalid savingsMix" }, { status: 400 });
  if (typeof incomeStability !== "string" || !VALID_STABILITY.has(incomeStability)) return NextResponse.json({ error: "Invalid incomeStability" }, { status: 400 });
  if (typeof mortgagePressure !== "string" || !VALID_MORTGAGE.has(mortgagePressure)) return NextResponse.json({ error: "Invalid mortgagePressure" }, { status: 400 });
  if (primaryFear !== undefined && (typeof primaryFear !== "string" || !VALID_FEAR.has(primaryFear))) return NextResponse.json({ error: "Invalid primaryFear" }, { status: 400 });
  if (expensesOverride !== undefined && (typeof expensesOverride !== "number" || expensesOverride < 0)) return NextResponse.json({ error: "Invalid expensesOverride" }, { status: 400 });

  try {
    // 1. Load the current profile to snapshot it and check milestone crossing.
    const currentRow = await getUserProfile(userId);
    let prevRunway: number | null = null;
    let prevTarget: number | null = null;

    if (currentRow) {
      const currentOnboarding = profileToOnboardingInput(currentRow);
      const currentFinancial = fromOnboarding(currentOnboarding);
      const currentResult = getFinancialStatus(currentFinancial);
      prevRunway = currentResult.financialMetrics.runway;
      prevTarget = currentResult.financialMetrics.required_cash / currentFinancial.monthly_expenses;
      await saveSnapshot(userId, currentOnboarding, currentResult);
    }

    // 2. Save the new profile (upsert).
    const newOnboarding = {
      income: income as IncomeRange,
      savings: savings as SavingsRange,
      savingsRate: savingsRate as SavingsRateRange,
      country,
      savingsMix: savingsMix as SavingsMix,
      incomeStability: incomeStability as IncomeStability,
      mortgagePressure: mortgagePressure as MortgagePressure,
      primaryFear: primaryFear as import("@/lib/engine").PrimaryFear | undefined,
      expensesOverride: typeof expensesOverride === "number" ? expensesOverride : undefined,
    };

    const saved = await saveUserProfile(newOnboarding, userId);

    // 3. Check milestone crossing: previous runway < target AND new runway >= target.
    if (prevRunway !== null && prevTarget !== null && isEmailConfigured()) {
      const newFinancial = fromOnboarding(newOnboarding);
      const newResult = getFinancialStatus(newFinancial);
      const newRunway = newResult.financialMetrics.runway;
      const newTarget = newResult.financialMetrics.required_cash / newFinancial.monthly_expenses;

      const justCrossedTarget = prevRunway < prevTarget && newRunway >= newTarget;

      if (justCrossedTarget) {
        const email = await getUserEmail(userId);
        if (email) {
          const { currency, locale } = currencyLocaleFromCountryCode(country);
          const statusLabels: Record<string, string> = {
            ok: "Comfortable", warning: "Limited", risk: "Attention", critical: "Urgent",
          };
          try {
            await sendMilestoneEmail({
              to: email,
              userId,
              runwayMonths: Math.round(newRunway * 10) / 10,
              targetMonths: Math.round(newTarget * 10) / 10,
              statusBadge: statusLabels[newResult.status] ?? newResult.status,
              currency,
              locale,
            });
          } catch (emailErr) {
            console.error("Milestone email failed:", emailErr instanceof Error ? emailErr.message : emailErr);
          }
        }
      }
    }

    return NextResponse.json({ userId: saved.userId }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("POST /api/checkin:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
