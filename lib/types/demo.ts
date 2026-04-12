export type Locale = 'en' | 'fr';

export type GroupMembershipKind = 'founder' | 'member';

export type GroupInviteStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export type SessionStatus = 'scheduled' | 'active' | 'incomplete' | 'completed' | 'cancelled';

export type QuestionPhase = 'draft' | 'answering' | 'review' | 'closed';

export type AnswerOption = 'A' | 'B' | 'C' | 'D' | 'E';

export const ANSWER_OPTIONS: AnswerOption[] = ['A', 'B', 'C', 'D', 'E'];

export type PhysicianActivity =
  | 'history_taking'
  | 'physical_exam'
  | 'investigation'
  | 'management'
  | 'communication'
  | 'ethics';

export type DimensionOfCare =
  | 'diagnosis'
  | 'acute_care'
  | 'chronic_care'
  | 'prevention'
  | 'follow_up'
  | 'professionalism';

export type ErrorType =
  | 'knowledge_gap'
  | 'misread_question'
  | 'premature_closure'
  | 'confidence_mismatch'
  | 'time_pressure'
  | 'careless_mistake';

export const PHYSICIAN_ACTIVITY_OPTIONS: PhysicianActivity[] = [
  'history_taking',
  'physical_exam',
  'investigation',
  'management',
  'communication',
  'ethics',
];

export const DIMENSION_OF_CARE_OPTIONS: DimensionOfCare[] = [
  'diagnosis',
  'acute_care',
  'chronic_care',
  'prevention',
  'follow_up',
  'professionalism',
];

export const ERROR_TYPE_OPTIONS: ErrorType[] = [
  'knowledge_gap',
  'misread_question',
  'premature_closure',
  'confidence_mismatch',
  'time_pressure',
  'careless_mistake',
];

