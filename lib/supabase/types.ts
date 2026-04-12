import type { ConfidenceLevel } from '@/lib/demo/confidence';
import type { AvailabilityGrid } from '@/lib/schedule/availability';
import type { DimensionOfCare, ErrorType, PhysicianActivity } from '@/lib/types/demo';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type AnswersRow = {
  answered_at: string;
  confidence: ConfidenceLevel | null;
  id: string;
  is_correct: boolean | null;
  question_id: string;
  selected_option: string | null;
  user_id: string;
};

type AnswersInsert = {
  answered_at?: string;
  confidence?: ConfidenceLevel | null;
  id?: string;
  is_correct?: boolean | null;
  question_id: string;
  selected_option?: string | null;
  user_id: string;
};

type AnswersUpdate = {
  answered_at?: string;
  confidence?: ConfidenceLevel | null;
  id?: string;
  is_correct?: boolean | null;
  question_id?: string;
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

type GroupMembersRow = {
  group_id: string;
  is_founder: boolean;
  joined_at: string;
  user_id: string;
};

type GroupMembersInsert = {
  group_id: string;
  is_founder?: boolean;
  joined_at?: string;
  user_id: string;
};

type GroupMembersUpdate = {
  group_id?: string;
  is_founder?: boolean;
  joined_at?: string;
  user_id?: string;
};

type GroupsRow = {
  created_at: string;
  created_by: string | null;
  id: string;
  invite_code: string;
  max_members: number;
  name: string;
};

type GroupsInsert = {
  created_at?: string;
  created_by?: string | null;
  id?: string;
  invite_code: string;
  max_members?: number;
  name: string;
};

type GroupsUpdate = {
  created_at?: string;
  created_by?: string | null;
  id?: string;
  invite_code?: string;
  max_members?: number;
  name?: string;
};

type GroupInvitesRow = {
  created_at: string;
  group_id: string;
  id: string;
  invited_by: string;
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
  invitee_email?: string;
  invitee_user_id?: string | null;
  responded_at?: string | null;
  status?: 'pending' | 'accepted' | 'declined' | 'cancelled';
};

type GroupWeeklySchedulesRow = {
  created_at: string;
  end_time: string;
  group_id: string;
  id: string;
  question_goal: number;
  start_time: string;
  weekday: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
};

type GroupWeeklySchedulesInsert = {
  created_at?: string;
  end_time: string;
  group_id: string;
  id?: string;
  question_goal?: number;
  start_time: string;
  weekday: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
};

type GroupWeeklySchedulesUpdate = {
  created_at?: string;
  end_time?: string;
  group_id?: string;
  id?: string;
  question_goal?: number;
  start_time?: string;
  weekday?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
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
  question_goal: number;
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
  question_goal?: number;
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
  question_goal?: number;
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

type UsersRow = {
  avatar_url: string | null;
  billing_updated_at: string;
  created_at: string;
  display_name: string | null;
  email: string;
  exam_session: 'april_may_2026' | 'august_september_2026' | 'october_2026' | 'planning_ahead' | null;
  has_valid_payment_method: boolean;
  id: string;
  locale: 'en' | 'fr';
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
  exam_session?: 'april_may_2026' | 'august_september_2026' | 'october_2026' | 'planning_ahead' | null;
  has_valid_payment_method?: boolean;
  id: string;
  locale?: 'en' | 'fr';
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
  exam_session?: 'april_may_2026' | 'august_september_2026' | 'october_2026' | 'planning_ahead' | null;
  has_valid_payment_method?: boolean;
  id?: string;
  locale?: 'en' | 'fr';
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
    Views: Record<string, never>;
    Functions: {
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
    };
  };
};
