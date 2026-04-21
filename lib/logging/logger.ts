import { headers } from 'next/headers';

import type { AppLocale } from '@/i18n/routing';
import { isFeatureEnabled, type FeatureFlagKey } from '@/lib/features/flags';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/types';

type LogLevel = 'info' | 'warn' | 'error';

type LogMetadata = Record<string, Json | undefined>;

type LogAppEventInput = {
  eventName: string;
  level?: LogLevel;
  locale?: AppLocale | null;
  userId?: string | null;
  groupId?: string | null;
  sessionId?: string | null;
  metadata?: LogMetadata;
  flagKey?: FeatureFlagKey;
  useAdmin?: boolean;
};

function sanitizeMetadata(metadata: LogMetadata | undefined): Json {
  if (!metadata) {
    return {};
  }

  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
}

function detectDeviceType(userAgent: string) {
  const normalized = userAgent.toLowerCase();

  if (!normalized) return 'unknown';
  if (/(bot|crawler|spider|preview)/i.test(userAgent)) return 'bot';
  if (/(ipad|tablet|kindle|playbook|silk)/i.test(userAgent)) return 'tablet';
  if (/(mobi|iphone|ipod|android)/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

function detectPlatform(userAgent: string) {
  const normalized = userAgent.toLowerCase();

  if (!normalized) return 'unknown';
  if (normalized.includes('iphone') || normalized.includes('ipad') || normalized.includes('ios')) return 'ios';
  if (normalized.includes('android')) return 'android';
  if (normalized.includes('mac os x') || normalized.includes('macintosh')) return 'macos';
  if (normalized.includes('windows')) return 'windows';
  if (normalized.includes('linux')) return 'linux';
  return 'other';
}

function detectBrowser(userAgent: string) {
  const normalized = userAgent.toLowerCase();

  if (!normalized) return 'unknown';
  if (normalized.includes('edg/')) return 'edge';
  if (normalized.includes('chrome/') && !normalized.includes('edg/')) return 'chrome';
  if (normalized.includes('safari/') && !normalized.includes('chrome/')) return 'safari';
  if (normalized.includes('firefox/')) return 'firefox';
  return 'other';
}

function getRequestMetadata(): LogMetadata {
  try {
    const headerStore = headers();
    const userAgent = headerStore.get('user-agent') ?? '';

    return {
      device_type: detectDeviceType(userAgent),
      platform: detectPlatform(userAgent),
      browser: detectBrowser(userAgent),
    };
  } catch {
    return {};
  }
}

export async function logAppEvent({
  eventName,
  level = 'info',
  locale = null,
  userId = null,
  groupId = null,
  sessionId = null,
  metadata,
  flagKey = 'canUseUbiquitousLogging',
  useAdmin = false,
}: LogAppEventInput) {
  const isEnabled = await isFeatureEnabled(flagKey);

  if (!isEnabled) {
    return;
  }

  const supabase = useAdmin ? createSupabaseAdminClient() : createSupabaseServerClient();
  const requestMetadata = getRequestMetadata();
  const { error } = await supabase.schema('public').from('app_logs').insert({
    event_name: eventName,
    level,
    feature_flag_key: flagKey,
    locale,
    user_id: userId,
    group_id: groupId,
    session_id: sessionId,
    metadata: sanitizeMetadata({ ...requestMetadata, ...metadata }),
  });

  if (error && process.env.NODE_ENV !== 'production') {
    console.error('[app_logs] failed to persist log event', {
      eventName,
      error: error.message,
    });
  }
}
