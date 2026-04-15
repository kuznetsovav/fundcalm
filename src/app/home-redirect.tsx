"use client";

import { useEffect } from "react";

const KEY = "fundcalm_uid";

/**
 * If the user has a stored userId, redirect them straight to their dashboard
 * instead of showing the landing page. Fires once on mount.
 */
export default function HomeRedirect() {
  useEffect(() => {
    try {
      const uid = localStorage.getItem(KEY);
      if (uid) {
        window.location.replace(`/dashboard?user=${uid}`);
      }
    } catch {}
  }, []);

  return null;
}
