"use client";

import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="pb-10 pt-2">
      <div className="fc-surface mt-10 px-6 py-12 text-center">
        <p className="text-lg font-semibold text-slate-900">
          Something went wrong
        </p>
        <p className="mt-2 text-sm text-slate-500">
          We couldn&apos;t load your dashboard. Your data is safe.
        </p>
        {error.digest && (
          <p className="mt-1 text-xs text-slate-400">Error ID: {error.digest}</p>
        )}
        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="fc-btn-primary"
          >
            Try again
          </button>
          <Link href="/onboarding" className="fc-link-muted text-sm">
            Start over
          </Link>
        </div>
      </div>
    </main>
  );
}
