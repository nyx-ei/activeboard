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
  const { error } = await supabase.schema('public').from('app_logs').insert({
    event_name: eventName,
    level,
    feature_flag_key: flagKey,
    locale,
    user_id: userId,
    group_id: groupId,
    session_id: sessionId,
    metadata: sanitizeMetadata(metadata),
  });

  if (error && process.env.NODE_ENV !== 'production') {
    console.error('[app_logs] failed to persist log event', {
      eventName,
      error: error.message,
    });
  }
}
