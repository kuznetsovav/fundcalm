import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getLesson, LESSON_CATALOG } from "@/lib/lessons/catalog";
import { PILLAR_LABEL, PILLAR_TAGLINE } from "@/lib/lessons/types";
import { getCompletedSlugs } from "@/lib/lesson-progress";
import { getUserProfile, profileToOnboardingInput } from "@/lib/profiles";
import {
  buildCurriculumPath,
  nextLesson,
} from "@/lib/curriculum";
import { fromOnboarding, getFinancialStatus } from "@/lib/engine";
import LessonActions from "./lesson-actions";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return LESSON_CATALOG.map((l) => ({ slug: l.slug }));
}

function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: T): Promise<T> {
  return new Promise((resolve) => {
    const id = setTimeout(() => resolve(onTimeout), ms);
    promise
      .then((v) => {
        clearTimeout(id);
        resolve(v);
      })
      .catch(() => {
        clearTimeout(id);
        resolve(onTimeout);
      });
  });
}

export default async function LessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const lesson = getLesson(slug);
  if (!lesson) notFound();

  const cookieStore = await cookies();
  const userId =
    typeof sp.user === "string"
      ? sp.user
      : (cookieStore.get("fundcalm_uid")?.value ?? null);
  const token = typeof sp.token === "string" ? sp.token : undefined;

  let alreadyCompleted = false;
  let nextSlug: string | null = null;

  if (userId) {
    const [completed, profile] = await Promise.all([
      withTimeout(getCompletedSlugs(userId), 3_000, new Set<string>()),
      withTimeout(getUserProfile(userId), 5_000, null),
    ]);
    alreadyCompleted = completed.has(slug);

    if (profile) {
      const onboarding = profileToOnboardingInput(profile);
      const financial = fromOnboarding(onboarding);
      const result = getFinancialStatus(financial);
      const path = buildCurriculumPath({
        diagnosis: result.diagnosis,
        fear: financial.primary_fear,
        completed,
      });
      // Next = first incomplete that isn't this one.
      const filtered = path.filter((l) => l.slug !== slug);
      const nxt = nextLesson(
        filtered,
        new Set([...completed, slug]),
      );
      nextSlug = nxt?.slug ?? null;
    }
  }

  const dashHref = userId
    ? token
      ? `/dashboard?user=${userId}&token=${token}`
      : `/dashboard?user=${userId}`
    : "/dashboard";

  const nextHref = nextSlug
    ? userId
      ? token
        ? `/lesson/${nextSlug}?user=${userId}&token=${token}`
        : `/lesson/${nextSlug}?user=${userId}`
      : `/lesson/${nextSlug}`
    : dashHref;
  const nextLabel = nextSlug ? "Next lesson →" : "Back to your path →";

  return (
    <main className="mx-auto max-w-2xl pb-16 pt-2">
      <nav className="mb-6 flex items-center justify-between gap-3 text-sm">
        <Link href={dashHref} className="fc-link-muted">
          ← Back to your path
        </Link>
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {PILLAR_LABEL[lesson.pillar]} · {lesson.estMinutes} min
        </span>
      </nav>

      <header>
        <p className="text-xs font-medium text-slate-500">
          {PILLAR_TAGLINE[lesson.pillar]}
        </p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-slate-900">
          {lesson.title}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-600">
          {lesson.hook}
        </p>
      </header>

      <article className="mt-8 space-y-5 text-[15px] leading-relaxed text-slate-800">
        {lesson.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </article>

      <LessonActions
        userId={userId}
        slug={lesson.slug}
        alreadyCompleted={alreadyCompleted}
        exercise={lesson.exercise}
        nextHref={nextHref}
        nextLabel={nextLabel}
      />
    </main>
  );
}
