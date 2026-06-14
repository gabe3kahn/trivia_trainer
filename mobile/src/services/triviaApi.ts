import { supabase } from '@/src/services/supabase';
import type { AttemptGrade, RecommendedQuestion, SessionMode } from '@/src/types/supabase';

export async function fetchHomeCompetencies() {
  const { data, error } = await supabase
    .from('category_competencies')
    .select('*')
    .in('dimension_type', ['overall', 'category'])
    .order('dimension_type', { ascending: false })
    .order('score', { ascending: false });

  if (error) throw error;
  return data;
}

export async function fetchCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data;
}

export async function fetchProfile() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function fetchDailyActivity(startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('daily_activity')
    .select('*')
    .gte('activity_date', startDate)
    .lte('activity_date', endDate)
    .order('activity_date', { ascending: true });

  if (error) throw error;
  return data;
}

export async function fetchBadges() {
  const { data, error } = await supabase
    .from('badges')
    .select('*')
    .order('tier', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return data;
}

export async function fetchEarnedBadges() {
  const { data, error } = await supabase
    .from('user_badges')
    .select('*')
    .order('earned_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function fetchFriendships() {
  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .eq('status', 'accepted');

  if (error) throw error;
  return data;
}

export async function getRecommendedQuestions({
  mode,
  limit = 12,
  categories = null,
  values = null,
  mechanics = null,
}: {
  mode: SessionMode | 'weakness';
  limit?: number;
  categories?: string[] | null;
  values?: number[] | null;
  mechanics?: string[] | null;
}): Promise<RecommendedQuestion[]> {
  const { data, error } = await (supabase.rpc as any)('get_recommended_questions', {
    p_mode: mode,
    p_limit: limit,
    p_categories: categories,
    p_values: values,
    p_mechanics: mechanics,
  });

  if (error) throwSupabaseError(error);
  return data ?? [];
}

export async function createPracticeSession({
  mode,
  questionIds,
  selectedCategories = [],
  selectedSubcategories = [],
  selectedValues = [],
  selectedMechanics = [],
}: {
  mode: SessionMode;
  questionIds: string[];
  selectedCategories?: string[];
  selectedSubcategories?: string[];
  selectedValues?: number[];
  selectedMechanics?: string[];
}) {
  const { data, error } = await (supabase.rpc as any)('create_practice_session', {
    p_mode: mode,
    p_question_ids: questionIds,
    p_selected_categories: selectedCategories,
    p_selected_subcategories: selectedSubcategories,
    p_selected_values: selectedValues,
    p_selected_mechanics: selectedMechanics,
  });

  if (error) throwSupabaseError(error);
  return data;
}

export async function submitPracticeAttempt({
  sessionId,
  questionId,
  typedResponse,
  grade,
  confidence = null,
  timeToAnswerMs = null,
}: {
  sessionId: string | null;
  questionId: string;
  typedResponse: string | null;
  grade: AttemptGrade;
  confidence?: number | null;
  timeToAnswerMs?: number | null;
}) {
  const { data, error } = await (supabase.rpc as any)('submit_practice_attempt', {
    p_session_id: sessionId,
    p_question_id: questionId,
    p_typed_response: typedResponse,
    p_grade: grade,
    p_confidence: confidence,
    p_time_to_answer_ms: timeToAnswerMs,
  });

  if (error) throwSupabaseError(error);
  return data;
}

function throwSupabaseError(error: { message?: string; code?: string; details?: string; hint?: string }): never {
  const parts = [error.message, error.details, error.hint, error.code ? `Code: ${error.code}` : null].filter(Boolean);
  throw new Error(parts.join('\n'));
}
