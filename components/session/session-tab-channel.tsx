'use client';

import { useEffect } from 'react';

const SESSION_TAB_CHANNEL = 'activeboard:session-tabs';
const SESSION_TAB_RESPONSE_TIMEOUT_MS = 140;

type SessionTabMessage =
  | {
      type: 'focus-session';
      requestId: string;
      sessionId: string;
    }
  | {
      type: 'session-present';
      requestId: string;
      sessionId: string;
    };

export function SessionTabPresence({ sessionId }: { sessionId: string }) {
  useEffect(() => {
    if (!('BroadcastChannel' in window)) {
      return;
    }

    const channel = new BroadcastChannel(SESSION_TAB_CHANNEL);

    channel.onmessage = (event: MessageEvent<SessionTabMessage>) => {
      const message = event.data;
      if (
        message?.type !== 'focus-session' ||
        message.sessionId !== sessionId
      ) {
        return;
      }

      window.focus();
      channel.postMessage({
        type: 'session-present',
        requestId: message.requestId,
        sessionId,
      } satisfies SessionTabMessage);
    };

    return () => {
      channel.close();
    };
  }, [sessionId]);

  return null;
}

export async function openSessionInManagedTab(sessionId: string, href: string) {
  const targetHref = normalizeSessionHref(href);

  const hasOpenSession = await requestExistingSessionTab(sessionId);
  if (!hasOpenSession) {
    window.open(targetHref, '_blank', 'noopener,noreferrer');
  }
}

export async function openSessionInManagedPreparedTab(
  sessionId: string,
  href: string,
  preparedTab: Window | null,
) {
  const hasOpenSession = await requestExistingSessionTab(sessionId);
  if (hasOpenSession) {
    preparedTab?.close();
    return;
  }

  openSessionInPreparedTab(preparedTab, href);
}

async function requestExistingSessionTab(sessionId: string) {
  if (!('BroadcastChannel' in window)) {
    return false;
  }

  const channel = new BroadcastChannel(SESSION_TAB_CHANNEL);
  const requestId = `${sessionId}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;

  const hasOpenSession = await new Promise<boolean>((resolve) => {
    const timeoutId = window.setTimeout(
      () => resolve(false),
      SESSION_TAB_RESPONSE_TIMEOUT_MS,
    );

    channel.onmessage = (event: MessageEvent<SessionTabMessage>) => {
      const message = event.data;
      if (
        message?.type === 'session-present' &&
        message.requestId === requestId &&
        message.sessionId === sessionId
      ) {
        window.clearTimeout(timeoutId);
        resolve(true);
      }
    };

    channel.postMessage({
      type: 'focus-session',
      requestId,
      sessionId,
    } satisfies SessionTabMessage);
  });

  channel.close();

  return hasOpenSession;
}

export function openSessionInPreparedTab(
  preparedTab: Window | null,
  href: string,
) {
  const targetHref = normalizeSessionHref(href);

  if (preparedTab && !preparedTab.closed) {
    preparedTab.location.href = targetHref;
    preparedTab.focus();
    return true;
  }

  window.open(targetHref, '_blank', 'noopener,noreferrer');
  return false;
}

function normalizeSessionHref(href: string) {
  if (href.startsWith('http')) {
    return href;
  }

  return `${window.location.origin}${href}`;
}
