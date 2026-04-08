import { NextRequest, NextResponse } from "next/server";
import { sanitizeText } from "@/lib/guardrails";
import { createOpenAIClientFromEnv } from "@/lib/openai-server";

// Simple in-memory rate limiter: max 5 requests per IP per minute.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  return false;
}

const SYSTEM_PROMPT = `You are a calm, reassuring financial companion.
Given a user's financial status and a recommended action, write a 1–2 sentence explanation.

Rules:
- Be warm and clear, like talking to a friend
- No financial jargon (no "portfolio allocation", "liquidity", "asset class", etc.)
- NEVER name specific investments, stocks, crypto, funds, or tickers
- NEVER make predictions ("will go up", "guaranteed", "always", "never fails")
- NEVER use urgency ("act now", "before it's too late", "you must")
- Do not recommend specific percentages or dollar amounts
- "Do nothing" is always a valid recommendation — never pressure the user
- Keep tone calm and neutral, even when the situation is concerning
- Keep it under 40 words
- Do not use bullet points or lists — just plain sentences`;

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429 },
    );
  }

  let body: { status: string; action: string; context?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!body.status || !body.action) {
    return NextResponse.json(
      { error: "Missing required fields: status, action" },
      { status: 400 },
    );
  }

  const userMessage = [
    `Status: ${body.status}`,
    `Action: ${body.action}`,
    body.context ? `Context: ${body.context}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const openai = createOpenAIClientFromEnv();

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 80,
      temperature: 0.4,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const explanation = sanitizeText(raw);

    return NextResponse.json({ explanation });
  } catch (err: unknown) {
    const status =
      err && typeof err === "object" && "status" in err
        ? (err as { status?: number }).status
        : undefined;
    console.error("OpenAI API error:", status, err);
    return NextResponse.json(
      { error: "Failed to generate explanation" },
      { status: 502 },
    );
  }
}
