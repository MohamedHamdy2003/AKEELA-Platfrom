import { test, expect } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  portalFixture,
  login,
} from '../../../../packages/portal/test/browser-fixtures';

for (const width of [1536, 390]) {
  test(`order pane enters from left and restores focus at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await portalFixture(page, 'Admin');
    await login(page);
    if (width < 680)
      await page
        .getByRole('button', { name: 'فتح القائمة', exact: true })
        .click();
    await page
      .getByRole('navigation')
      .getByRole('button', { name: 'الطلبات', exact: true })
      .click();
    const trigger = page.getByRole('button', { name: 'عرض التفاصيل' }).first();
    await trigger.click();
    const pane = page.getByRole('complementary', {
      name: 'تفاصيل الطلب',
      exact: true,
    });
    await expect(pane).toHaveCSS('animation-name', 'admin-detail-enter');
    await expect(
      pane.getByRole('button', { name: 'إغلاق تفاصيل الطلب' }),
    ).toBeFocused();
    await expect(pane).toContainText('وجبة دجاج مشوي');
    await expect(
      pane.getByRole('button', { name: 'إغلاق تفاصيل الطلب' }),
    ).toBeInViewport();
    await page.screenshot({
      path: join(tmpdir(), `akeela-polish-admin-orders-${width}.png`),
      animations: 'disabled',
    });
    await page.keyboard.press('Escape');
    await expect(pane).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await trigger.click();
    await expect(pane).toHaveCSS('animation-name', 'none');
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    expect(errors).toEqual([]);
  });
}

test('activity colors remain explicit and account pane has no accent top border', async ({
  page,
}) => {
  await portalFixture(page, 'Admin');
  await page.route('**/api/v1/admin/users?*', async (route) =>
    route.fulfill({
      json: {
        success: true,
        message: 'Records returned.',
        data: [true, false].map((active, i) => ({
          user_id: String(i + 4),
          full_name: i ? 'عمر حسن' : 'أحمد علي',
          email: `owner${i}@example.com`,
          phone: '+12025550101',
          role: 'Customer',
          is_active: active,
          email_verified_at: null,
          profile: null,
        })),
        meta: { page: 1, per_page: 10, total: 2, last_page: 1 },
      },
    }),
  );
  await login(page);
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'المستخدمون', exact: true })
    .click();
  await expect(
    page.locator('td .activity-badge[data-active="true"]'),
  ).toHaveCSS('color', 'rgb(18, 110, 69)');
  await expect(
    page.locator('td .activity-badge[data-active="false"]'),
  ).toHaveCSS('color', 'rgb(163, 39, 54)');
  await page.screenshot({
    path: join(tmpdir(), 'akeela-polish-admin-users.png'),
    animations: 'disabled',
  });
  await page
    .getByRole('button', { name: 'عرض الحساب', exact: true })
    .first()
    .click();
  await expect(page.locator('.admin-detail-sheet')).toHaveCSS(
    'border-top-width',
    '1px',
  );
});
