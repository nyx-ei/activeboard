'use client';

type RuntimePayload = {
  ok: boolean;
  sessionStatus: string;
  questionId: string | null;
  questionPhase: string | null;
  answerDeadlineAt?: string | null;
  submittedCount?: number;
  memberCount?: number;
};

const inflightRuntimeRequests = new Map<string, Promise<RuntimePayload | null>>();
const recentRuntimeResponses = new Map<string, { payload: RuntimePayload; expiresAt: number }>();
const RECENT_RESPONSE_TTL_MS = 500;

export async function fetchSessionRuntime(url: string): Promise<RuntimePayload | null> {
  const now = Date.now();
  const cached = recentRuntimeResponses.get(url);
  if (cached && cached.expiresAt > now) {
    return cached.payload;
  }

  const existing = inflightRuntimeRequests.get(url);
  if (existing) {
    return existing;
  }

  const request = fetch(url, {
    cache: 'no-store',
    credentials: 'same-origin',
  })
    .then(async (response) => {
      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as RuntimePayload;
      recentRuntimeResponses.set(url, {
        payload,
        expiresAt: Date.now() + RECENT_RESPONSE_TTL_MS,
      });
      return payload;
    })
    .catch(() => null)
    .finally(() => {
      inflightRuntimeRequests.delete(url);
    });

  inflightRuntimeRequests.set(url, request);
  return request;
}
