import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — FundCalm",
  description:
    "Your first diagnosis is free, always. Keep your clarity for €7/mo or €59/yr.",
};

const MONTHLY_PRICE = 7;
const ANNUAL_PRICE = 59;
const ANNUAL_EFFECTIVE_MONTHLY = Math.round((ANNUAL_PRICE / 12) * 100) / 100;
const ANNUAL_SAVINGS_PCT = Math.round(
  (1 - ANNUAL_PRICE / (MONTHLY_PRICE * 12)) * 100,
);

const INCLUDED = [
  "Monthly check-ins that keep your numbers current",
  "Runway history — see how your buffer moved over time",
  "Monthly log for income, spending, and savings",
  "Calm monthly digest email — one tap to update",
  "Personalised, fear-aware guidance that adapts as you change",
];

const FREE_FEATURES = [
  "Full diagnosis across all 7 financial states",
  "Your cash runway, target buffer, and gap",
  "One-time, fear-aware action card",
];

export default function PricingPage() {
  return (
    <main className="pb-16 pt-2">
      {/* Header */}
      <header className="text-center">
        <p className="fc-eyebrow">Pricing</p>
        <h1 className="fc-title-xl mt-3">
          Stay clear. For less than a coffee a month.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-500 sm:text-lg">
          Your first diagnosis is free, always. Keep it up to date for the price of a tram ride.
        </p>
      </header>

      {/* Plan cards */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2 sm:gap-5">
        {/* Monthly */}
        <div className="fc-surface flex flex-col px-6 py-7">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Monthly
          </p>
          <p className="mt-3 flex items-baseline gap-1">
            <span className="text-4xl font-semibold tracking-tight text-slate-900">
              €{MONTHLY_PRICE}
            </span>
            <span className="text-sm text-slate-500">/month</span>
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Flexible. Cancel any time.
          </p>
          <div className="mt-6">
            <Link
              href="/onboarding"
              className="fc-btn-secondary w-full justify-center"
            >
              Choose monthly
            </Link>
          </div>
        </div>

        {/* Annual — highlighted */}
        <div className="fc-recommended-card relative flex flex-col px-6 py-7">
          <span className="absolute right-5 top-5 inline-flex items-center rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">
            Save {ANNUAL_SAVINGS_PCT}%
          </span>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
            Annual
          </p>
          <p className="mt-3 flex items-baseline gap-1">
            <span className="text-4xl font-semibold tracking-tight text-slate-900">
              €{ANNUAL_PRICE}
            </span>
            <span className="text-sm text-slate-500">/year</span>
          </p>
          <p className="mt-2 text-sm text-emerald-800">
            €{ANNUAL_EFFECTIVE_MONTHLY.toFixed(2)}/mo, billed yearly.
          </p>
          <div className="mt-6">
            <Link
              href="/onboarding"
              className="fc-btn-primary-block"
            >
              Choose annual
            </Link>
          </div>
        </div>
      </div>

      {/* What's included */}
      <section className="fc-surface mt-8 px-6 py-7 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          Both plans include
        </p>
        <ul className="mt-4 space-y-3">
          {INCLUDED.map((line) => (
            <li
              key={line}
              className="flex items-start gap-3 text-sm leading-relaxed text-slate-700"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-semibold text-emerald-700">
                ✓
              </span>
              {line}
            </li>
          ))}
        </ul>
      </section>

      {/* Free tier */}
      <section className="fc-surface-quiet mt-4 px-6 py-7 sm:px-8">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Free forever
          </p>
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
            No card required
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Your first diagnosis is always free. Take as long as you need — no trial timer, no nudges.
        </p>
        <ul className="mt-4 space-y-2.5">
          {FREE_FEATURES.map((line) => (
            <li
              key={line}
              className="flex items-start gap-3 text-sm leading-relaxed text-slate-600"
            >
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
              {line}
            </li>
          ))}
        </ul>
        <div className="mt-6">
          <Link href="/onboarding" className="fc-btn-primary">
            Start with your free diagnosis
          </Link>
        </div>
      </section>

      {/* FAQ / fine print */}
      <section className="mt-10 space-y-5">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            Can I cancel any time?
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
            Yes. Monthly plans stop at the end of the current month. Annual plans stay active until the renewal date.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">
            Do you give financial advice?
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
            No. FundCalm is a clarity tool — it tells you where you stand in plain language, never what to buy or sell.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">
            What happens to my data if I stop paying?
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
            Your profile stays. You keep access to your latest free diagnosis — you just won't receive new check-ins or digest emails.
          </p>
        </div>
      </section>

      <p className="mt-10 text-center text-xs text-slate-400">
        Prices in EUR. VAT included where applicable.
      </p>
    </main>
  );
}
