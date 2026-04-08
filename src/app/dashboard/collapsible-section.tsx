"use client";

import { useId, useState, type ReactNode } from "react";

export default function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section className="fc-surface overflow-hidden px-5 py-4">
      <button
        type="button"
        id={`${panelId}-btn`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {subtitle}
            </p>
          ) : null}
        </div>
        <span
          className="mt-0.5 shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-slate-600 tabular-nums"
          aria-hidden
        >
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open ? (
        <div id={panelId} className="mt-5 border-t border-gray-100 pt-5">
          {children}
        </div>
      ) : null}
    </section>
  );
}
