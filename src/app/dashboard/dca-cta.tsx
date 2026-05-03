import Link from "next/link";

export default function DcaCta({
  userId,
  token,
}: {
  userId: string;
  token?: string;
}) {
  const href = token
    ? `/dca?user=${userId}&token=${token}`
    : `/dca?user=${userId}`;

  return (
    <section className="fc-surface flex items-center justify-between gap-4 px-5 py-5">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Investment plan
        </p>
        <p className="mt-2 text-sm font-semibold text-slate-900">
          See a DCA plan tailored to your numbers
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Allocation, monthly amount, and a 12-month schedule for Revolut Trading.
        </p>
      </div>
      <Link href={href} className="fc-btn-secondary shrink-0 text-sm">
        Open plan →
      </Link>
    </section>
  );
}
