/**
 * POST /api/digest
 *
 * Monthly digest sender. Called by a cron job (Vercel Cron or external scheduler).
 * Protected by a shared secret in the Authorization header.
 *
 * Sends a calm monthly check-in email to every user who has an email address,
 * including a delta vs their last snapshot.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { getUserProfile, profileToOnboardingInput } from "@/lib/profiles";
import { getLatestSnapshot } from "@/lib/snapshots";
import { isEmailConfigured, sendDigestEmail } from "@/lib/email";
import {
  getFinancialStatus,
  fromOnboarding,
} from "@/lib/engine";
import { currencyLocaleFromCountryCode } from "@/lib/money-tiers";

const STATUS_LABELS: Record<string, string> = {
  ok: "Comfortable",
  warning: "Limited",
  risk: "Attention",
  critical: "Urgent",
};

function fmt(n: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Math.round(Math.abs(n)));
}

export async function POST(req: NextRequest) {
  // Verify the cron secret so only the scheduler can trigger this.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  if (!isEmailConfigured()) {
    return NextResponse.json({ error: "Email not configured" }, { status: 503 });
  }

  const sb = await getSupabase();

  // Fetch all users who have an email address.
  const { data: users, error } = await sb
    .from("users")
    .select("id, email")
    .not("email", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const user of (users ?? [])) {
    if (!user.email) continue;

    try {
      const [profileRow, snapshot] = await Promise.all([
        getUserProfile(user.id),
        getLatestSnapshot(user.id),
      ]);

      if (!profileRow) continue;

      const onboarding = profileToOnboardingInput(profileRow);
      const financial = fromOnboarding(onboarding);
      const result = getFinancialStatus(financial);
      const { currency, locale } = currencyLocaleFromCountryCode(onboarding.country);

      const m = result.financialMetrics;
      const runwayStr = `${Math.round(m.runway * 10) / 10} months`;
      const targetMonths = financial.monthly_expenses > 0
        ? Math.round(m.required_cash / financial.monthly_expenses)
        : 6;
      const targetStr = `${targetMonths} months`;
      const gapStr = m.gap > 0 ? fmt(m.gap, currency, locale) + " to go" : "On target";

      await sendDigestEmail({
        to: user.email,
        userId: user.id,
        statusBadge: STATUS_LABELS[result.status] ?? result.status,
        runway: runwayStr,
        target: targetStr,
        gap: gapStr,
        previous: snapshot
          ? {
              runwayMonths: Number(snapshot.runway_months ?? 0),
              status: snapshot.status ?? "",
              takenAt: snapshot.taken_at,
            }
          : null,
        countryLabel: onboarding.country,
      });

      sent++;
    } catch (e) {
      failed++;
      errors.push(`${user.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({ sent, failed, errors }, { status: 200 });
}
