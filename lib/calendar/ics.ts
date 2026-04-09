type BuildSessionIcsInput = {
  sessionId: string;
  sessionName: string;
  groupName: string;
  scheduledAt: string;
  durationMinutes: number;
  meetingLink: string | null;
  description?: string;
};

function formatUtcIcsDate(value: Date) {
  return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

export function buildSessionIcs({
  sessionId,
  sessionName,
  groupName,
  scheduledAt,
  durationMinutes,
  meetingLink,
  description,
}: BuildSessionIcsInput) {
  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const summary = sessionName || groupName;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ActiveBoard//Session Invite//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${sessionId}@activeboard`,
    `DTSTAMP:${formatUtcIcsDate(new Date())}`,
    `DTSTART:${formatUtcIcsDate(start)}`,
    `DTEND:${formatUtcIcsDate(end)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(description ?? '')}`,
    `LOCATION:${escapeIcsText(meetingLink ?? 'Bring your own meeting link')}`,
    meetingLink ? `URL:${escapeIcsText(meetingLink)}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return lines.join('\r\n');
}
