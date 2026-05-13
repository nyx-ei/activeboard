import { expect, test } from '@playwright/test';

import {
  expectNoHorizontalOverflow,
  loginAs,
  openDashboardView,
  QA_GROUPS,
  QA_SESSIONS,
} from '../fixtures/qa';

test.describe('UAT E2E foundation', () => {
  test('ONB-1.1 / MOB-14.1 / #182 landing direct signup is available and responsive', async ({
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

  test('ONB-1.2 landing allows up to five partner emails without overflowing', async ({
    page,
  }) => {
    await page.goto('/en');

    const partnerInputs = page.getByPlaceholder(/partner email/i);
    await expect(partnerInputs).toHaveCount(1);

    for (let index = 0; index < 4; index += 1) {
      await page.getByRole('button', { name: /add partner/i }).click();
    }

    await expect(partnerInputs).toHaveCount(5);
    await expect(
      page.getByRole('button', { name: /add partner/i }),
    ).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test('ONB-1.3 landing requires founder and partner before submit', async ({
    page,
  }) => {
    await page.goto('/en');

    const submit = page.getByRole('button', {
      name: /start the reliability sprint/i,
    });
    await expect(submit).toBeDisabled();

    await page.getByPlaceholder(/your email/i).fill('uat-founder@example.com');
    await expect(submit).toBeDisabled();

    await page
      .getByPlaceholder(/partner email/i)
      .first()
      .fill('uat-partner@example.com');
    await expect(submit).toBeEnabled();
  });

  test('AUTH-BASE existing QA captain can sign in', async ({ page }) => {
    await loginAs(page);
    await expect(page.getByText(/ActiveBoard/i).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('GRP-1.1 / DAT-15.1 dashboard tabs are reachable without stale visual state', async ({
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
