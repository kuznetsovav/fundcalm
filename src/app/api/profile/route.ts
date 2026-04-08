import { NextRequest, NextResponse } from "next/server";
import { saveUserProfile, type ProfileInput } from "@/lib/profiles";
import { isSupabaseConfigured } from "@/lib/supabase";
import { VALID_COUNTRY_CODES } from "@/lib/countries";
import {
  INCOME_TIER_ORDER,
  SAVINGS_RATE_ORDER,
  SAVINGS_TIER_ORDER,
} from "@/lib/tier-reference";
import type {
  IncomeRange,
  SavingsRange,
  SavingsRateRange,
  SavingsMix,
  IncomeStability,
  MortgagePressure,
} from "@/lib/engine";

const VALID_INCOME = new Set<string>(INCOME_TIER_ORDER);
const VALID_SAVINGS = new Set<string>(SAVINGS_TIER_ORDER);
const VALID_SAVINGS_RATE = new Set<string>(SAVINGS_RATE_ORDER);
const VALID_SAVINGS_MIX = new Set<string>([
  "all_cash",
  "mostly_cash",
  "balanced",
  "mostly_invested",
  "almost_all_invested",
]);
const VALID_STABILITY = new Set<string>([
  "steady",
  "variable_flat",
  "variable_improving",
  "variable_worsening",
  "irregular",
]);
const VALID_MORTGAGE = new Set<string>([
  "housing_clear",
  "housing_ok",
  "housing_tight",
  "housing_heavy",
]);

function validate(body: Record<string, unknown>): ProfileInput | string {
  const {
    income,
    savings,
    savingsRate,
    country,
    savingsMix,
    incomeStability,
    mortgagePressure,
    email,
  } = body;

  if (typeof income !== "string" || !VALID_INCOME.has(income))
    return "Invalid income";
  if (typeof savings !== "string" || !VALID_SAVINGS.has(savings))
    return "Invalid savings";
  if (typeof savingsRate !== "string" || !VALID_SAVINGS_RATE.has(savingsRate))
    return "Invalid savingsRate";
  if (typeof country !== "string" || !VALID_COUNTRY_CODES.has(country))
    return "Invalid country";
  if (typeof savingsMix !== "string" || !VALID_SAVINGS_MIX.has(savingsMix))
    return "Invalid savingsMix";
  if (
    typeof incomeStability !== "string" ||
    !VALID_STABILITY.has(incomeStability)
  )
    return "Invalid incomeStability";
  if (
    typeof mortgagePressure !== "string" ||
    !VALID_MORTGAGE.has(mortgagePressure)
  )
    return "Invalid mortgagePressure";
  if (email !== undefined && typeof email !== "string")
    return "email must be a string";

  return {
    income: income as IncomeRange,
    savings: savings as SavingsRange,
    savingsRate: savingsRate as SavingsRateRange,
    country,
    savingsMix: savingsMix as SavingsMix,
    incomeStability: incomeStability as IncomeStability,
    mortgagePressure: mortgagePressure as MortgagePressure,
    email: email as string | undefined,
  };
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = validate(body);
  if (typeof parsed === "string") {
    return NextResponse.json({ error: parsed }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        skipped: true,
        message:
          "Supabase is not configured; profile was not saved to the cloud.",
      },
      { status: 201 },
    );
  }

  try {
    const result = await saveUserProfile(parsed);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("POST /api/profile:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
