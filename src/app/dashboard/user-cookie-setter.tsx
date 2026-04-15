"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

const KEY = "fundcalm_uid";

/**
 * Two responsibilities:
 * 1. When ?user=UUID is in the URL — persist it to localStorage + cookie.
 * 2. When ?user= is absent and localStorage has a UUID — hard-redirect to
 *    /dashboard?user=UUID so the server component loads the user's profile.
 *    Uses window.location.replace (full page load) so the server always
 *    sees a fresh request with the correct query param.
 */
export default function UserCookieSetter() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const userFromUrl = searchParams.get("user");

    if (userFromUrl) {
      // Persist for future visits
      try { localStorage.setItem(KEY, userFromUrl); } catch {}
      document.cookie = `${KEY}=${userFromUrl}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    } else {
      // No ?user= — try localStorage then redirect (hard reload)
      try {
        const stored = localStorage.getItem(KEY);
        if (stored) {
          window.location.replace(`/dashboard?user=${stored}`);
        }
      } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
