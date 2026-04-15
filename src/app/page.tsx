import Link from "next/link";
import HomeRedirect from "./home-redirect";

export default function Home() {
  return (
    <main className="flex min-h-[58dvh] flex-col justify-center">
      <HomeRedirect />
      <p className="fc-eyebrow-left text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
        Financial clarity
      </p>
      <h1 className="fc-title-xl mt-3">FundCalm</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-500 sm:text-xl sm:leading-relaxed">
        See where you stand. Calm language, no noise, no jargon.
      </p>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Link href="/onboarding" className="fc-btn-primary px-8">
          Get started
        </Link>
        <Link href="/dashboard" className="fc-link-muted sm:px-2">
          I already have a profile
        </Link>
      </div>
    </main>
  );
}
