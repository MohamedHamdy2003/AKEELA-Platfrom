import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  portalFixture,
  login,
} from '../../../../packages/portal/test/browser-fixtures';
test('admin reviews, fails an order, receives realtime updates and restores the session after reload', async ({
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
  await expect(page.locator('.detail-panel')).toContainText('سعر الوحدة:');
  await expect(page.locator('.detail-panel')).toContainText('آخر تحديث:');
  await expect(page.locator('.detail-panel')).toContainText('معرّف العميل');
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
  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'المستخدمون', exact: true }),
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
  await expect(page.getByRole('navigation')).not.toBeVisible();
  await page.getByRole('button', { name: 'فتح القائمة' }).click();
  await page.locator('.sidebar').getByRole('button').last().focus();
  await page.keyboard.press('Tab');
  await expect(
    page.locator('.sidebar').getByRole('button', { name: 'إغلاق القائمة' }),
  ).toBeFocused();
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
test('large restaurant images stay contained and account details include the role profile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/test-restaurant.png', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="#146044"/></svg>',
    }),
  );
  await portalFixture(
    page,
    'Admin',
    'http://127.0.0.1:5174/test-restaurant.png',
  );
  await login(page);
  await page.getByRole('button', { name: 'فتح القائمة' }).click();
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'المطاعم', exact: true })
    .click();
  await page.getByRole('button', { name: 'مراجعة المطعم' }).click();
  await expect(
    page.getByRole('img', { name: 'مطعم بيت الشواية' }),
  ).toBeVisible();
  expect(
    (await page.getByRole('img', { name: 'مطعم بيت الشواية' }).boundingBox())!
      .width,
  ).toBeLessThanOrEqual(180);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole('button', { name: 'فتح القائمة' }).click();
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'المستخدمون', exact: true })
    .click();
  await page.getByRole('button', { name: 'عرض الحساب' }).last().click();
  const profile = page.getByRole('region', { name: 'بيانات الملف' });
  await expect(profile).toContainText('معرّف المطعم');
  await expect(profile).toContainText('بانتظار التفعيل');
  await expect(profile).toContainText('10:00:00');
  await expect(profile.getByRole('img', { name: 'صورة المطعم' })).toBeVisible();
});
