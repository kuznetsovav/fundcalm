import { NextRequest, NextResponse } from "next/server";
import { getUserProfile, profileToOnboardingInput } from "@/lib/profiles";
import { isSupabaseConfigured } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const { userId } = await params;

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  try {
    const row = await getUserProfile(userId);
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const onboarding = profileToOnboardingInput(row);

    return NextResponse.json({
      userId,
      income: onboarding.income,
      savings: onboarding.savings,
      savingsRate: onboarding.savingsRate,
      country: onboarding.country,
      savingsMix: onboarding.savingsMix,
      incomeStability: onboarding.incomeStability,
      mortgagePressure: onboarding.mortgagePressure,
      primaryFear: onboarding.primaryFear ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("GET /api/profile/[userId]:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
