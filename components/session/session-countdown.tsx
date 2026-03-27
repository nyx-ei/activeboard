'use client';

import { useEffect, useState } from 'react';

import { formatCountdown } from '@/lib/utils';

type SessionCountdownProps = {
  initialSeconds: number;
};

export function SessionCountdown({ initialSeconds }: SessionCountdownProps) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (seconds <= 0) {
      return undefined;
    }

    const id = window.setInterval(() => {
      setSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(id);
  }, [seconds]);

  return <>{formatCountdown(seconds)}</>;
}
