import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  portalFixture,
  login,
} from '../../../../packages/portal/test/browser-fixtures';

test('delivery auth uses the white logo and driver status is a semantic badge', async ({
  page,
}) => {
  await portalFixture(page, 'Delivery_Company');
  await page.goto('/');
  await expect(page.locator('.auth-identity img')).toHaveCSS(
    'filter',
    'brightness(0) invert(1)',
  );
  await page.screenshot({
    path: join(tmpdir(), 'akeela-polish-delivery-login.png'),
    animations: 'disabled',
  });
  await login(page);
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'السائقون', exact: true })
    .click();
  await expect(page.locator('td .activity-badge')).toHaveAttribute(
    'data-active',
    'true',
  );
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'طلبات الشركة', exact: true })
    .click();
  await page.getByRole('button', { name: 'عرض التفاصيل' }).first().click();
  const pane = page.getByRole('complementary', {
    name: 'تفاصيل الطلب',
    exact: true,
  });
  await expect(pane).toHaveCSS('animation-name', 'admin-detail-enter');
  await page.screenshot({
    path: join(tmpdir(), 'akeela-polish-delivery-orders.png'),
    animations: 'disabled',
  });
  await page.keyboard.press('Escape');
  await expect(pane).toHaveCount(0);
});
