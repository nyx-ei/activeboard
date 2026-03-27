export type Locale = 'en' | 'fr';

export type GroupRole = 'admin' | 'member';

export type GroupInviteStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export type SessionStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';

export type QuestionPhase = 'draft' | 'answering' | 'review' | 'closed';

export type AnswerOption = 'A' | 'B' | 'C' | 'D' | 'E';

export const ANSWER_OPTIONS: AnswerOption[] = ['A', 'B', 'C', 'D', 'E'];

