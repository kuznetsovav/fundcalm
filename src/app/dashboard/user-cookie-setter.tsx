"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const KEY = "fundcalm_uid";

export function useStoredUserId(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function saveUserId(uid: string) {
  try { localStorage.setItem(KEY, uid); } catch {}
  document.cookie = `${KEY}=${uid}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

/**
 * When ?user=UUID is present → persist it.
 * When absent and localStorage has a UUID → hard-redirect (full page reload
 * so the server component receives ?user= and loads the profile).
 * Returns whether a redirect is pending (so the caller can show a loading state).
 */
export default function UserCookieSetter({
  onRedirecting,
}: {
  onRedirecting?: () => void;
}) {
  const searchParams = useSearchParams();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const userFromUrl = searchParams.get("user");

    if (userFromUrl) {
      saveUserId(userFromUrl);
    } else {
      try {
        const stored = localStorage.getItem(KEY);
        if (stored) {
          setRedirecting(true);
          onRedirecting?.();
          window.location.replace(`/dashboard?user=${stored}`);
        }
      } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (redirecting) {
    return (
      <div className="flex min-h-[40dvh] items-center justify-center">
        <p className="text-slate-400 text-sm">Loading your profile…</p>
      </div>
    );
  }

  return null;
}
