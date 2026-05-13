import { expect, type Page, test } from '@playwright/test';

import {
  expectNoHorizontalOverflow,
  loginAs,
  openDashboardView,
  QA_SESSIONS,
} from '../fixtures/qa';

async function joinSessionFromDashboard(page: Page) {
  await openDashboardView(page, 'sessions');
  await page
    .getByPlaceholder(/code|session code/i)
    .fill(QA_SESSIONS.scheduledMain.shareCode);
  await page.getByRole('button', { name: /^go$|^ouvrir$|^aller$/i }).click();
  await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]+/, {
    timeout: 20_000,
  });
}

test.describe('UAT session access coverage', () => {
  test('GRP-1.6 scheduled session entry exposes stable setup details', async ({
    page,
  }) => {
    await loginAs(page);
    await joinSessionFromDashboard(page);

    await expect(page.getByText(QA_SESSIONS.scheduledMain.name)).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByText(QA_SESSIONS.scheduledMain.shareCode),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /start|démarrer/i }),
    ).toBeVisible();

    await expectNoHorizontalOverflow(page);
  });

  test('ERR-16.3 unauthenticated session-code join receives an explicit login redirect', async ({
    request,
  }) => {
    const response = await request.post('/api/sessions/join', {
      data: {
        locale: 'fr',
        sessionCode: QA_SESSIONS.scheduledMain.shareCode,
      },
    });

    expect(response.status()).toBe(401);
    const payload = (await response.json()) as {
      ok?: boolean;
      redirectTo?: string;
    };
    expect(payload.ok).toBe(false);
    expect(payload.redirectTo).toBe('/fr/auth/login');
  });

  test('MOB-14.5 session dashboard remains responsive after viewport rotation', async ({
    page,
  }) => {
    await loginAs(page);
    await openDashboardView(page, 'sessions');

    await expect(page.getByRole('heading', { name: /sessions/i })).toBeVisible({
      timeout: 20_000,
    });
    await expectNoHorizontalOverflow(page);

    await page.setViewportSize({ width: 844, height: 390 });
    await expect(
      page.getByRole('heading', { name: /sessions/i }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByRole('heading', { name: /sessions/i }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
