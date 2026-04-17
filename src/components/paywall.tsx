"use client";

import { useState } from "react";
import { isFeatureEnabled } from "@/lib/feature-flags";

const BENEFITS = [
  "Real-time market updates",
  "Personalized recommendations",
  "Peace of mind",
];

export default function Paywall({ children }: { children: React.ReactNode }) {
  // Feature flag: when disabled (default), render children directly with no gate.
  // Flip NEXT_PUBLIC_FEATURE_PAYWALL=1 in the environment to enable.
  const enabled = isFeatureEnabled("paywall");

  const [unlocked, setUnlocked] = useState(false);

  if (!enabled) return <>{children}</>;
  if (unlocked) return <>{children}</>;

  return (
    <div className="fc-surface px-6 py-9 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
        Premium
      </p>
      <p className="mt-2 text-base font-semibold tracking-tight text-slate-900">
        Ongoing updates &amp; guidance
      </p>

      <ul className="mt-5 space-y-2.5 text-left sm:mx-auto sm:max-w-sm md:max-w-md">
        {BENEFITS.map((b) => (
          <li
            key={b}
            className="flex items-center gap-3 text-sm text-slate-600"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-medium text-emerald-700">
              ✓
            </span>
            {b}
          </li>
        ))}
      </ul>

      <p className="mt-6">
        <span className="text-3xl font-semibold tracking-tight text-slate-900">
          €7
        </span>
        <span className="text-sm text-slate-500">/mo</span>
      </p>

      <button
        type="button"
        onClick={() => setUnlocked(true)}
        className="fc-btn-primary-block mt-5"
      >
        Upgrade
      </button>

      <p className="mt-3 text-xs text-slate-400">Cancel anytime.</p>
    </div>
  );
}
