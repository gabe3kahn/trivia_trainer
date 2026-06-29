import { supabase } from '@/src/services/supabase';
import type {
  AttemptGrade, RecommendedQuestion, SessionMode,
  DailyChallenge, LeaderboardRow, FriendRow, UserSearchRow, GameSummary, GamePayload,
} from '@/src/types/supabase';

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

export type ActivityDay = {
  date: string;
  total: number;
  correct: number;
  missed: number;
  by_category: Record<string, number>;
};
export type ActivityCategory = { category_id: string; reps: number; correct: number; accuracy: number };
export type ActivitySummary = { daily: ActivityDay[]; by_category: ActivityCategory[] };

export async function getActivitySummary(days = 30): Promise<ActivitySummary> {
  const { data, error } = await (supabase.rpc as any)('get_activity_summary', { p_days: days });
  if (error) throw error;
  return (data as ActivitySummary) ?? { daily: [], by_category: [] };
}

export type CompetencyPoint = { date: string; score: number; attempts: number };

export async function getCompetencyTimeseries(days = 30): Promise<CompetencyPoint[]> {
  const { data, error } = await (supabase.rpc as any)('get_competency_timeseries', { p_days: days });
  if (error) throw error;
  return (data as CompetencyPoint[]) ?? [];
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

// A buffered run is committed in one call when it finishes (033): all attempts are
// inserted server-side and competency recalcs once. Abandoning a run writes nothing.
export type RunAttempt = {
  questionId: string;
  response: string | null;
  grade: AttemptGrade;
  timeMs: number | null;
};

const toAttemptJson = (attempts: RunAttempt[]) =>
  attempts.map((a) => ({ question_id: a.questionId, response: a.response, grade: a.grade, time_ms: a.timeMs }));

export async function submitPracticeRun({
  mode,
  questionIds,
  attempts,
  selectedCategories = [],
  selectedSubcategories = [],
  selectedValues = [],
  selectedMechanics = [],
}: {
  mode: SessionMode;
  questionIds: string[];
  attempts: RunAttempt[];
  selectedCategories?: string[];
  selectedSubcategories?: string[];
  selectedValues?: number[];
  selectedMechanics?: string[];
}) {
  const { data, error } = await (supabase.rpc as any)('submit_practice_run', {
    p_mode: mode,
    p_question_ids: questionIds,
    p_attempts: toAttemptJson(attempts),
    p_selected_categories: selectedCategories,
    p_selected_subcategories: selectedSubcategories,
    p_selected_values: selectedValues,
    p_selected_mechanics: selectedMechanics,
  });
  if (error) throwSupabaseError(error);
  return data;
}

export async function submitGameRun(gameId: string, attempts: RunAttempt[]) {
  const { error } = await (supabase.rpc as any)('submit_game_run', {
    p_game: gameId,
    p_attempts: toAttemptJson(attempts),
  });
  if (error) throwSupabaseError(error);
}

export async function submitDailyRun(date: string, attempts: RunAttempt[]) {
  const { error } = await (supabase.rpc as any)('submit_daily_run', {
    p_date: date,
    p_attempts: toAttemptJson(attempts),
  });
  if (error) throwSupabaseError(error);
}

/* ---- Daily Challenge (017) ------------------------------------------------ */
export async function getDailyChallenge(date?: string): Promise<DailyChallenge> {
  const { data, error } = await (supabase.rpc as any)('get_daily_challenge', date ? { p_date: date } : {});
  if (error) throwSupabaseError(error);
  return data as DailyChallenge;
}

export async function submitDailyAttempt(args: {
  date: string; questionId: string; response: string | null; grade: AttemptGrade; timeMs: number | null;
}) {
  const { error } = await (supabase.rpc as any)('submit_daily_attempt', {
    p_date: args.date, p_question: args.questionId, p_response: args.response,
    p_grade: args.grade, p_time_ms: args.timeMs,
  });
  if (error) throwSupabaseError(error);
}

export async function getDailyLeaderboard(date?: string): Promise<LeaderboardRow[]> {
  const { data, error } = await (supabase.rpc as any)('get_daily_leaderboard', date ? { p_date: date } : {});
  if (error) throwSupabaseError(error);
  return (data ?? []) as LeaderboardRow[];
}

export async function getDailyStreak(): Promise<number> {
  const { data, error } = await (supabase.rpc as any)('daily_streak', {});
  if (error) throwSupabaseError(error);
  return (data ?? 0) as number;
}

/* ---- Friends (014) -------------------------------------------------------- */
export async function searchUsers(q: string): Promise<UserSearchRow[]> {
  const { data, error } = await (supabase.rpc as any)('search_users', { p_q: q });
  if (error) throwSupabaseError(error);
  return (data ?? []) as UserSearchRow[];
}
export async function listFriends(): Promise<FriendRow[]> {
  const { data, error } = await (supabase.rpc as any)('list_friends', {});
  if (error) throwSupabaseError(error);
  return (data ?? []) as FriendRow[];
}
export async function sendFriendRequest(addresseeId: string): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('send_friend_request', { p_addressee: addresseeId });
  if (error) throwSupabaseError(error);
  return data as string;
}
export async function respondFriendRequest(id: string, accept: boolean) {
  const { error } = await (supabase.rpc as any)('respond_friend_request', { p_id: id, p_accept: accept });
  if (error) throwSupabaseError(error);
}
export async function createInvite(): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('create_invite', {});
  if (error) throwSupabaseError(error);
  return data as string;
}

/* ---- Duels (014) ---------------------------------------------------------- */
export async function listGames(status?: string): Promise<GameSummary[]> {
  const { data, error } = await (supabase.rpc as any)('list_games', status ? { p_status: status } : {});
  if (error) throwSupabaseError(error);
  return (data ?? []) as GameSummary[];
}
export async function createGame(args: {
  opponentId: string; count?: number; categories?: string[] | null; mechanics?: string[] | null;
}): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('create_game', {
    p_opponent: args.opponentId, p_count: args.count ?? 6,
    p_categories: args.categories ?? null, p_mechanics: args.mechanics ?? null,
  });
  if (error) throwSupabaseError(error);
  return data as string;
}
export async function getGame(gameId: string): Promise<GamePayload> {
  const { data, error } = await (supabase.rpc as any)('get_game', { p_game: gameId });
  if (error) throwSupabaseError(error);
  return data as GamePayload;
}
export async function submitGameAttempt(args: {
  gameId: string; questionId: string; response: string | null; grade: AttemptGrade; timeMs: number | null;
}) {
  const { error } = await (supabase.rpc as any)('submit_game_attempt', {
    p_game: args.gameId, p_question: args.questionId, p_response: args.response,
    p_grade: args.grade, p_time_ms: args.timeMs,
  });
  if (error) throwSupabaseError(error);
}

function throwSupabaseError(error: { message?: string; code?: string; details?: string; hint?: string }): never {
  const parts = [error.message, error.details, error.hint, error.code ? `Code: ${error.code}` : null].filter(Boolean);
  throw new Error(parts.join('\n'));
}
