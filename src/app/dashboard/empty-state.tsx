"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

const KEY = "fundcalm_uid";

/**
 * Shown when the server couldn't resolve a userId.
 * 1. On mount — checks localStorage. If a userId is found, hard-redirects immediately.
 * 2. Otherwise — shows an email recovery form. On success, redirects to the dashboard.
 * 3. If the user has no account — shows the normal "Get started" CTA.
 */
export default function EmptyState() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [checked, setChecked] = useState(false);

  // Step 1: check localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored) {
        window.location.replace(`/dashboard?user=${stored}`);
        return;
      }
    } catch {}
    setChecked(true);
  }, []);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();

      if (res.ok && data.userId) {
        // Persist and redirect
        try { localStorage.setItem(KEY, data.userId); } catch {}
        const url = data.accessToken
          ? `/dashboard?user=${data.userId}&token=${data.accessToken}`
          : `/dashboard?user=${data.userId}`;
        window.location.replace(url);
        return;
      }

      setStatus("error");
      setErrorMsg("No profile found for that email. Try a different address or start fresh.");
    } catch {
      setStatus("error");
      setErrorMsg("Something went wrong. Please try again.");
    }
  }

  // While checking localStorage, show nothing to avoid flash
  if (!checked) return null;

  return (
    <div className="fc-surface mt-10 px-6 py-12 text-center max-w-md mx-auto">
      <p className="text-lg font-semibold text-slate-900">Find your profile</p>
      <p className="mt-2 text-sm text-slate-500">
        Enter your email to get back to your dashboard.
      </p>

      <form onSubmit={handleLookup} className="mt-6 flex flex-col gap-3">
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="fc-btn-primary w-full"
        >
          {status === "loading" ? "Looking up…" : "Go to my dashboard"}
        </button>
      </form>

      {status === "error" && (
        <p className="mt-3 text-sm text-rose-500">{errorMsg}</p>
      )}

      <div className="mt-8 border-t border-slate-100 pt-6">
        <p className="text-xs text-slate-400">No account yet?</p>
        <Link href="/onboarding" className="fc-btn-secondary mt-3 inline-block text-sm">
          Get started — takes 2 minutes
        </Link>
      </div>
    </div>
  );
}
