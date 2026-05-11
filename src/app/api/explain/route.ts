import { NextRequest, NextResponse } from "next/server";
import { sanitizeText } from "@/lib/guardrails";
import { createOpenAIClientFromEnv } from "@/lib/openai-server";
import { getLesson } from "@/lib/lessons/catalog";

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

const STATUS_PROMPT = `You are a calm, reassuring financial companion.
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

const LESSON_PROMPT = `You are a calm, thoughtful teacher who has just finished walking the reader through a short lesson on personal finance philosophy.
The reader has a question. Answer it in 2–4 short sentences, using only the principles in the lesson.

Rules:
- Reference the lesson's framing directly when relevant
- No jargon. Plain language a friend would use
- NEVER name specific investments, stocks, crypto, funds, or tickers
- NEVER make predictions ("will go up", "guaranteed", "always", "never fails")
- NEVER use urgency ("act now", "before it's too late")
- Do not recommend specific percentages or dollar amounts
- If the question is outside the lesson's scope, say so plainly and suggest what kind of question would be a better fit
- Keep tone calm — never moralising`;

interface StatusBody {
  mode?: "status";
  status: string;
  action: string;
  context?: string;
}

interface LessonBody {
  mode: "lesson";
  lessonSlug: string;
  question: string;
}

type ExplainBody = StatusBody | LessonBody;

function isLessonBody(body: unknown): body is LessonBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    b.mode === "lesson" &&
    typeof b.lessonSlug === "string" &&
    typeof b.question === "string"
  );
}

function isStatusBody(body: unknown): body is StatusBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return typeof b.status === "string" && typeof b.action === "string";
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
    const raw = await req.json();
    if (isLessonBody(raw)) {
      body = raw;
    } else if (isStatusBody(raw)) {
      body = raw;
    } else {
      return NextResponse.json(
        { error: "Invalid body — expected lesson or status mode" },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let systemPrompt: string;
  let userMessage: string;

  if ("mode" in body && body.mode === "lesson") {
    const lesson = getLesson(body.lessonSlug);
    if (!lesson) {
      return NextResponse.json({ error: "Unknown lesson" }, { status: 400 });
    }
    const trimmedQuestion = body.question.trim().slice(0, 500);
    if (!trimmedQuestion) {
      return NextResponse.json({ error: "Empty question" }, { status: 400 });
    }
    systemPrompt = LESSON_PROMPT;
    userMessage = [
      `Lesson title: ${lesson.title}`,
      `Lesson hook: ${lesson.hook}`,
      "",
      "Lesson body:",
      lesson.paragraphs.join("\n\n"),
      "",
      `Reader's question: ${trimmedQuestion}`,
    ].join("\n");
  } else {
    systemPrompt = STATUS_PROMPT;
    userMessage = [
      `Status: ${body.status}`,
      `Action: ${body.action}`,
      body.context ? `Context: ${body.context}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const openai = createOpenAIClientFromEnv();

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 180,
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
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
