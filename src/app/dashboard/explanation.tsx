"use client";

import { useEffect, useState } from "react";
import { fetchExplanation } from "@/lib/explain";
import type { FinancialResult } from "@/lib/engine";

export default function Explanation({
  result,
  contextText,
}: {
  result: FinancialResult;
  contextText?: string;
}) {
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const timeout = setTimeout(() => {
      if (!cancelled && text === null) setFailed(true);
    }, 10_000);

    fetchExplanation(result, contextText)
      .then((t) => {
        if (!cancelled) {
          clearTimeout(timeout);
          setText(t);
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearTimeout(timeout);
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, contextText]);

  if (failed) {
    return (
      <div className="fc-surface px-5 py-5">
        <p className="text-xs text-slate-400">
          Reflection unavailable right now — check back later.
        </p>
      </div>
    );
  }

  if (text === null) {
    return (
      <div className="fc-surface space-y-2 px-5 py-5">
        <div className="h-3.5 w-4/5 animate-pulse rounded-md bg-gray-100" />
        <div className="h-3.5 w-3/5 animate-pulse rounded-md bg-gray-100/80" />
      </div>
    );
  }

  return (
    <div className="fc-surface px-5 py-5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
        Reflection
      </p>
      <p className="text-[15px] leading-relaxed text-slate-600 italic">
        &ldquo;{text}&rdquo;
      </p>
    </div>
  );
}
