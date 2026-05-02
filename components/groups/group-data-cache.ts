'use client';

type CacheEntry = {
  promise?: Promise<unknown>;
  payload?: unknown;
  expiresAt: number;
};

const GROUP_DATA_TTL_MS = 5_000;
const groupDataCache = new Map<string, CacheEntry>();
const activeGroupControllers = new Set<AbortController>();

function isSessionFlowActive() {
  if (typeof window === 'undefined') {
    return false;
  }

  return (
    window.sessionStorage.getItem('activeboard:session-flow-active') === '1' ||
    window.location.pathname.includes('/sessions/')
  );
}

if (typeof window !== 'undefined') {
  window.addEventListener('activeboard:session-flow-started', () => {
    for (const controller of activeGroupControllers) {
      controller.abort();
    }
    activeGroupControllers.clear();
    for (const entry of groupDataCache.values()) {
      entry.promise = undefined;
    }
  });
}

export function fetchCachedGroupData<TPayload>(url: string) {
  if (isSessionFlowActive()) {
    return Promise.resolve(null as TPayload);
  }

  const now = Date.now();
  const entry = groupDataCache.get(url);

  if (entry?.payload && entry.expiresAt > now) {
    return Promise.resolve(entry.payload as TPayload);
  }

  if (entry?.promise) {
    return entry.promise as Promise<TPayload>;
  }

  const nextEntry: CacheEntry = {
    expiresAt: 0,
  };
  const controller = new AbortController();
  activeGroupControllers.add(controller);
  const promise = fetch(url, {
    credentials: 'include',
    cache: 'no-store',
    signal: controller.signal,
  })
    .then((response) => {
      if (isSessionFlowActive()) {
        return null;
      }

      return response;
    })
    .then((response) => {
      if (!response) {
        return null;
      }

      return response.json();
    })
    .then((payload) => {
      if (!payload) {
        return null as TPayload;
      }

      nextEntry.payload = payload;
      nextEntry.expiresAt = Date.now() + GROUP_DATA_TTL_MS;
      return payload as TPayload;
    })
    .finally(() => {
      activeGroupControllers.delete(controller);
      nextEntry.promise = undefined;
    });

  nextEntry.promise = promise;
  groupDataCache.set(url, nextEntry);
  return promise;
}

export function prefetchGroupData(groupId: string, locale: string) {
  if (!groupId) {
    return;
  }

  void fetchCachedGroupData(`/api/groups/shell?locale=${locale}`);
  void fetchCachedGroupData(
    `/api/groups/member-performance?groupId=${groupId}`,
  );
  void fetchCachedGroupData(`/api/groups/weekly-progress?groupId=${groupId}`);
}

export function prefetchGroupShell(locale: string) {
  void fetchCachedGroupData(`/api/groups/shell?locale=${locale}`);
}
