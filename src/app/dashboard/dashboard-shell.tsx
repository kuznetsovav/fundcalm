"use client";

import { Suspense, useState } from "react";
import UserCookieSetter from "./user-cookie-setter";

/**
 * Wraps the empty-state case: shows a loading screen while UserCookieSetter
 * is redirecting. If there is no stored userId at all, renders the fallback
 * (the normal EmptyState).
 */
export default function DashboardShell({
  hasProfile,
  children,
  fallback,
}: {
  hasProfile: boolean;
  children: React.ReactNode;
  fallback: React.ReactNode;
}) {
  const [redirecting, setRedirecting] = useState(false);

  if (hasProfile) return <>{children}</>;

  if (redirecting) {
    return (
      <div className="flex min-h-[40dvh] items-center justify-center">
        <p className="text-slate-400 text-sm">Loading your profile…</p>
      </div>
    );
  }

  return (
    <>
      <Suspense fallback={null}>
        <UserCookieSetter onRedirecting={() => setRedirecting(true)} />
      </Suspense>
      {fallback}
    </>
  );
}
