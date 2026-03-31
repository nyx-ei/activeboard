export const APP_EVENTS = {
  authCallbackSucceeded: 'auth_callback_succeeded',
  groupCreated: 'group_created',
  groupJoined: 'group_joined',
  groupInviteSent: 'group_invite_sent',
  groupInviteAccepted: 'group_invite_accepted',
  groupInviteDeclined: 'group_invite_declined',
  sessionJoinedByCode: 'session_joined_by_code',
  sessionScheduled: 'session_scheduled',
  sessionStarted: 'session_started',
  sessionEnded: 'session_ended',
  questionLaunched: 'question_launched',
  answerSubmitted: 'answer_submitted',
  answerRevealed: 'answer_revealed',
  leaderPassed: 'leader_passed',
} as const;

export type AppEventName = (typeof APP_EVENTS)[keyof typeof APP_EVENTS];
