import { expect, test, type Page } from '@playwright/test';

import {
  expectNoHorizontalOverflow,
  loginAs,
  openDashboardView,
  QA_SESSIONS,
  QA_USERS,
} from '../fixtures/qa';

async function openActiveSprint(page: Page) {
  await openDashboardView(page, 'sessions');

  const sessionCard = page
    .getByRole('button', { name: new RegExp(QA_SESSIONS.activeMain.name, 'i') })
    .first();

  await expect(sessionCard).toBeVisible({ timeout: 20_000 });
  await sessionCard.click();

  await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]+/, {
    timeout: 20_000,
  });
  await expect(answerChoice(page, 'A')).toBeVisible({ timeout: 20_000 });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function answerChoice(page: Page, option: string) {
  return page.locator('label').filter({
    hasText: new RegExp(`^\\s*${escapeRegExp(option)}\\s*$`),
  });
}

function confidenceChoice(page: Page, label: RegExp) {
  return page.locator('label').filter({ hasText: label });
}

test.describe('UAT active sprint surface', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      process.env.E2E_RESET_QA_SESSIONS !== '1',
      'Requires resettable QA session fixtures. Run with E2E_RESET_QA_SESSIONS=1.',
    );

    await loginAs(page, QA_USERS.member4);
    await openActiveSprint(page);
  });

  test('SPR-2.4 active sprint screen has answer controls and no in-app chat surface', async ({
    page,
  }) => {
    for (const option of ['A', 'B', 'C', 'D', 'E', '?']) {
      await expect(answerChoice(page, option)).toBeVisible();
    }

    await expect(confidenceChoice(page, /faible|low/i)).toBeVisible();
    await expect(confidenceChoice(page, /moyen|medium/i)).toBeVisible();
    await expect(confidenceChoice(page, /lev|high/i)).toBeVisible();

    await answerChoice(page, 'A').click();
    await confidenceChoice(page, /moyen|medium/i).click();
    await expect(
      page.getByRole('button', { name: /envoyer la r.ponse|submit answer/i }),
    ).toBeVisible();

    await expect(
      page.getByRole('button', {
        name: /chat|discussion|message|commentaire/i,
      }),
    ).toHaveCount(0);
    await expect(page.getByText(/chat|discussion/i)).toHaveCount(0);

    await expectNoHorizontalOverflow(page);
  });

  test('KEY-8.5 mobile sprint screen remains touch-first without keyboard-only instructions', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();

    await expect(answerChoice(page, 'A')).toBeVisible({ timeout: 20_000 });
    await expect(answerChoice(page, '?')).toBeVisible();

    await answerChoice(page, 'A').click();
    await confidenceChoice(page, /moyen|medium/i).click();
    await expect(
      page.getByRole('button', { name: /envoyer la r.ponse|submit answer/i }),
    ).toBeVisible();

    await expect(
      page.getByText(/keyboard|shortcut|raccourci|clavier/i),
    ).toHaveCount(0);

    await expectNoHorizontalOverflow(page);
  });
});
