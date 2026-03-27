export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type AnswersRow = {
  answered_at: string;
  confidence: number | null;
  id: string;
  is_correct: boolean | null;
  question_id: string;
  selected_option: string | null;
  user_id: string;
};

type AnswersInsert = {
  answered_at?: string;
  confidence?: number | null;
  id?: string;
  is_correct?: boolean | null;
  question_id: string;
  selected_option?: string | null;
  user_id: string;
};

type AnswersUpdate = {
  answered_at?: string;
  confidence?: number | null;
  id?: string;
  is_correct?: boolean | null;
  question_id?: string;
  selected_option?: string | null;
  user_id?: string;
};

type GroupMembersRow = {
  group_id: string;
  joined_at: string;
  role: 'admin' | 'member';
  user_id: string;
};

type GroupMembersInsert = {
  group_id: string;
  joined_at?: string;
  role?: 'admin' | 'member';
  user_id: string;
};

type GroupMembersUpdate = {
  group_id?: string;
  joined_at?: string;
  role?: 'admin' | 'member';
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

type SessionsRow = {
  created_by: string | null;
  ended_at: string | null;
  group_id: string;
  id: string;
  leader_id: string | null;
  meeting_link: string | null;
  scheduled_at: string;
  started_at: string | null;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  timer_seconds: number;
};

type SessionsInsert = {
  created_by?: string | null;
  ended_at?: string | null;
  group_id: string;
  id?: string;
  leader_id?: string | null;
  meeting_link?: string | null;
  scheduled_at: string;
  started_at?: string | null;
  status?: 'scheduled' | 'active' | 'completed' | 'cancelled';
  timer_seconds?: number;
};

type SessionsUpdate = {
  created_by?: string | null;
  ended_at?: string | null;
  group_id?: string;
  id?: string;
  leader_id?: string | null;
  meeting_link?: string | null;
  scheduled_at?: string;
  started_at?: string | null;
  status?: 'scheduled' | 'active' | 'completed' | 'cancelled';
  timer_seconds?: number;
};

type UsersRow = {
  avatar_url: string | null;
  created_at: string;
  display_name: string | null;
  email: string;
  id: string;
  locale: 'en' | 'fr';
};

type UsersInsert = {
  avatar_url?: string | null;
  created_at?: string;
  display_name?: string | null;
  email: string;
  id: string;
  locale?: 'en' | 'fr';
};

type UsersUpdate = {
  avatar_url?: string | null;
  created_at?: string;
  display_name?: string | null;
  email?: string;
  id?: string;
  locale?: 'en' | 'fr';
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
      questions: {
        Row: QuestionsRow;
        Insert: QuestionsInsert;
        Update: QuestionsUpdate;
        Relationships: [];
      };
      sessions: {
        Row: SessionsRow;
        Insert: SessionsInsert;
        Update: SessionsUpdate;
        Relationships: [];
      };
      users: {
        Row: UsersRow;
        Insert: UsersInsert;
        Update: UsersUpdate;
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
