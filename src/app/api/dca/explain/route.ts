import { NextRequest, NextResponse } from "next/server";
import { createOpenAIClientFromEnv } from "@/lib/openai-server";
import { etfByTicker } from "@/lib/dca-etf-catalog";
import { RISK_BUCKETS } from "@/lib/dca-engine";

export const dynamic = "force-dynamic";

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

const SYSTEM_PROMPT = `You are a calm financial companion helping someone think through a DCA (dollar-cost averaging) investment plan.

You may discuss specific ETF tickers and weights when the user has chosen them — name them, explain what they cover, and why this allocation fits their stated risk profile and primary worry.

Style:
- Warm, plain language. No jargon stacks ("portfolio rebalancing alpha-tilted") — explain in normal sentences.
- Reference the user's primary fear directly when it shapes the rationale.
- Do NOT make predictions ("will go up", "guaranteed"). Frame in terms of historical patterns, structure, or risk trade-offs.
- Do NOT use urgency.
- 3-5 short paragraphs, ~150 words total.
- No bullet points unless naturally required.`;

interface ExplainBody {
  risk_bucket?: string;
  monthly_amount?: number;
  currency?: string;
  primary_fear?: string;
  diagnosis?: string;
  slices?: { ticker: string; weight: number }[];
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429 },
    );
  }

  let body: ExplainBody;
  try {
    body = (await req.json()) as ExplainBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body.risk_bucket !== "string" ||
    !(RISK_BUCKETS as readonly string[]).includes(body.risk_bucket) ||
    !Array.isArray(body.slices) ||
    body.slices.length === 0
  ) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  const sliceLines = body.slices
    .map((s) => {
      const meta = etfByTicker(s.ticker);
      const pct = Math.round(s.weight * 100);
      return meta
        ? `- ${meta.ticker} (${meta.name}, ${meta.region} ${meta.asset_class}): ${pct}%`
        : `- ${s.ticker}: ${pct}%`;
    })
    .join("\n");

  const userMessage = [
    `Risk profile: ${body.risk_bucket}`,
    body.monthly_amount != null && body.currency
      ? `Monthly contribution: ${body.monthly_amount} ${body.currency}`
      : "",
    body.primary_fear ? `Primary worry: ${body.primary_fear.replace(/_/g, " ")}` : "",
    body.diagnosis ? `Current financial state: ${body.diagnosis.replace(/_/g, " ")}` : "",
    "Allocation:",
    sliceLines,
    "",
    "Explain why this plan fits this user. Reference their primary worry. Briefly characterise each ticker's role.",
  ]
    .filter(Boolean)
    .join("\n");

  const openai = createOpenAIClientFromEnv();

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 350,
      temperature: 0.5,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    });

    const explanation = completion.choices[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({ explanation });
  } catch (err: unknown) {
    const status =
      err && typeof err === "object" && "status" in err
        ? (err as { status?: number }).status
        : undefined;
    console.error("DCA explain OpenAI error:", status, err);
    return NextResponse.json(
      { error: "Failed to generate explanation" },
      { status: 502 },
    );
  }
}
