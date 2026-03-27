export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(safeSeconds % 60)
    .toString()
    .padStart(2, '0');

  return `${minutes}:${seconds}`;
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function generateInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

export function withFeedback(path: string, tone: 'success' | 'error', message: string) {
  const url = new URL(path, 'http://localhost');
  url.searchParams.set('feedbackTone', tone);
  url.searchParams.set('feedbackMessage', message);

  return `${url.pathname}?${url.searchParams.toString()}`;
}
