"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Refreshes the fundcalm_uid cookie whenever ?user= is present in the URL.
 * Handles existing users who have a bookmarked dashboard link with ?user=UUID
 * but don't yet have the cookie set (e.g. registered before the cookie fix).
 */
export default function UserCookieSetter() {
  const searchParams = useSearchParams();
  useEffect(() => {
    const userId = searchParams.get("user");
    if (userId) {
      document.cookie = `fundcalm_uid=${userId}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    }
  }, [searchParams]);
  return null;
}
