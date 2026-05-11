import { NextRequest, NextResponse } from "next/server";
import { markLessonCompleted } from "@/lib/lesson-progress";
import { getLesson } from "@/lib/lessons/catalog";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const b = body as {
    userId?: unknown;
    slug?: unknown;
    reflection?: unknown;
  };

  const userId = typeof b.userId === "string" ? b.userId.trim() : "";
  const slug = typeof b.slug === "string" ? b.slug.trim() : "";
  const reflection =
    typeof b.reflection === "string" ? b.reflection.slice(0, 2000) : undefined;

  if (!UUID_RE.test(userId)) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }
  if (!slug || !getLesson(slug)) {
    return NextResponse.json({ error: "Unknown lesson" }, { status: 400 });
  }

  try {
    await markLessonCompleted(userId, slug, reflection);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to save" },
      { status: 500 },
    );
  }
}
