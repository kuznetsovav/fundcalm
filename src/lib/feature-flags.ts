/**
 * Feature flags — read from environment at build/startup time.
 *
 * Flags prefixed with `NEXT_PUBLIC_FEATURE_` are inlined by Next.js and
 * safe to read from client and server components alike.
 *
 * Default posture: OFF. A flag must be explicitly enabled via env var.
 * Truthy values: "1", "true", "yes", "on" (case-insensitive).
 * Anything else (including unset) is treated as disabled.
 */

export type FeatureFlag = "paywall";

const ENV_VAR: Record<FeatureFlag, string | undefined> = {
  // NOTE: must reference `process.env.NEXT_PUBLIC_*` by its literal name so
  // Next.js can inline the value at build time for client bundles.
  paywall: process.env.NEXT_PUBLIC_FEATURE_PAYWALL,
};

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return isTruthy(ENV_VAR[flag]);
}
