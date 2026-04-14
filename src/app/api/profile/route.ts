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
import { isEmailConfigured, sendWelcomeEmail } from "@/lib/email";
import { getFinancialStatus, fromOnboarding } from "@/lib/engine";
import { currencyLocaleFromCountryCode } from "@/lib/money-tiers";

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

const VALID_FEAR = new Set<string>([
  "income_loss",
  "market_crash",
  "making_mistake",
  "missing_opportunities",
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
    primaryFear,
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
  if (primaryFear !== undefined && (typeof primaryFear !== "string" || !VALID_FEAR.has(primaryFear)))
    return "Invalid primaryFear";
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
    primaryFear: primaryFear as string | undefined,
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
    const saved = await saveUserProfile(parsed);

    // Send welcome email in the background if email was provided.
    if (parsed.email && isEmailConfigured()) {
      try {
        const onboarding = {
          income: parsed.income,
          savings: parsed.savings,
          savingsRate: parsed.savingsRate,
          country: parsed.country,
          savingsMix: parsed.savingsMix,
          incomeStability: parsed.incomeStability,
          mortgagePressure: parsed.mortgagePressure,
          primaryFear: parsed.primaryFear as import("@/lib/engine").PrimaryFear | undefined,
        };
        const financial = fromOnboarding(onboarding);
        const result = getFinancialStatus(financial);
        const { locale, currency } = currencyLocaleFromCountryCode(parsed.country);
        const fmt = (n: number) =>
          new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(Math.round(Math.abs(n)));
        const statusLabels: Record<string, string> = {
          ok: "Comfortable",
          warning: "Limited",
          risk: "Attention",
          critical: "Urgent",
        };
        await sendWelcomeEmail({
          to: parsed.email,
          userId: saved.userId,
          statusBadge: statusLabels[result.status] ?? result.status,
          runway: `${Math.round(result.financialMetrics.runway * 10) / 10} months`,
          accessToken: saved.accessToken,
        });
      } catch (emailErr) {
        // Never let email failure block the response
        console.error("Welcome email failed:", emailErr instanceof Error ? emailErr.message : emailErr);
      }
    }

    // Set a long-lived cookie so the dashboard can identify the user
    // without requiring ?user= in the URL on every visit.
    const res = NextResponse.json(saved, { status: 201 });
    res.cookies.set("fundcalm_uid", saved.userId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: "lax",
      httpOnly: false, // readable client-side if needed
    });
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("POST /api/profile:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
