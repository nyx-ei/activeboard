import type { ConfidenceLevel } from '@/lib/demo/confidence';
import type { AvailabilityGrid } from '@/lib/schedule/availability';
import type {
  AnswerState,
  DimensionOfCare,
  ErrorType,
  PhysicianActivity,
} from '@/lib/types/demo';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type AnswersRow = {
  answer_state: AnswerState;
  answer_request_mode: 'submit' | 'timeout';
  answer_request_sequence: number;
  answered_at: string;
  confidence: ConfidenceLevel | null;
  id: string;
  is_correct: boolean | null;
  question_id: string;
  review_correct_option: string | null;
  reviewed_at: string | null;
  selected_option: string | null;
  user_id: string;
};

type AnswersInsert = {
  answer_state?: AnswerState;
  answer_request_mode?: 'submit' | 'timeout';
  answer_request_sequence?: number;
  answered_at?: string;
  confidence?: ConfidenceLevel | null;
  id?: string;
  is_correct?: boolean | null;
  question_id: string;
  review_correct_option?: string | null;
  reviewed_at?: string | null;
  selected_option?: string | null;
  user_id: string;
};

type AnswersUpdate = {
  answer_state?: AnswerState;
  answer_request_mode?: 'submit' | 'timeout';
  answer_request_sequence?: number;
  answered_at?: string;
  confidence?: ConfidenceLevel | null;
  id?: string;
  is_correct?: boolean | null;
  question_id?: string;
  review_correct_option?: string | null;
  reviewed_at?: string | null;
  selected_option?: string | null;
  user_id?: string;
};

type AppLogsRow = {
  created_at: string;
  event_name: string;
  feature_flag_key: string | null;
  group_id: string | null;
  id: string;
  level: 'info' | 'warn' | 'error';
  locale: 'en' | 'fr' | null;
  metadata: Json;
  session_id: string | null;
  user_id: string | null;
};

type AppLogsInsert = {
  created_at?: string;
  event_name: string;
  feature_flag_key?: string | null;
  group_id?: string | null;
  id?: string;
  level?: 'info' | 'warn' | 'error';
  locale?: 'en' | 'fr' | null;
  metadata?: Json;
  session_id?: string | null;
  user_id?: string | null;
};

type AppLogsUpdate = {
  created_at?: string;
  event_name?: string;
  feature_flag_key?: string | null;
  group_id?: string | null;
  id?: string;
  level?: 'info' | 'warn' | 'error';
  locale?: 'en' | 'fr' | null;
  metadata?: Json;
  session_id?: string | null;
  user_id?: string | null;
};

type FeatureFlagsRow = {
  created_at: string;
  description: string | null;
  enabled: boolean;
  key: string;
  updated_at: string;
};

type FeatureFlagsInsert = {
  created_at?: string;
  description?: string | null;
  enabled?: boolean;
  key: string;
  updated_at?: string;
};

type FeatureFlagsUpdate = {
  created_at?: string;
  description?: string | null;
  enabled?: boolean;
  key?: string;
  updated_at?: string;
};

type PasswordSetupTokensRow = {
  created_at: string;
  email: string;
  expires_at: string;
  token_hash: string;
  used_at: string | null;
  user_id: string;
};

type PasswordSetupTokensInsert = {
  created_at?: string;
  email: string;
  expires_at: string;
  token_hash: string;
  used_at?: string | null;
  user_id: string;
};

type PasswordSetupTokensUpdate = {
  created_at?: string;
  email?: string;
  expires_at?: string;
  token_hash?: string;
  used_at?: string | null;
  user_id?: string;
};

type LandingOnboardingTokensRow = {
  created_at: string;
  draft: Json;
  email: string;
  expires_at: string;
  token_hash: string;
  used_at: string | null;
};

type LandingOnboardingTokensInsert = {
  created_at?: string;
  draft: Json;
  email: string;
  expires_at: string;
  token_hash: string;
  used_at?: string | null;
};

type LandingOnboardingTokensUpdate = {
  created_at?: string;
  draft?: Json;
  email?: string;
  expires_at?: string;
  token_hash?: string;
  used_at?: string | null;
};

type GroupMembersRow = {
  group_id: string;
  is_founder: boolean;
  invited_during_session_id: string | null;
  joined_at: string;
  user_id: string;
};

type GroupMembersInsert = {
  group_id: string;
  is_founder?: boolean;
  invited_during_session_id?: string | null;
  joined_at?: string;
  user_id: string;
};

type GroupMembersUpdate = {
  group_id?: string;
  is_founder?: boolean;
  invited_during_session_id?: string | null;
  joined_at?: string;
  user_id?: string;
};

type GroupsRow = {
  created_at: string;
  created_by: string | null;
  difficulty_level: 'low' | 'medium' | 'high';
  group_kind: 'manual' | 'session_test' | 'solidified';
  id: string;
  invite_code: string;
  last_session_id: string | null;
  max_members: number;
  meeting_link: string | null;
  name: string;
  solidified_at: string | null;
};

type GroupsInsert = {
  created_at?: string;
  created_by?: string | null;
  difficulty_level?: 'low' | 'medium' | 'high';
  group_kind?: 'manual' | 'session_test' | 'solidified';
  id?: string;
  invite_code: string;
  last_session_id?: string | null;
  max_members?: number;
  meeting_link?: string | null;
  name: string;
  solidified_at?: string | null;
};

type GroupsUpdate = {
  created_at?: string;
  created_by?: string | null;
  difficulty_level?: 'low' | 'medium' | 'high';
  group_kind?: 'manual' | 'session_test' | 'solidified';
  id?: string;
  invite_code?: string;
  last_session_id?: string | null;
  max_members?: number;
  meeting_link?: string | null;
  name?: string;
  solidified_at?: string | null;
};

type GroupInvitesRow = {
  created_at: string;
  group_id: string;
  id: string;
  invited_by: string;
  invited_during_session_id: string | null;
  invitee_email: string;
  invitee_user_id: string | null;
  responded_at: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
};

type GroupInvitesInsert = {
  created_at?: string;
  group_id: string;
  id?: string;
  invited_by: string;
  invited_during_session_id?: string | null;
  invitee_email: string;
  invitee_user_id?: string | null;
  responded_at?: string | null;
  status?: 'pending' | 'accepted' | 'declined' | 'cancelled';
};

type GroupInvitesUpdate = {
  created_at?: string;
  group_id?: string;
  id?: string;
  invited_by?: string;
  invited_during_session_id?: string | null;
  invitee_email?: string;
  invitee_user_id?: string | null;
  responded_at?: string | null;
  status?: 'pending' | 'accepted' | 'declined' | 'cancelled';
};

type InvitationSource = 'onboarding' | 'dashboard' | 'on_the_fly';

type InvitationsRow = {
  created_at: string;
  expires_at: string;
  group_id: string;
  group_invite_id: string;
  id: string;
  invited_by: string;
  invited_email: string;
  invited_user_id: string | null;
  responded_at: string | null;
  session_id: string | null;
  source: InvitationSource;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
};

type InvitationsInsert = {
  created_at?: string;
  expires_at?: string;
  group_id: string;
  group_invite_id: string;
  id?: string;
  invited_by: string;
  invited_email: string;
  invited_user_id?: string | null;
  responded_at?: string | null;
  session_id?: string | null;
  source?: InvitationSource;
  status?: 'pending' | 'accepted' | 'declined' | 'cancelled';
};

type InvitationsUpdate = {
  created_at?: string;
  expires_at?: string;
  group_id?: string;
  group_invite_id?: string;
  id?: string;
  invited_by?: string;
  invited_email?: string;
  invited_user_id?: string | null;
  responded_at?: string | null;
  session_id?: string | null;
  source?: InvitationSource;
  status?: 'pending' | 'accepted' | 'declined' | 'cancelled';
};

type GroupWeeklySchedulesRow = {
  created_at: string;
  end_time: string;
  group_id: string;
  id: string;
  question_goal: number;
  start_time: string;
  weekday:
    | 'monday'
    | 'tuesday'
    | 'wednesday'
    | 'thursday'
    | 'friday'
    | 'saturday'
    | 'sunday';
};

type GroupWeeklySchedulesInsert = {
  created_at?: string;
  end_time: string;
  group_id: string;
  id?: string;
  question_goal?: number;
  start_time: string;
  weekday:
    | 'monday'
    | 'tuesday'
    | 'wednesday'
    | 'thursday'
    | 'friday'
    | 'saturday'
    | 'sunday';
};

type GroupWeeklySchedulesUpdate = {
  created_at?: string;
  end_time?: string;
  group_id?: string;
  id?: string;
  question_goal?: number;
  start_time?: string;
  weekday?:
    | 'monday'
    | 'tuesday'
    | 'wednesday'
    | 'thursday'
    | 'friday'
    | 'saturday'
    | 'sunday';
};

type QuestionsRow = {
  answer_deadline_at: string | null;
  asked_by: string;
  body: string | null;
  category_tags: string[] | null;
  correct_option: string | null;
  id: string;
  launched_at: string | null;
  options: Json;
  order_index: number;
  phase: 'draft' | 'answering' | 'review' | 'closed';
  review_version: number;
  session_id: string;
};

type QuestionsInsert = {
  answer_deadline_at?: string | null;
  asked_by: string;
  body?: string | null;
  category_tags?: string[] | null;
  correct_option?: string | null;
  id?: string;
  launched_at?: string | null;
  options: Json;
  order_index: number;
  phase?: 'draft' | 'answering' | 'review' | 'closed';
  review_version?: number;
  session_id: string;
};

type QuestionsUpdate = {
  answer_deadline_at?: string | null;
  asked_by?: string;
  body?: string | null;
  category_tags?: string[] | null;
  correct_option?: string | null;
  id?: string;
  launched_at?: string | null;
  options?: Json;
  order_index?: number;
  phase?: 'draft' | 'answering' | 'review' | 'closed';
  review_version?: number;
  session_id?: string;
};

type SessionStateEventsRow = {
  actor_id: string | null;
  created_at: string;
  event_type:
    | 'answer_submitted'
    | 'answer_timed_out'
    | 'question_advanced'
    | 'session_completed';
  group_id: string;
  id: string;
  payload: Json;
  question_id: string | null;
  session_id: string;
};

type SessionStateEventsInsert = {
  actor_id?: string | null;
  created_at?: string;
  event_type:
    | 'answer_submitted'
    | 'answer_timed_out'
    | 'question_advanced'
    | 'session_completed';
  group_id: string;
  id?: string;
  payload?: Json;
  question_id?: string | null;
  session_id: string;
};

type SessionStateEventsUpdate = {
  actor_id?: string | null;
  created_at?: string;
  event_type?:
    | 'answer_submitted'
    | 'answer_timed_out'
    | 'question_advanced'
    | 'session_completed';
  group_id?: string;
  id?: string;
  payload?: Json;
  question_id?: string | null;
  session_id?: string;
};

type QuestionClassificationsRow = {
  classified_at: string;
  classified_by: string;
  correct_answer: string | null;
  dimension_of_care: DimensionOfCare;
  frequent_error_type: ErrorType | null;
  id: string;
  physician_activity: PhysicianActivity;
  question_id: string;
  session_id: string;
};

type QuestionClassificationsInsert = {
  classified_at?: string;
  classified_by: string;
  correct_answer?: string | null;
  dimension_of_care: DimensionOfCare;
  frequent_error_type?: ErrorType | null;
  id?: string;
  physician_activity: PhysicianActivity;
  question_id: string;
  session_id: string;
};

type QuestionClassificationsUpdate = {
  classified_at?: string;
  classified_by?: string;
  correct_answer?: string | null;
  dimension_of_care?: DimensionOfCare;
  frequent_error_type?: ErrorType | null;
  id?: string;
  physician_activity?: PhysicianActivity;
  question_id?: string;
  session_id?: string;
};

type PersonalReflectionsRow = {
  created_at: string;
  error_type: ErrorType | null;
  id: string;
  private_note: string | null;
  question_id: string;
  updated_at: string;
  user_id: string;
};

type PersonalReflectionsInsert = {
  created_at?: string;
  error_type?: ErrorType | null;
  id?: string;
  private_note?: string | null;
  question_id: string;
  updated_at?: string;
  user_id: string;
};

type PersonalReflectionsUpdate = {
  created_at?: string;
  error_type?: ErrorType | null;
  id?: string;
  private_note?: string | null;
  question_id?: string;
  updated_at?: string;
  user_id?: string;
};

type SessionsRow = {
  created_by: string | null;
  ended_at: string | null;
  group_id: string;
  id: string;
  leader_id: string | null;
  meeting_link: string | null;
  name: string | null;
  planned_from_session_id: string | null;
  question_goal: number;
  review_timer_seconds: number;
  scheduled_at: string;
  share_code: string;
  started_at: string | null;
  status: 'scheduled' | 'active' | 'incomplete' | 'completed' | 'cancelled';
  timer_mode: 'per_question' | 'global';
  timer_seconds: number;
};

type SessionsInsert = {
  created_by?: string | null;
  ended_at?: string | null;
  group_id: string;
  id?: string;
  leader_id?: string | null;
  meeting_link?: string | null;
  name?: string | null;
  planned_from_session_id?: string | null;
  question_goal?: number;
  review_timer_seconds?: number;
  scheduled_at: string;
  share_code?: string;
  started_at?: string | null;
  status?: 'scheduled' | 'active' | 'incomplete' | 'completed' | 'cancelled';
  timer_mode?: 'per_question' | 'global';
  timer_seconds?: number;
};

type SessionsUpdate = {
  created_by?: string | null;
  ended_at?: string | null;
  group_id?: string;
  id?: string;
  leader_id?: string | null;
  meeting_link?: string | null;
  name?: string | null;
  planned_from_session_id?: string | null;
  question_goal?: number;
  review_timer_seconds?: number;
  scheduled_at?: string;
  share_code?: string;
  started_at?: string | null;
  status?: 'scheduled' | 'active' | 'incomplete' | 'completed' | 'cancelled';
  timer_mode?: 'per_question' | 'global';
  timer_seconds?: number;
};

type SessionEmailRemindersRow = {
  id: string;
  provider_message_id: string | null;
  reminder_key: '24h' | '1h';
  sent_at: string;
  session_id: string;
  user_id: string;
};

type SessionEmailRemindersInsert = {
  id?: string;
  provider_message_id?: string | null;
  reminder_key: '24h' | '1h';
  sent_at?: string;
  session_id: string;
  user_id: string;
};

type SessionEmailRemindersUpdate = {
  id?: string;
  provider_message_id?: string | null;
  reminder_key?: '24h' | '1h';
  sent_at?: string;
  session_id?: string;
  user_id?: string;
};

type SessionCalendarInvitesRow = {
  id: string;
  provider_message_id: string | null;
  sent_at: string;
  session_id: string;
  user_id: string;
};

type SessionCalendarInvitesInsert = {
  id?: string;
  provider_message_id?: string | null;
  sent_at?: string;
  session_id: string;
  user_id: string;
};

type SessionCalendarInvitesUpdate = {
  id?: string;
  provider_message_id?: string | null;
  sent_at?: string;
  session_id?: string;
  user_id?: string;
};

type SessionMemberActivityRow = {
  attendance_status: 'present' | 'absent' | 'late';
  participated_in_review: boolean;
  planned_next_session: boolean;
  session_id: string;
  updated_at: string;
  user_id: string;
};

type SessionMemberActivityInsert = {
  attendance_status?: 'present' | 'absent' | 'late';
  participated_in_review?: boolean;
  planned_next_session?: boolean;
  session_id: string;
  updated_at?: string;
  user_id: string;
};

type SessionMemberActivityUpdate = {
  attendance_status?: 'present' | 'absent' | 'late';
  participated_in_review?: boolean;
  planned_next_session?: boolean;
  session_id?: string;
  updated_at?: string;
  user_id?: string;
};

type SessionPeerFeedbackRow = {
  created_at: string;
  reviewer_user_id: string;
  session_id: string;
  subject_user_id: string;
  updated_at: string;
  will_study_again: boolean;
};

type SessionPeerFeedbackInsert = {
  created_at?: string;
  reviewer_user_id: string;
  session_id: string;
  subject_user_id: string;
  updated_at?: string;
  will_study_again: boolean;
};

type SessionPeerFeedbackUpdate = {
  created_at?: string;
  reviewer_user_id?: string;
  session_id?: string;
  subject_user_id?: string;
  updated_at?: string;
  will_study_again?: boolean;
};

type UsersRow = {
  avatar_url: string | null;
  billing_updated_at: string;
  created_at: string;
  display_name: string | null;
  email: string;
  exam_type: 'mccqe1' | 'usmle' | 'plab' | 'other' | null;
  exam_session:
    | 'april_may_2026'
    | 'august_september_2026'
    | 'october_2026'
    | 'planning_ahead'
    | null;
  has_valid_payment_method: boolean;
  id: string;
  locale: 'en' | 'fr';
  phone_number: string | null;
  question_banks: string[];
  questions_answered: number;
  stripe_customer_id: string | null;
  stripe_default_payment_method_id: string | null;
  subscription_current_period_ends_at: string | null;
  subscription_status:
    | 'none'
    | 'trialing'
    | 'active'
    | 'past_due'
    | 'canceled'
    | 'unpaid'
    | 'incomplete'
    | 'incomplete_expired'
    | 'paused';
  user_tier: 'trial' | 'locked' | 'active' | 'dormant';
};

type UsersInsert = {
  avatar_url?: string | null;
  billing_updated_at?: string;
  created_at?: string;
  display_name?: string | null;
  email: string;
  exam_type?: 'mccqe1' | 'usmle' | 'plab' | 'other' | null;
  exam_session?:
    | 'april_may_2026'
    | 'august_september_2026'
    | 'october_2026'
    | 'planning_ahead'
    | null;
  has_valid_payment_method?: boolean;
  id: string;
  locale?: 'en' | 'fr';
  phone_number?: string | null;
  question_banks?: string[];
  questions_answered?: number;
  stripe_customer_id?: string | null;
  stripe_default_payment_method_id?: string | null;
  subscription_current_period_ends_at?: string | null;
  subscription_status?:
    | 'none'
    | 'trialing'
    | 'active'
    | 'past_due'
    | 'canceled'
    | 'unpaid'
    | 'incomplete'
    | 'incomplete_expired'
    | 'paused';
  user_tier?: 'trial' | 'locked' | 'active' | 'dormant';
};

type UsersUpdate = {
  avatar_url?: string | null;
  billing_updated_at?: string;
  created_at?: string;
  display_name?: string | null;
  email?: string;
  exam_type?: 'mccqe1' | 'usmle' | 'plab' | 'other' | null;
  exam_session?:
    | 'april_may_2026'
    | 'august_september_2026'
    | 'october_2026'
    | 'planning_ahead'
    | null;
  has_valid_payment_method?: boolean;
  id?: string;
  locale?: 'en' | 'fr';
  phone_number?: string | null;
  question_banks?: string[];
  questions_answered?: number;
  stripe_customer_id?: string | null;
  stripe_default_payment_method_id?: string | null;
  subscription_current_period_ends_at?: string | null;
  subscription_status?:
    | 'none'
    | 'trialing'
    | 'active'
    | 'past_due'
    | 'canceled'
    | 'unpaid'
    | 'incomplete'
    | 'incomplete_expired'
    | 'paused';
  user_tier?: 'trial' | 'locked' | 'active' | 'dormant';
};

type UserSchedulesRow = {
  availability_grid: AvailabilityGrid;
  timezone: string;
  updated_at: string;
  user_id: string;
};

type UserSchedulesInsert = {
  availability_grid?: AvailabilityGrid;
  timezone?: string;
  updated_at?: string;
  user_id: string;
};

type UserSchedulesUpdate = {
  availability_grid?: AvailabilityGrid;
  timezone?: string;
  updated_at?: string;
  user_id?: string;
};

type DashboardSessionQuestionCountsViewRow = {
  question_count: number;
  session_id: string | null;
};

type DashboardUserSessionAnswerCountsViewRow = {
  answered_question_count: number;
  session_id: string | null;
  user_id: string | null;
};

type DashboardUserAnswerMetricsViewRow = {
  answered_count: number;
  average_confidence_score: number | null;
  correct_count: number;
  incorrect_count: number;
  user_id: string | null;
};

type DashboardUserAnswerDailyCountsViewRow = {
  answer_count: number;
  answered_on: string | null;
  user_id: string | null;
};

type DashboardUserProfileAnalyticsViewRow = {
  blueprint_grid: Json | null;
  confidence_calibration: Json | null;
  dimension_of_care_accuracy: Json | null;
  error_type_breakdown: Json | null;
  heatmap_data: Json | null;
  physician_activity_accuracy: Json | null;
  user_id: string | null;
  weekly_trend: Json | null;
};

type GroupSeatAvailabilityViewRow = {
  confirmed_member_count: number;
  group_id: string | null;
  max_members: number;
  seats_available: number;
};

type CandidateMatchingProfilesViewRow = {
  avatar_url: string | null;
  candidate_classification:
    | 'starting'
    | 'active'
    | 'reliable'
    | 'stable_priority'
    | null;
  completed_sessions: number | null;
  display_name: string | null;
  email: string;
  exam_session: UsersRow['exam_session'];
  exam_type: UsersRow['exam_type'];
  has_valid_payment_method: boolean | null;
  language: 'en' | 'fr' | null;
  next_sessions_planned: number | null;
  phone_number: string | null;
  positive_peer_votes: number | null;
  questions_completed: number | null;
  questions_reviewed: number | null;
  review_completed_sessions: number | null;
  sessions_joined: number | null;
  subscription_status: UsersRow['subscription_status'] | null;
  total_peer_votes: number | null;
  user_id: string;
  user_tier: UsersRow['user_tier'] | null;
};

export type Database = {
  public: {
    Tables: {
      answers: {
        Row: AnswersRow;
        Insert: AnswersInsert;
        Update: AnswersUpdate;
        Relationships: [];
      };
      app_logs: {
        Row: AppLogsRow;
        Insert: AppLogsInsert;
        Update: AppLogsUpdate;
        Relationships: [];
      };
      feature_flags: {
        Row: FeatureFlagsRow;
        Insert: FeatureFlagsInsert;
        Update: FeatureFlagsUpdate;
        Relationships: [];
      };
      password_setup_tokens: {
        Row: PasswordSetupTokensRow;
        Insert: PasswordSetupTokensInsert;
        Update: PasswordSetupTokensUpdate;
        Relationships: [];
      };
      landing_onboarding_tokens: {
        Row: LandingOnboardingTokensRow;
        Insert: LandingOnboardingTokensInsert;
        Update: LandingOnboardingTokensUpdate;
        Relationships: [];
      };
      group_members: {
        Row: GroupMembersRow;
        Insert: GroupMembersInsert;
        Update: GroupMembersUpdate;
        Relationships: [];
      };
      groups: {
        Row: GroupsRow;
        Insert: GroupsInsert;
        Update: GroupsUpdate;
        Relationships: [];
      };
      group_invites: {
        Row: GroupInvitesRow;
        Insert: GroupInvitesInsert;
        Update: GroupInvitesUpdate;
        Relationships: [];
      };
      invitations: {
        Row: InvitationsRow;
        Insert: InvitationsInsert;
        Update: InvitationsUpdate;
        Relationships: [];
      };
      group_weekly_schedules: {
        Row: GroupWeeklySchedulesRow;
        Insert: GroupWeeklySchedulesInsert;
        Update: GroupWeeklySchedulesUpdate;
        Relationships: [];
      };
      questions: {
        Row: QuestionsRow;
        Insert: QuestionsInsert;
        Update: QuestionsUpdate;
        Relationships: [];
      };
      question_classifications: {
        Row: QuestionClassificationsRow;
        Insert: QuestionClassificationsInsert;
        Update: QuestionClassificationsUpdate;
        Relationships: [];
      };
      personal_reflections: {
        Row: PersonalReflectionsRow;
        Insert: PersonalReflectionsInsert;
        Update: PersonalReflectionsUpdate;
        Relationships: [];
      };
      sessions: {
        Row: SessionsRow;
        Insert: SessionsInsert;
        Update: SessionsUpdate;
        Relationships: [];
      };
      session_state_events: {
        Row: SessionStateEventsRow;
        Insert: SessionStateEventsInsert;
        Update: SessionStateEventsUpdate;
        Relationships: [];
      };
      session_email_reminders: {
        Row: SessionEmailRemindersRow;
        Insert: SessionEmailRemindersInsert;
        Update: SessionEmailRemindersUpdate;
        Relationships: [];
      };
      session_calendar_invites: {
        Row: SessionCalendarInvitesRow;
        Insert: SessionCalendarInvitesInsert;
        Update: SessionCalendarInvitesUpdate;
        Relationships: [];
      };
      session_member_activity: {
        Row: SessionMemberActivityRow;
        Insert: SessionMemberActivityInsert;
        Update: SessionMemberActivityUpdate;
        Relationships: [];
      };
      session_peer_feedback: {
        Row: SessionPeerFeedbackRow;
        Insert: SessionPeerFeedbackInsert;
        Update: SessionPeerFeedbackUpdate;
        Relationships: [];
      };
      users: {
        Row: UsersRow;
        Insert: UsersInsert;
        Update: UsersUpdate;
        Relationships: [];
      };
      user_schedules: {
        Row: UserSchedulesRow;
        Insert: UserSchedulesInsert;
        Update: UserSchedulesUpdate;
        Relationships: [];
      };
    };
    Views: {
      candidate_matching_profiles: {
        Row: CandidateMatchingProfilesViewRow;
        Relationships: [];
      };
      dashboard_session_question_counts: {
        Row: DashboardSessionQuestionCountsViewRow;
        Relationships: [];
      };
      dashboard_user_answer_daily_counts: {
        Row: DashboardUserAnswerDailyCountsViewRow;
        Relationships: [];
      };
      dashboard_user_answer_metrics: {
        Row: DashboardUserAnswerMetricsViewRow;
        Relationships: [];
      };
      dashboard_user_profile_analytics: {
        Row: DashboardUserProfileAnalyticsViewRow;
        Relationships: [];
      };
      dashboard_user_session_answer_counts: {
        Row: DashboardUserSessionAnswerCountsViewRow;
        Relationships: [];
      };
      group_seat_availability: {
        Row: GroupSeatAvailabilityViewRow;
        Relationships: [];
      };
    };
    Functions: {
      activeboard_get_review_question_snapshot: {
        Args: {
          target_session_id: string;
          target_question_id: string;
        };
        Returns: {
          question: Json;
          distribution: Json;
          own_answer: Json;
          reviewed_question_count: number;
          review_version: number;
        }[];
      };
      activeboard_save_review_snapshot: {
        Args: {
          target_session_id: string;
          target_question_id: string;
          correct_option_input: string;
        };
        Returns: {
          question_id: string;
          correct_option: string;
          review_version: number;
          reviewed_question_count: number;
        }[];
      };
      activeboard_save_session_answer_concurrent: {
        Args: {
          target_question_id: string;
          selected_option_input: string;
          confidence_input: ConfidenceLevel | null;
          request_sequence_input: number;
          request_mode_input: 'submit' | 'timeout';
        };
        Returns: {
          applied: boolean;
          selected_option: string | null;
          confidence: ConfidenceLevel | null;
          request_sequence: number;
          request_mode: 'submit' | 'timeout';
        }[];
      };
      activeboard_transfer_session_captain: {
        Args: {
          target_session_id: string;
          expected_leader_id: string | null;
          target_user_id: string;
          allowed_statuses: string[];
        };
        Returns: {
          ok: boolean;
          message_key: string | null;
          group_id: string | null;
          previous_leader_id: string | null;
          current_leader_id: string | null;
          state_changed: boolean;
        }[];
      };
      find_group_by_invite_code: {
        Args: {
          target_invite_code: string;
        };
        Returns: {
          id: string;
          max_members: number;
          member_count: number;
        }[];
      };
      refresh_dashboard_user_profile_analytics: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
    };
  };
};
