// ---------------------------------------------------------------------------
// Text-level guardrails for AI-generated content (explain route, etc.)
// The result-level guardrails live inside engine.ts.
// ---------------------------------------------------------------------------

const SAFE_FALLBACK =
  "Given your situation, it\u2019s better to avoid major decisions right now.";

const FORBIDDEN: RegExp[] = [
  /\bbitcoin\b/i,
  /\bethereum\b/i,
  /\bcrypto(?:currency)?\b/i,
  /\bnft\b/i,
  /\$[A-Z]{1,5}\b/,
  /\b(?:TSLA|AAPL|AMZN|NVDA|GOOG|GOOGL|META)\b/,
  /\bguaranteed?\b/i,
  /\bwill\s+(?:definitely|certainly|absolutely|surely)\b/i,
  /\balways\s+goes?\s+up\b/i,
  /\bnever\s+(?:loses?|drops?|fails?)\b/i,
  /\brisk[- ]?free\b/i,
  /\b(?:act|buy|sell|invest)\s+(?:now|immediately|today|asap)\b/i,
  /\byou\s+must\s+(?:buy|sell|invest|act)\b/i,
  /\burgent(?:ly)?\b/i,
  /\bFOMO\b/i,
  /\bput\s+\d+%/i,
  /\ballocate\s+\d+%/i,
  /\binvest\s+\$[\d,]+/i,
];

export function sanitizeText(text: string): string {
  const unsafe = FORBIDDEN.some((p) => p.test(text));
  return unsafe ? SAFE_FALLBACK : text;
}
