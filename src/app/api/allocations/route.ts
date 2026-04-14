/**
 * GET  /api/allocations?userId=xxx  — fetch all allocations for a user
 * POST /api/allocations             — upsert one month's allocation
 *
 * Body: { userId, year, month, income?, spent?, saved? }
 */

import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  getMonthlyAllocations,
  upsertMonthlyAllocation,
} from "@/lib/allocations";

export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }
  try {
    const allocations = await getMonthlyAllocations(userId);
    return NextResponse.json({ allocations });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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

  const { userId, year, month, income, spent, saved } = body;

  if (typeof userId !== "string" || !userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }
  if (typeof year !== "number" || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  if (typeof month !== "number" || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }

  function toNum(v: unknown): number | null {
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  }

  try {
    await upsertMonthlyAllocation(userId, year, month, {
      income: toNum(income),
      spent: toNum(spent),
      saved: toNum(saved),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("POST /api/allocations:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
