import { expect, test } from '@playwright/test';

import {
  expectNoHorizontalOverflow,
  loginAs,
  openDashboardView,
  QA_GROUPS,
  QA_SESSIONS,
} from '../fixtures/qa';

test.describe('UAT E2E foundation', () => {
  test('ONB-1.1 / #182 landing direct signup is available and responsive', async ({
    page,
  }) => {
    await page.goto('/en');

    await expect(
      page.getByRole('heading', { name: /no more unreliable groups/i }),
    ).toBeVisible();
    await expect(page.getByPlaceholder(/your email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/partner email/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /add partner/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /start the reliability sprint/i }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('AUTH-BASE existing QA captain can sign in', async ({ page }) => {
    await loginAs(page);
    await expect(page.getByText(/ActiveBoard/i).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('DASH-BASE dashboard tabs are reachable without stale visual state', async ({
    page,
  }) => {
    await loginAs(page);

    await openDashboardView(page, 'sessions');
    await expect(page.getByText(QA_SESSIONS.scheduledMain.name)).toBeVisible({
      timeout: 20_000,
    });

    await openDashboardView(page, 'performance');
    await expect(
      page.getByText(/performance|certitude|success/i).first(),
    ).toBeVisible({ timeout: 20_000 });

    await openDashboardView(page, 'groups');
    await expect(page.getByText(QA_GROUPS.main.name)).toBeVisible({
      timeout: 20_000,
    });
    await expectNoHorizontalOverflow(page);
  });
});
