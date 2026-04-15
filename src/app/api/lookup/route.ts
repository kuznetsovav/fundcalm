import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/profiles";
import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * POST /api/lookup
 * Body: { email: string }
 * Returns: { userId: string, accessToken?: string } or { error: string }
 *
 * Used by the EmptyState "recover my dashboard" form.
 * Always returns a vague error if the email isn't found to avoid enumeration.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email } = body;
  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await getUserByEmail(email);
  if (!user) {
    // Don't reveal whether the email exists or not
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const res = NextResponse.json({ userId: user.id, accessToken: user.access_token ?? null });
  // Set the cookie so the next dashboard visit auto-loads the profile
  res.cookies.set("fundcalm_uid", user.id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });
  return res;
}
