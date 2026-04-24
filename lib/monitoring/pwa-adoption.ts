import { isFeatureEnabled } from '@/lib/features/flags';
import { APP_EVENTS } from '@/lib/logging/events';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Json } from '@/lib/supabase/types';

type AppLogRow = {
  event_name: string;
  user_id: string | null;
  metadata: Json;
};

export type PwaAdoptionReport = {
  windowDays: number;
  loggingEnabled: boolean;
  pwaFunnel: {
    promptShownEvents: number;
    promptShownUsers: number;
    installAcceptedEvents: number;
    installAcceptedUsers: number;
    homeScreenLaunchEvents: number;
    homeScreenLaunchUsers: number;
  };
  sessionDeviceSplit: Array<{
    deviceType: string;
    eventCount: number;
    userCount: number;
  }>;
};

const PWA_EVENTS = [
  APP_EVENTS.pwaInstallPromptShown,
  APP_EVENTS.pwaInstallAccepted,
  APP_EVENTS.pwaLaunchedFromHomeScreen,
] as const;

const SESSION_EVENTS = [
  APP_EVENTS.sessionJoinedByCode,
  APP_EVENTS.sessionStarted,
  APP_EVENTS.questionLaunched,
  APP_EVENTS.answerSubmitted,
  APP_EVENTS.answerRevealed,
  APP_EVENTS.sessionEnded,
] as const;

function readDeviceType(metadata: Json) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return 'unknown';
  }

  const value = metadata.device_type;
  return typeof value === 'string' && value ? value : 'unknown';
}

export async function getPwaAdoptionReport(windowDays = 30): Promise<PwaAdoptionReport> {
  const loggingEnabled = await isFeatureEnabled('canUseUbiquitousLogging');

  if (!loggingEnabled) {
    return {
      windowDays,
      loggingEnabled,
      pwaFunnel: {
        promptShownEvents: 0,
        promptShownUsers: 0,
        installAcceptedEvents: 0,
        installAcceptedUsers: 0,
        homeScreenLaunchEvents: 0,
        homeScreenLaunchUsers: 0,
      },
      sessionDeviceSplit: [],
    };
  }

  const admin = createSupabaseAdminClient();
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .schema('public')
    .from('app_logs')
    .select('event_name, user_id, metadata')
    .in('event_name', [...PWA_EVENTS, ...SESSION_EVENTS])
    .gte('created_at', since)
    .returns<AppLogRow[]>();

  const logs = data ?? [];
  const pwaLogs = logs.filter((log) => PWA_EVENTS.includes(log.event_name as (typeof PWA_EVENTS)[number]));
  const sessionLogs = logs.filter((log) => SESSION_EVENTS.includes(log.event_name as (typeof SESSION_EVENTS)[number]));

  const promptShown = pwaLogs.filter((log) => log.event_name === APP_EVENTS.pwaInstallPromptShown);
  const installAccepted = pwaLogs.filter((log) => log.event_name === APP_EVENTS.pwaInstallAccepted);
  const homeScreenLaunch = pwaLogs.filter((log) => log.event_name === APP_EVENTS.pwaLaunchedFromHomeScreen);

  const sessionDeviceBuckets = new Map<string, { eventCount: number; users: Set<string> }>();

  for (const log of sessionLogs) {
    const deviceType = readDeviceType(log.metadata);
    const bucket = sessionDeviceBuckets.get(deviceType) ?? { eventCount: 0, users: new Set<string>() };
    bucket.eventCount += 1;
    if (log.user_id) {
      bucket.users.add(log.user_id);
    }
    sessionDeviceBuckets.set(deviceType, bucket);
  }

  return {
    windowDays,
    loggingEnabled,
    pwaFunnel: {
      promptShownEvents: promptShown.length,
      promptShownUsers: new Set(promptShown.map((log) => log.user_id).filter(Boolean)).size,
      installAcceptedEvents: installAccepted.length,
      installAcceptedUsers: new Set(installAccepted.map((log) => log.user_id).filter(Boolean)).size,
      homeScreenLaunchEvents: homeScreenLaunch.length,
      homeScreenLaunchUsers: new Set(homeScreenLaunch.map((log) => log.user_id).filter(Boolean)).size,
    },
    sessionDeviceSplit: [...sessionDeviceBuckets.entries()]
      .map(([deviceType, bucket]) => ({
        deviceType,
        eventCount: bucket.eventCount,
        userCount: bucket.users.size,
      }))
      .sort((left, right) => right.eventCount - left.eventCount),
  };
}
