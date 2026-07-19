export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AttemptGrade = 'correct' | 'close' | 'missed' | 'unknown';
export type SessionMode = 'weakness' | 'balanced' | 'random' | 'selected' | 'review' | 'wordplay' | 'daily' | 'challenge';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          username: string | null;
          created_at: string;
          last_active_at: string | null;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          username?: string | null;
          created_at?: string;
          last_active_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      categories: {
        Row: {
          id: string;
          name: string;
          sort_order: number;
        };
        Insert: {
          id: string;
          name: string;
          sort_order: number;
        };
        Update: Partial<Database['public']['Tables']['categories']['Insert']>;
      };
      subcategories: {
        Row: {
          id: string;
          category_id: string;
          name: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          category_id: string;
          name: string;
          sort_order: number;
        };
        Update: Partial<Database['public']['Tables']['subcategories']['Insert']>;
      };
      questions: {
        Row: {
          id: string;
          source: string;
          source_url: string | null;
          external_id: string | null;
          category_id: string;
          subcategory_id: string | null;
          value: number;
          difficulty_rank: number;
          mechanic: string;
          constraint_text: string | null;
          clue: string;
          answer: string;
          aliases: string[];
          tags: string[];
          quality_status: 'unreviewed' | 'keep' | 'rewrite' | 'replace' | 'deactivate';
          quality_score: number | null;
          quality_issues: string[];
          citations: Json;
          verification_status: 'verified' | 'weak' | 'unverified' | 'skipped';
          verified_at: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['questions']['Row']> & {
          category_id: string;
          value: number;
          difficulty_rank: number;
          clue: string;
          answer: string;
        };
        Update: Partial<Database['public']['Tables']['questions']['Insert']>;
      };
      category_competencies: {
        Row: {
          id: string;
          user_id: string;
          dimension_type: 'overall' | 'category' | 'subcategory' | 'value' | 'mechanic' | 'tag';
          dimension_key: string;
          score: number;
          tier: string;
          attempts: number;
          correct_rate: number;
          avg_correct_value: number;
          due_review_count: number;
          seven_day_delta: number;
          thirty_day_delta: number;
          updated_at: string;
        };
        Insert: never;
        Update: never;
      };
      daily_activity: {
        Row: {
          id: string;
          user_id: string;
          activity_date: string;
          reps: number;
          review_reps: number;
          challenge_reps: number;
          review_cleared: boolean;
          challenge_played: boolean;
          categories_touched: string[];
          daily_goal_met: boolean;
          updated_at: string;
        };
        Insert: never;
        Update: never;
      };
      badges: {
        Row: {
          key: string;
          name: string;
          description: string;
          criteria: Json;
          tier: string | null;
        };
        Insert: Database['public']['Tables']['badges']['Row'];
        Update: Partial<Database['public']['Tables']['badges']['Insert']>;
      };
      user_badges: {
        Row: {
          id: string;
          user_id: string;
          badge_key: string;
          earned_at: string;
          metadata: Json;
        };
        Insert: never;
        Update: never;
      };
      friendships: {
        Row: {
          id: string;
          requester_id: string;
          addressee_id: string;
          status: 'pending' | 'accepted' | 'blocked';
          created_at: string;
          accepted_at: string | null;
        };
        Insert: {
          requester_id: string;
          addressee_id: string;
          status?: 'pending' | 'accepted' | 'blocked';
        };
        Update: Partial<Database['public']['Tables']['friendships']['Insert']>;
      };
    };
    Functions: {
      get_recommended_questions: {
        Args: {
          p_mode?: string;
          p_limit?: number;
          p_categories?: string[] | null;
          p_values?: number[] | null;
          p_mechanics?: string[] | null;
        };
        Returns: RecommendedQuestion[];
      };
      create_practice_session: {
        Args: {
          p_mode: SessionMode;
          p_question_ids: string[];
          p_selected_categories?: string[];
          p_selected_subcategories?: string[];
          p_selected_values?: number[];
          p_selected_mechanics?: string[];
        };
        Returns: string;
      };
      submit_practice_attempt: {
        Args: {
          p_session_id: string | null;
          p_question_id: string;
          p_typed_response: string | null;
          p_grade: AttemptGrade;
          p_confidence?: number | null;
          p_time_to_answer_ms?: number | null;
        };
        Returns: string;
      };
    };
    Views: Record<string, never>;
    Enums: {
      attempt_grade: AttemptGrade;
      session_mode: SessionMode;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type RecommendedQuestion = {
  id: string;
  category_id: string;
  category_name: string;
  subcategory_id: string | null;
  subcategory_name: string | null;
  value: number;
  difficulty_rank: number;
  mechanic: string;
  constraint_text: string | null;
  clue: string;
  answer: string;
  aliases: string[];
  tags: string[];
  image_url: string | null;
  image_attribution: string | null;
  answer_detail: string | null;
  answer_type?: 'name' | 'other'; // 'name' => bare surname counts; else strict (default)
};

/* ---- Compete (014 multiplayer + 017 daily challenge) ---------------------- */

// Clue payload returned by get_daily_challenge / get_game. Same fields as a clue in
// the Train flow MINUS `value` (points are computed server-side on submit).
export type ChallengeQuestion = {
  id: string;
  category_id: string;
  category_name: string;
  subcategory_name: string | null;
  difficulty_rank: number;
  mechanic: string;
  constraint_text: string | null;
  clue: string;
  answer: string;
  aliases: string[];
  image_url: string | null;
  answer_detail: string | null;
  answer_type?: 'name' | 'other'; // 'name' => bare surname counts; else strict (default)
  value?: number; // present in duel payloads (get_game); omitted by the daily challenge
};

export type DailyAttempt = { question_id: string; grade: AttemptGrade; points: number };

export type DailyChallenge = {
  challenge_date: string;
  set_size: number;
  seconds_per_question: number;
  questions: ChallengeQuestion[];
  my_attempts: DailyAttempt[];
  completed: boolean;
};

export type LeaderboardRow = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  score: number;
  correct: number;
  total_time_ms: number;
  completed: boolean;
  is_me: boolean;
};

export type FriendRow = { id: string; username: string | null; display_name: string | null; avatar_url: string | null };
export type UserSearchRow = FriendRow & { status: 'none' | 'pending' | 'accepted' | 'blocked' };

export type GameSummary = {
  id: string;
  status: 'pending' | 'active' | 'completed' | 'expired';
  mode: string;
  set_size: number;
  opponent_id: string | null;
  opponent_name: string | null;
  opponent_username: string | null;
  opponent_avatar: string | null;
  is_creator: boolean;
  your_turn: boolean;
  my_answered: number;
  their_answered: number;
  creator_score: number;
  opponent_score: number;
  winner_id: string | null;
  created_at: string;
  expires_at: string | null;
};

export type GamePayload = {
  id: string;
  status: 'pending' | 'active' | 'completed' | 'expired';
  creator_id: string;
  opponent_id: string | null;
  winner_id: string | null;
  creator_score: number;
  opponent_score: number;
  expires_at: string | null;
  set_size: number;
  seconds_per_question: number;
  questions: ChallengeQuestion[];
  my_attempts: DailyAttempt[];
  opponent: { id: string; display_name: string | null; username: string | null; avatar_url: string | null } | null;
  opponent_answered: number;
  opponent_attempts: DailyAttempt[]; // populated only once the duel is completed/expired
};
