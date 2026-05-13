import { expect, type Page } from '@playwright/test';

export const QA_PASSWORD = process.env.E2E_QA_PASSWORD ?? 'TestActiveboard123!';

export const QA_USERS = {
  captain: {
    email: process.env.E2E_QA_CAPTAIN_EMAIL ?? 'qa.captain1@activeboard.local',
    password: QA_PASSWORD,
    locale: process.env.E2E_LOCALE ?? 'fr',
  },
  member2: {
    email: process.env.E2E_QA_MEMBER2_EMAIL ?? 'qa.member2@activeboard.local',
    password: QA_PASSWORD,
    locale: process.env.E2E_LOCALE ?? 'fr',
  },
  member3: {
    email: process.env.E2E_QA_MEMBER3_EMAIL ?? 'qa.member3@activeboard.local',
    password: QA_PASSWORD,
    locale: process.env.E2E_LOCALE ?? 'fr',
  },
  member4: {
    email: process.env.E2E_QA_MEMBER4_EMAIL ?? 'qa.member4@activeboard.local',
    password: QA_PASSWORD,
    locale: process.env.E2E_LOCALE ?? 'fr',
  },
  observer: {
    email:
      process.env.E2E_QA_OBSERVER_EMAIL ?? 'qa.observer5@activeboard.local',
    password: QA_PASSWORD,
    locale: process.env.E2E_LOCALE ?? 'fr',
  },
} as const;

export const QA_GROUPS = {
  main: {
    name: 'QA Test - Main Group',
    inviteCode: 'QAG001',
  },
  side: {
    name: 'QA Test - Side Group',
    inviteCode: 'QAG002',
  },
} as const;

export const QA_SESSIONS = {
  scheduledMain: {
    name: 'QA Scheduled Session',
    shareCode: 'QAS001',
  },
  activeMain: {
    name: 'QA Active Session',
    shareCode: 'QAA002',
  },
  completedMain: {
    name: 'QA Completed Session',
    shareCode: 'QAC003',
  },
  scheduledSide: {
    name: 'QA Side Session',
    shareCode: 'QAS004',
  },
} as const;

export type QaUser = (typeof QA_USERS)[keyof typeof QA_USERS];

export async function loginAs(page: Page, user: QaUser = QA_USERS.captain) {
  await page.goto(`/${user.locale}/auth/login`);
  await page.getByLabel(/email|courriel/i).fill(user.email);
  await page.getByLabel(/password|mot de passe/i).fill(user.password);
  await page.getByRole('button', { name: /sign in|se connecter/i }).click();
  await expect(page).toHaveURL(new RegExp(`/${user.locale}/dashboard`), {
    timeout: 20_000,
  });
}

export async function expectNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth > root.clientWidth + 1;
  });

  expect(hasOverflow).toBe(false);
}

export async function openDashboardView(
  page: Page,
  view: 'sessions' | 'performance' | 'groups',
  locale = QA_USERS.captain.locale,
) {
  if (view === 'groups') {
    await page.goto(`/${locale}/groups`);
    await expect(page).toHaveURL(new RegExp(`/${locale}/groups`));
    return;
  }

  await page.goto(`/${locale}/dashboard?view=${view}`);
  await expect(page).toHaveURL(
    new RegExp(`/${locale}/dashboard.*view=${view}`),
  );
}
