import { getSupabase } from "./supabase";
import type { DcaAllocation, RiskBucket } from "./dca-types";

export interface DcaPlanRow {
  id: string;
  user_id: string;
  monthly_amount: number;
  risk_bucket: RiskBucket;
  allocation: DcaAllocation;
  day_of_month: number;
  created_at: string;
  updated_at: string;
}

export interface DcaPlanInput {
  monthly_amount: number;
  risk_bucket: RiskBucket;
  allocation: DcaAllocation;
  day_of_month?: number;
}

export async function getDcaPlan(userId: string): Promise<DcaPlanRow | null> {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from("dca_plans")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch DCA plan: ${error.message}`);
  return (data as DcaPlanRow | null) ?? null;
}

export async function upsertDcaPlan(
  userId: string,
  input: DcaPlanInput,
): Promise<DcaPlanRow> {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from("dca_plans")
    .upsert(
      {
        user_id: userId,
        monthly_amount: input.monthly_amount,
        risk_bucket: input.risk_bucket,
        allocation: input.allocation,
        day_of_month: input.day_of_month ?? 15,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();
  if (error) throw new Error(`Failed to save DCA plan: ${error.message}`);
  return data as DcaPlanRow;
}
