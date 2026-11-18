import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  portalFixture,
  login,
} from '../../../../packages/portal/test/browser-fixtures';
test('admin reviews, fails an order, receives realtime updates and keeps sessions in memory', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const fixture = await portalFixture(page, 'Admin');
  await login(page);
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'الطلبات', exact: true })
    .click();
  await page.getByRole('button', { name: 'عرض التفاصيل' }).first().click();
  await expect(page.getByText('وجبة دجاج مشوي × 2')).toBeVisible();
  await page.screenshot({
    path: join(tmpdir(), 'akeela-admin-desktop.png'),
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'تسجيل تعثّر الطلب', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'تأكيد', exact: true })
    .click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.detail-status')).toContainText('متعثر');
  expect(
    fixture.calls.some(
      (call) =>
        call.path === '/admin/orders/1248/fail' && call.method === 'POST',
    ),
  ).toBeTruthy();
  fixture.orders[0]!.status = 'Delivered';
  fixture.notify();
  await expect(page.locator('.detail-status')).toContainText('تم التسليم');
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'المطاعم', exact: true })
    .click();
  await page.getByRole('button', { name: 'مراجعة المطعم' }).click();
  await page.getByRole('button', { name: 'تفعيل المطعم', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'تأكيد', exact: true })
    .click();
  await expect
    .poll(
      () =>
        fixture.calls.filter(
          (call) => call.path === '/admin/restaurants/7/activation',
        ).length,
    )
    .toBe(1);
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'المستخدمون', exact: true })
    .click();
  await page.getByRole('button', { name: 'عرض الحساب' }).last().click();
  await expect(
    page.getByRole('button', { name: 'تعطيل الحساب' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'مرحبًا بعودتك' }),
  ).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  expect(errors).toEqual([]);
});
test('compact mobile navigation, failed requests, and keyboard confirmation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await portalFixture(page, 'Admin');
  await login(page);
  await page.getByRole('button', { name: 'فتح القائمة' }).click();
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'الطلبات', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'إدارة الطلبات' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'عرض التفاصيل' }).first().click();
  await page.screenshot({
    path: join(tmpdir(), 'akeela-admin-mobile.png'),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page
    .getByRole('button', { name: 'تسجيل تعثّر الطلب', exact: true })
    .click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.route('**/api/v1/admin/orders?*', (route) =>
    route.fulfill({
      status: 503,
      json: {
        success: false,
        error: { code: 'UNAVAILABLE' },
        message: 'الخدمة غير متاحة مؤقتًا',
      },
    }),
  );
  await page.getByRole('button', { name: 'تحديث البيانات' }).click();
  await expect(page.getByRole('alert').first()).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'إعادة المحاولة' }).first(),
  ).toBeVisible();
});
