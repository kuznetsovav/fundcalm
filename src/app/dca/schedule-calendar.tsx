import type { ScheduledPurchase } from "@/lib/dca-types";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function ScheduleCalendar({
  schedule,
  fmt,
}: {
  schedule: ScheduledPurchase[];
  fmt: (n: number) => string;
}) {
  if (schedule.length === 0) return null;

  const total = schedule.reduce((s, p) => s + p.total_amount, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-slate-700">
          Next 12 months
        </p>
        <p className="text-xs tabular-nums text-slate-500">
          Total: <span className="font-semibold text-slate-700">{fmt(total)}</span>
        </p>
      </div>

      <ol className="grid gap-2 sm:grid-cols-2">
        {schedule.map((p) => {
          const m = MONTH_NAMES[p.date.getMonth()];
          const day = p.date.getDate();
          return (
            <li
              key={`${p.date.getFullYear()}-${p.date.getMonth()}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2.5"
            >
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {m}
                </span>
                <span className="text-xs text-slate-400 tabular-nums">{day}</span>
              </div>
              <div className="flex flex-col items-end gap-0.5 min-w-0">
                <span className="text-sm font-semibold tabular-nums text-slate-800">
                  {fmt(p.total_amount)}
                </span>
                <span className="truncate text-[11px] text-slate-400">
                  {p.slices
                    .map((s) => `${s.ticker} ${fmt(s.amount)}`)
                    .join(" · ")}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
