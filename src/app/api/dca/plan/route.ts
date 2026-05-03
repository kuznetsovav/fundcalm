import { NextResponse } from "next/server";
import { upsertDcaPlan } from "@/lib/dca-plans";
import { RISK_BUCKETS } from "@/lib/dca-engine";
import type { RiskBucket } from "@/lib/dca-types";

export const dynamic = "force-dynamic";

interface SaveBody {
  userId?: string;
  monthly_amount?: number;
  risk_bucket?: string;
  allocation?: unknown;
  day_of_month?: number;
}

function isValidAllocation(a: unknown): a is { riskBucket: string; slices: { ticker: string; weight: number }[]; rationale: string } {
  if (a == null || typeof a !== "object") return false;
  const obj = a as Record<string, unknown>;
  if (typeof obj.riskBucket !== "string") return false;
  if (typeof obj.rationale !== "string") return false;
  if (!Array.isArray(obj.slices)) return false;
  return obj.slices.every(
    (s: unknown) =>
      s != null &&
      typeof s === "object" &&
      typeof (s as { ticker: unknown }).ticker === "string" &&
      typeof (s as { weight: unknown }).weight === "number",
  );
}

export async function POST(req: Request) {
  let body: SaveBody;
  try {
    body = (await req.json()) as SaveBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { userId, monthly_amount, risk_bucket, allocation, day_of_month } = body;

  if (typeof userId !== "string" || !userId.trim()) {
    return NextResponse.json({ error: "missing_user" }, { status: 400 });
  }
  if (typeof monthly_amount !== "number" || !Number.isFinite(monthly_amount) || monthly_amount < 0) {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
  }
  if (typeof risk_bucket !== "string" || !(RISK_BUCKETS as readonly string[]).includes(risk_bucket)) {
    return NextResponse.json({ error: "invalid_bucket" }, { status: 400 });
  }
  if (!isValidAllocation(allocation)) {
    return NextResponse.json({ error: "invalid_allocation" }, { status: 400 });
  }

  try {
    const row = await upsertDcaPlan(userId, {
      monthly_amount,
      risk_bucket: risk_bucket as RiskBucket,
      allocation: allocation as Parameters<typeof upsertDcaPlan>[1]["allocation"],
      day_of_month,
    });
    return NextResponse.json({ ok: true, plan: row });
  } catch (e) {
    return NextResponse.json(
      { error: "save_failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
