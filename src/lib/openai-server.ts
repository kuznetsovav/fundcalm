import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";

/**
 * Reads OPENAI_API_KEY from project env files. Next.js does not override variables
 * already set in the shell, so a stale shell OPENAI_API_KEY can win over `.env.local`.
 * File-based values match what you edit in the repo and fix that mismatch.
 */
function parseOpenAIKeyFromFile(filePath: string): string | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  let last: string | undefined;
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^(?:export\s+)?OPENAI_API_KEY\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[1].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1).trim();
    }
    if (v) last = v;
  }
  return last;
}

function resolveOpenAIApiKey(): string | undefined {
  const root = process.cwd();
  const fromLocal = parseOpenAIKeyFromFile(path.join(root, ".env.local"));
  const fromEnv = parseOpenAIKeyFromFile(path.join(root, ".env"));
  const fromProcess = process.env.OPENAI_API_KEY?.trim();
  // Same precedence as Next: .env.local wins over .env; files win over shell (see module doc).
  return fromLocal ?? fromEnv ?? fromProcess;
}

/**
 * Server-only OpenAI client. Uses OPENAI_API_KEY (never NEXT_PUBLIC_*).
 * Restart `next dev` after editing `.env.local` if you rely on process.env caching elsewhere.
 */
export function createOpenAIClientFromEnv(): OpenAI {
  const apiKey = resolveOpenAIApiKey()?.trim();
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  return new OpenAI({ apiKey });
}
