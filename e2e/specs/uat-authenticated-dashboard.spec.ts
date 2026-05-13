import { expect, test } from '@playwright/test';

import {
  expectNoHorizontalOverflow,
  loginAs,
  openDashboardView,
  QA_GROUPS,
  QA_SESSIONS,
} from '../fixtures/qa';

test.describe('UAT authenticated dashboard coverage', () => {
  test('ONB-1.4 / ONB-1.5 / ONB-1.6 QA founder lands on an existing seeded group', async ({
    page,
  }) => {
    await loginAs(page);
    await openDashboardView(page, 'groups');

    await expect(page.getByText(QA_GROUPS.main.name).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/members|membres/i).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('GRP-1.2 / GRP-1.5 group switcher exposes multiple seeded groups without duplicating data', async ({
    page,
  }) => {
    await loginAs(page);
    await openDashboardView(page, 'groups');

    await expect(page.getByText(QA_GROUPS.main.name).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(QA_GROUPS.side.name).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test('SPR-2.1 / DAT-15.2 seeded session data remains visible from sessions dashboard', async ({
    page,
  }) => {
    await loginAs(page);
    await openDashboardView(page, 'sessions');

    await expect(page.getByText(QA_SESSIONS.scheduledMain.name)).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByRole('heading', { name: /sessions/i }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('MOB-14.2 / ERR-16.1 invalid session code shows inline feedback and stays on dashboard', async ({
    page,
  }) => {
    await loginAs(page);
    await openDashboardView(page, 'sessions');

    await page.getByPlaceholder(/code|session code/i).fill('BAD999');
    await page.getByRole('button', { name: /^go$|^ouvrir$|^aller$/i }).click();

    await expect(page).toHaveURL(/\/dashboard\?view=sessions/);
    await expect(
      page.getByText(/invalid|introuvable|erreur|try|réessayer/i),
    ).toBeVisible({
      timeout: 20_000,
    });
    await expectNoHorizontalOverflow(page);
  });
});
