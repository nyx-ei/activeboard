'use client';

import type { AppLocale } from '@/i18n/routing';
import { APP_EVENTS, type AppEventName } from '@/lib/logging/events';

type ClientLogMetadata = Record<string, string | number | boolean | null | undefined>;

const CLIENT_ALLOWED_EVENTS: AppEventName[] = [
  APP_EVENTS.pwaInstallPromptShown,
  APP_EVENTS.pwaInstallAccepted,
  APP_EVENTS.pwaLaunchedFromHomeScreen,
];

export async function postClientAppEvent(eventName: AppEventName, locale: AppLocale, metadata?: ClientLogMetadata) {
  if (!CLIENT_ALLOWED_EVENTS.includes(eventName)) {
    return;
  }

  try {
    await fetch('/api/app-events', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        eventName,
        locale,
        metadata,
      }),
      keepalive: true,
    });
  } catch {
    // Silent by design: monitoring should never block product flows.
  }
}
