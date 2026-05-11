import { getSupabase } from "./supabase";

export type LessonProgressStatus = "started" | "completed";

export interface LessonProgressRow {
  id: string;
  user_id: string;
  slug: string;
  status: LessonProgressStatus;
  reflection: string | null;
  completed_at: string;
}

export async function getCompletedSlugs(userId: string): Promise<Set<string>> {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from("lesson_progress")
    .select("slug, status")
    .eq("user_id", userId)
    .eq("status", "completed");
  if (error) throw new Error(`Lesson progress fetch failed: ${error.message}`);
  const slugs = (data ?? []).map(
    (r) => (r as { slug: string }).slug,
  );
  return new Set(slugs);
}

export async function getLessonProgressList(
  userId: string,
): Promise<LessonProgressRow[]> {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from("lesson_progress")
    .select("id, user_id, slug, status, reflection, completed_at")
    .eq("user_id", userId);
  if (error) throw new Error(`Lesson progress fetch failed: ${error.message}`);
  return (data ?? []) as LessonProgressRow[];
}

export async function markLessonCompleted(
  userId: string,
  slug: string,
  reflection?: string,
): Promise<void> {
  const sb = await getSupabase();
  const { error } = await sb
    .from("lesson_progress")
    .upsert(
      {
        user_id: userId,
        slug,
        status: "completed" as LessonProgressStatus,
        reflection: reflection?.trim() ? reflection.trim() : null,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,slug" },
    );
  if (error) throw new Error(`Lesson progress write failed: ${error.message}`);
}
