import { Diagnosis, type PrimaryFear } from "@/lib/engine";
import {
  LESSON_CATALOG,
  lessonsByPillar,
  getLesson,
} from "@/lib/lessons/catalog";
import type { Lesson, Pillar } from "@/lib/lessons/types";

// ---------------------------------------------------------------------------
// Diagnosis × fear → ordered pillar list
// ---------------------------------------------------------------------------

const PILLAR_ORDER_BY_DIAGNOSIS: Record<Diagnosis, readonly Pillar[]> = {
  [Diagnosis.CriticalBuffer]:    ["survival", "enough", "behavior", "time", "leverage"],
  [Diagnosis.InsufficientBuffer]: ["survival", "enough", "time", "behavior", "leverage"],
  [Diagnosis.LimitedBuffer]:     ["time", "behavior", "leverage", "enough", "survival"],
  [Diagnosis.Overinvested]:      ["survival", "behavior", "enough", "time", "leverage"],
  [Diagnosis.TooConservative]:   ["behavior", "time", "leverage", "enough", "survival"],
  [Diagnosis.BalancedButIdle]:   ["leverage", "time", "behavior", "enough", "survival"],
  [Diagnosis.Healthy]:           ["leverage", "enough", "time", "behavior", "survival"],
};

// ---------------------------------------------------------------------------
// Fear-based reweighting (within a pillar's lesson list)
// Lessons whose `speaksTo` includes the user's fear bubble to the top.
// ---------------------------------------------------------------------------

function reorderByFear(lessons: Lesson[], fear: PrimaryFear): Lesson[] {
  const matches: Lesson[] = [];
  const rest: Lesson[] = [];
  for (const l of lessons) {
    if (l.speaksTo?.includes(fear)) matches.push(l);
    else rest.push(l);
  }
  return [...matches, ...rest];
}

// ---------------------------------------------------------------------------
// Public path builder
// ---------------------------------------------------------------------------

export interface CurriculumContext {
  diagnosis: Diagnosis;
  fear: PrimaryFear;
  /** Slugs the user has already completed. */
  completed: ReadonlySet<string>;
}

export interface PillarProgress {
  pillar: Pillar;
  total: number;
  completed: number;
}

/**
 * Returns the user's full personalised reading path, in order.
 * The first incomplete lesson is the next one to surface.
 */
export function buildCurriculumPath(ctx: CurriculumContext): Lesson[] {
  const order = PILLAR_ORDER_BY_DIAGNOSIS[ctx.diagnosis];
  const out: Lesson[] = [];
  for (const pillar of order) {
    const lessons = reorderByFear(lessonsByPillar(pillar), ctx.fear);
    out.push(...lessons);
  }
  return out;
}

/** First lesson in the path the user hasn't completed yet. */
export function nextLesson(
  path: Lesson[],
  completed: ReadonlySet<string>,
): Lesson | null {
  return path.find((l) => !completed.has(l.slug)) ?? null;
}

/** Per-pillar completion counts, in the user's curriculum order. */
export function pillarProgress(
  ctx: CurriculumContext,
): PillarProgress[] {
  const order = PILLAR_ORDER_BY_DIAGNOSIS[ctx.diagnosis];
  return order.map((pillar) => {
    const lessons = lessonsByPillar(pillar);
    const completed = lessons.filter((l) => ctx.completed.has(l.slug)).length;
    return { pillar, total: lessons.length, completed };
  });
}

/** Defensive accessor for routing — never throws on unknown slugs. */
export function lessonForSlug(slug: string): Lesson | null {
  return getLesson(slug) ?? null;
}

/** Total lessons across all pillars. */
export const TOTAL_LESSONS = LESSON_CATALOG.length;
