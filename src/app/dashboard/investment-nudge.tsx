"use client";

import { useState } from "react";
import type { InvestmentNudge } from "@/lib/investment-nudge";

export default function InvestmentNudgeSection({
  nudge,
}: {
  nudge: InvestmentNudge;
}) {
  const [explainerOpen, setExplainerOpen] = useState(false);

  if (nudge.mode === null) return null;

  return (
    <section className="fc-surface px-5 py-5">
      {/* Section label */}
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
        {nudge.title}
      </p>

      {/* Opening body */}
      <p className="mt-3 text-[15px] font-medium leading-relaxed text-slate-800">
        {nudge.body}
      </p>

      {/* ── Mode A: invest nudge ── */}
      {nudge.mode === "invest" && (
        <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-4">
          <p className="text-sm font-semibold text-emerald-900">
            A steady start
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-emerald-800">
            Moving about{" "}
            <span className="font-semibold tabular-nums">
              {nudge.suggestedSliceLabel}
            </span>{" "}
            a year into longer-term savings keeps your cushion fully intact
            while putting some of the surplus to work.
          </p>
          {nudge.fearNote && (
            <p className="mt-3 border-t border-emerald-200/60 pt-3 text-sm leading-relaxed text-emerald-700">
              {nudge.fearNote}
            </p>
          )}
        </div>
      )}

      {/* ── Mode B: review prompt ── */}
      {nudge.mode === "review" && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Worth asking yourself
          </p>
          <ul className="mt-3 space-y-2">
            {nudge.reviewQuestions.map((q) => (
              <li
                key={q}
                className="flex gap-2 text-sm leading-relaxed text-slate-600"
              >
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                {q}
              </li>
            ))}
          </ul>
          {nudge.fearNote && (
            <p className="mt-3 border-t border-slate-200/60 pt-3 text-sm leading-relaxed text-slate-600">
              {nudge.fearNote}
            </p>
          )}
        </div>
      )}

      {/* ── Mode A only: "What does investing mean here?" collapsible ── */}
      {nudge.mode === "invest" && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-4 text-left"
            onClick={() => setExplainerOpen((v) => !v)}
            aria-expanded={explainerOpen}
          >
            <span className="text-sm font-medium text-slate-600">
              What does &ldquo;investing&rdquo; mean here?
            </span>
            <span
              className="shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-slate-500"
              aria-hidden
            >
              {explainerOpen ? "Hide" : "Show"}
            </span>
          </button>

          {explainerOpen && (
            <div className="mt-3 space-y-2.5 text-sm leading-relaxed text-slate-600">
              <p>
                Moving money into longer-term savings means putting it somewhere
                you don&rsquo;t plan to touch for at least a few years — index
                funds, ETFs, or pension contributions, depending on what&rsquo;s
                available in your country.
              </p>
              <p>
                It&rsquo;s not about picking individual stocks or chasing
                returns. The core idea is that money you won&rsquo;t need soon
                can grow more than it would sitting in a bank account, while
                staying spread across many assets so no single drop wipes it
                out.
              </p>
              <p>
                There&rsquo;s no rush. Moving a fixed amount each year —
                sometimes called &ldquo;pound-cost averaging&rdquo; or
                &ldquo;dollar-cost averaging&rdquo; — avoids trying to time the
                market, which rarely works in practice.
              </p>
              <p className="text-xs text-slate-400">
                No specific product is right for everyone, and this page
                doesn&rsquo;t recommend any. It&rsquo;s worth a few hours of
                research into what&rsquo;s available in your country before
                moving anything.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
