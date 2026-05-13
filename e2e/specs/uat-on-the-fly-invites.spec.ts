import { expect, test, type Page } from '@playwright/test';

import {
  expectNoHorizontalOverflow,
  loginAs,
  openDashboardView,
  QA_SESSIONS,
  QA_USERS,
} from '../fixtures/qa';

type InviteResponse = {
  status: number;
  body: {
    ok?: boolean;
    reason?: string;
    inviteId?: string | null;
    alreadyMember?: boolean;
    emailDeliveryFailed?: boolean;
    invitedDuringSessionId?: string | null;
  } | null;
};

async function openActiveSession(page: Page) {
  await openDashboardView(page, 'sessions');

  const sessionCard = page
    .getByRole('button', { name: new RegExp(QA_SESSIONS.activeMain.name, 'i') })
    .first();

  await expect(sessionCard).toBeVisible({ timeout: 20_000 });
  await sessionCard.click();

  await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]+/, {
    timeout: 20_000,
  });
}

async function postSessionInvite(page: Page, email: string) {
  return page.evaluate(async (inviteeEmail) => {
    const match = window.location.pathname.match(/\/sessions\/([^/?#]+)/);
    if (!match?.[1]) {
      throw new Error('Session id not found in current URL.');
    }

    const response = await fetch(`/api/sessions/${match[1]}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify({ email: inviteeEmail, locale: 'fr' }),
    });

    const body = await response.json().catch(() => null);
    return { status: response.status, body };
  }, email) as Promise<InviteResponse>;
}

function uniqueInviteEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`;
}

test.describe('UAT on-the-fly invites D14', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      process.env.E2E_RESET_QA_SESSIONS !== '1',
      'Requires resettable QA session fixtures. Run with E2E_RESET_QA_SESSIONS=1.',
    );
  });

  test('OTF-1.1 / OTF-1.2 active group member sees enabled invite affordance with required email dialog', async ({
    page,
  }) => {
    await loginAs(page, QA_USERS.member4);
    await openActiveSession(page);

    const inviteButton = page.getByRole('button', {
      name: /inviter un co|invite a teammate/i,
    });
    await expect(inviteButton).toBeVisible();
    await expect(inviteButton).toBeEnabled();

    await inviteButton.click();

    await expect(
      page.getByRole('heading', { name: /inviter un co|invite a teammate/i }),
    ).toBeVisible();

    const emailInput = page.getByPlaceholder(
      /email@exemple\.com|email@example\.com/i,
    );
    await expect(emailInput).toBeVisible();
    await expect(
      emailInput.evaluate((input) => (input as HTMLInputElement).required),
    ).resolves.toBe(true);

    await expectNoHorizontalOverflow(page);
  });

  test('OTF-1.4 already-present group member invite is a clean idempotent no-op', async ({
    page,
  }) => {
    await loginAs(page, QA_USERS.member4);
    await openActiveSession(page);

    const response = await postSessionInvite(page, QA_USERS.member2.email);

    expect(response.status).toBe(200);
    expect(response.body?.ok).toBe(true);
    expect(response.body?.alreadyMember).toBe(true);
    expect(response.body?.inviteId).toBeNull();
    expect(response.body?.emailDeliveryFailed).toBe(false);
  });

  test('OTF-1.5 duplicate fresh invite returns a clean already-invited response', async ({
    page,
  }) => {
    await loginAs(page, QA_USERS.member4);
    await openActiveSession(page);

    const email = uniqueInviteEmail('qa.otf.duplicate');
    const firstResponse = await postSessionInvite(page, email);
    const secondResponse = await postSessionInvite(page, email);

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body?.ok).toBe(true);
    expect(firstResponse.body?.alreadyMember).toBe(false);
    expect(firstResponse.body?.inviteId).toBeTruthy();
    expect(firstResponse.body?.invitedDuringSessionId).toBeTruthy();

    expect(secondResponse.status).toBe(409);
    expect(secondResponse.body?.ok).toBe(false);
    expect(secondResponse.body?.reason).toBe('invite_exists');
    expect(secondResponse.body?.inviteId).toBe(firstResponse.body?.inviteId);
  });
});
