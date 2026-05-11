"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  userId: string | null;
  slug: string;
  alreadyCompleted: boolean;
  exercise?: string;
  /** Continue link href when there's a next lesson, or fallback dashboard link. */
  nextHref: string;
  /** "Continue" or "Back to your path". */
  nextLabel: string;
}

export default function LessonActions({
  userId,
  slug,
  alreadyCompleted,
  exercise,
  nextHref,
  nextLabel,
}: Props) {
  const router = useRouter();
  const [reflection, setReflection] = useState("");
  const [done, setDone] = useState(alreadyCompleted);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markComplete() {
    if (!userId) {
      setDone(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/lesson-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, slug, reflection: reflection.trim() || undefined }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? "Failed to save");
      }
      setDone(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50/70 px-5 py-5">
        <p className="text-sm font-semibold text-emerald-900">
          {alreadyCompleted ? "You've read this." : "Marked done. Nice."}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-emerald-800/80">
          The next thing in your path is ready when you are.
        </p>
        <Link
          href={nextHref}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          {nextLabel}
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50/60 px-5 py-5">
      {exercise && (
        <>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Reflection
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">{exercise}</p>
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="Optional — your thoughts stay in your account."
            rows={3}
            className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </>
      )}
      <button
        onClick={markComplete}
        disabled={saving}
        className="mt-4 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Saving…" : "Mark as read"}
      </button>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
