/**
 * POST /api/checkin
 *
 * Takes a snapshot of the user's current profile (before the update),
 * then upserts the new profile data.
 *
 * Body: { userId, income, savings, savingsRate, country, savingsMix,
 *          incomeStability, mortgagePressure, primaryFear? }
 * Returns: { userId, snapshotId? }
 */

import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { saveUserProfile, getUserProfile, profileToOnboardingInput } from "@/lib/profiles";
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

  try {
    // 1. Load the current profile to snapshot it before overwriting.
    const currentRow = await getUserProfile(userId);
    if (currentRow) {
      const currentOnboarding = profileToOnboardingInput(currentRow);
      const currentFinancial = fromOnboarding(currentOnboarding);
      const currentResult = getFinancialStatus(currentFinancial);
      await saveSnapshot(userId, currentOnboarding, currentResult);
    }

    // 2. Save the new profile (upsert).
    const saved = await saveUserProfile(
      {
        income: income as IncomeRange,
        savings: savings as SavingsRange,
        savingsRate: savingsRate as SavingsRateRange,
        country,
        savingsMix: savingsMix as SavingsMix,
        incomeStability: incomeStability as IncomeStability,
        mortgagePressure: mortgagePressure as MortgagePressure,
        primaryFear: primaryFear as string | undefined,
      },
      userId,
    );

    return NextResponse.json({ userId: saved.userId }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("POST /api/checkin:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
