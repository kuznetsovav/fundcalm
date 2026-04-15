"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const LS_KEY = "fundcalm_uid";

/**
 * Two responsibilities:
 * 1. When ?user=UUID is in the URL — save it to localStorage (and cookie).
 * 2. When ?user= is absent — read localStorage and redirect to ?user=UUID
 *    so the server component can load the user's profile.
 */
export default function UserCookieSetter() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const userFromUrl = searchParams.get("user");

    if (userFromUrl) {
      // Save to localStorage for future visits
      try {
        localStorage.setItem(LS_KEY, userFromUrl);
      } catch {}
      // Also keep the cookie as secondary fallback
      document.cookie = `${LS_KEY}=${userFromUrl}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    } else {
      // No ?user= in URL — check localStorage and redirect if found
      try {
        const stored = localStorage.getItem(LS_KEY);
        if (stored) {
          router.replace(`/dashboard?user=${stored}`);
        }
      } catch {}
    }
  }, [searchParams, router]);

  return null;
}
