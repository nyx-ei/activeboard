import { NextResponse } from 'next/server';

import { getEmailServerEnv, hasEmailEnv } from '@/lib/env';
import { dispatchDueSessionReminders } from '@/lib/notifications/session-reminders';

export const runtime = 'nodejs';

function isAuthorized(request: Request) {
  const vercelCronHeader = request.headers.get('x-vercel-cron');
  if (vercelCronHeader) {
    return true;
  }

  const { sessionReminderCronSecret } = getEmailServerEnv();
  if (!sessionReminderCronSecret) {
    return false;
  }

  const authorization = request.headers.get('authorization');
  return authorization === `Bearer ${sessionReminderCronSecret}`;
}

async function runDispatch(request: Request) {
  if (!hasEmailEnv()) {
    return NextResponse.json({ error: 'Email reminders are not configured.' }, { status: 500 });
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const result = await dispatchDueSessionReminders();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Reminder dispatch failed.',
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return runDispatch(request);
}

export async function POST(request: Request) {
  return runDispatch(request);
}
