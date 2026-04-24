'use client';

import type { RealtimeChannel } from '@supabase/supabase-js';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type RealtimeTable = {
  table: string;
  filter?: string;
};

type RealtimeCallback = () => void;

type RegistryEntry = {
  channel: RealtimeChannel;
  subscribers: number;
  callbacks: Set<RealtimeCallback>;
};

const realtimeRegistry = new Map<string, RegistryEntry>();

function logRealtime(event: string, metadata: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.info('[realtime]', event, metadata);
}

function getRegistryKey(channelName: string, tables: RealtimeTable[]) {
  return JSON.stringify({
    channelName,
    tables: tables.map((table) => ({
      table: table.table,
      filter: table.filter ?? null,
    })),
  });
}

function wireChannelSubscriptions(channel: RealtimeChannel, tables: RealtimeTable[], notify: () => void) {
  for (const table of tables) {
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: table.table,
        filter: table.filter,
      },
      notify,
    );
  }
}

export function registerRealtimeSubscription({
  supabase,
  channelName,
  tables,
  onEvent,
}: {
  supabase: ReturnType<typeof createSupabaseBrowserClient>;
  channelName: string;
  tables: RealtimeTable[];
  onEvent: RealtimeCallback;
}) {
  const registryKey = getRegistryKey(channelName, tables);
  const existingEntry = realtimeRegistry.get(registryKey);

  if (existingEntry) {
    existingEntry.subscribers += 1;
    existingEntry.callbacks.add(onEvent);
    logRealtime('subscription_reused', {
      channelName,
      registryKey,
      subscribers: existingEntry.subscribers,
    });

    return async () => {
      existingEntry.callbacks.delete(onEvent);
      existingEntry.subscribers -= 1;

      logRealtime('subscription_released', {
        channelName,
        registryKey,
        subscribers: existingEntry.subscribers,
      });

      if (existingEntry.subscribers <= 0) {
        realtimeRegistry.delete(registryKey);
        await supabase.removeChannel(existingEntry.channel);
        logRealtime('channel_removed', { channelName, registryKey });
      }
    };
  }

  const callbacks = new Set<RealtimeCallback>([onEvent]);
  const notify = () => {
    for (const callback of callbacks) {
      callback();
    }
  };

  const channel = supabase.channel(channelName);
  wireChannelSubscriptions(channel, tables, notify);

  channel.subscribe((status) => {
    logRealtime('channel_status', {
      channelName,
      registryKey,
      status,
    });
  });

  realtimeRegistry.set(registryKey, {
    channel,
    subscribers: 1,
    callbacks,
  });

  logRealtime('channel_created', {
    channelName,
    registryKey,
    tables: tables.map((table) => ({ table: table.table, filter: table.filter ?? null })),
  });

  return async () => {
    const entry = realtimeRegistry.get(registryKey);
    if (!entry) {
      return;
    }

    entry.callbacks.delete(onEvent);
    entry.subscribers -= 1;

    logRealtime('subscription_released', {
      channelName,
      registryKey,
      subscribers: entry.subscribers,
    });

    if (entry.subscribers <= 0) {
      realtimeRegistry.delete(registryKey);
      await supabase.removeChannel(entry.channel);
      logRealtime('channel_removed', { channelName, registryKey });
    }
  };
}
