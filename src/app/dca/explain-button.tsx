"use client";

import { useState } from "react";
import type { DcaPlan } from "@/lib/dca-types";
import type { Diagnosis, PrimaryFear } from "@/lib/diagnosis-engine";

type Status = "idle" | "loading" | "ready" | "error";

export default function ExplainButton({
  plan,
  currency,
  primary_fear,
  diagnosis,
}: {
  plan: DcaPlan;
  currency: string;
  primary_fear: PrimaryFear;
  diagnosis: Diagnosis;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [text, setText] = useState<string>("");
  const [error, setError] = useState<string>("");

  async function explain() {
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/dca/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          risk_bucket: plan.allocation.riskBucket,
          monthly_amount: plan.amount.monthly_amount,
          currency,
          primary_fear,
          diagnosis,
          slices: plan.allocation.slices,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { explanation: string };
      setText(data.explanation);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          AI explanation
        </p>
        <button
          type="button"
          onClick={explain}
          disabled={status === "loading"}
          className="fc-btn-secondary text-sm"
        >
          {status === "loading"
            ? "Thinking…"
            : status === "ready"
              ? "Regenerate"
              : status === "error"
                ? "Retry"
                : "Explain this plan"}
        </button>
      </div>

      {status === "loading" && (
        <div className="space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-11/12 animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-9/12 animate-pulse rounded bg-slate-100" />
        </div>
      )}

      {status === "ready" && text && (
        <div className="space-y-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {text}
        </div>
      )}

      {status === "error" && (
        <p className="text-sm text-rose-600">
          Couldn&rsquo;t generate explanation: {error}
        </p>
      )}
    </div>
  );
}
