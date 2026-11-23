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
  await page.getByLabel('حالة الطلب').selectOption('Delivered');
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
    // A translated pane can produce subpixel DOMQuad rounding during its entry.
  ).toBeLessThanOrEqual(180.01);
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
test('admin executive analytics dashboard supports time ranges, chart toggles, leaderboards and mobile layout', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1536, height: 960 });
  const fixture = await portalFixture(page, 'Admin');
  await login(page);

  await expect(
    page.getByRole('heading', { name: 'نظرة عامة', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('إجمالي المبيعات (GMV)')).toBeVisible();
  await expect(page.getByText('منحنى الأداء اليومي')).toBeVisible();
  await expect(page.getByText('توزيع حالات الطلبات')).toBeVisible();
  await expect(page.getByText('أوقات الذروة (بتوقيت القاهرة)')).toBeVisible();
  await expect(page.getByText('الأصناف الأكثر طلباً')).toBeVisible();
  await expect(page.getByText('طبق كشري مخصوص')).toBeVisible();

  await page.screenshot({
    path: join(tmpdir(), 'akeela-admin-analytics-desktop.png'),
    fullPage: true,
  });

  await page.getByRole('button', { name: '7 أيام', exact: true }).click();
  await expect
    .poll(
      () =>
        fixture.calls.filter((call) => call.path === '/admin/analytics').length,
    )
    .toBeGreaterThanOrEqual(2);

  await page.getByRole('button', { name: 'الكل', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'الكل', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');

  await page
    .getByRole('button', { name: 'الطلبات', exact: true })
    .last()
    .click();
  await expect(page.getByText('إجمالي الطلبات المستلمة يومياً')).toBeVisible();

  await page.getByRole('button', { name: 'تحتاج متابعة', exact: true }).click();
  await expect(page.getByText('برجر السريع')).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: join(tmpdir(), 'akeela-admin-analytics-mobile.png'),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();

  await page.getByRole('button', { name: /مطعم بانتظار التفعيل/ }).click();
  await expect(
    page.getByRole('heading', { name: 'المطاعم', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test('admin searches restaurants after 1s debounce, opens restaurant workspace tabs, custom period and exports Excel', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = await portalFixture(page, 'Admin');
  await login(page);

  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'المطاعم', exact: true })
    .click();
  await expect(page.getByText('مطعم بيت الشواية')).toBeVisible();

  const initialRestCalls = fixture.calls.filter(
    (c) => c.path === '/admin/restaurants',
  ).length;
  const searchInput = page.getByLabel('بحث باسم المطعم أو اسم المالك');
  await searchInput.fill('الشواية');
  // Must NOT immediately fire before 1 second debounce
  await page.waitForTimeout(350);
  expect(
    fixture.calls.filter((c) => c.path === '/admin/restaurants').length,
  ).toBe(initialRestCalls);

  // Fires after 1 second debounce
  await expect
    .poll(
      () => fixture.calls.filter((c) => c.path === '/admin/restaurants').length,
      { timeout: 2500 },
    )
    .toBeGreaterThan(initialRestCalls);

  await page.getByRole('button', { name: 'مراجعة المطعم' }).click();
  await page.getByRole('button', { name: 'الانتقال إلى المطعم' }).click();

  await expect(
    page.getByRole('heading', { name: 'مطعم بيت الشواية', exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'مؤشرات مكاسب المطعم' })
      .getByText('صافي مبيعات الطعام'),
  ).toBeVisible();
  await expect(page.getByText('جدول المكاسب اليومية')).toBeVisible();

  // Apply custom date range
  await page.getByLabel('من تاريخ').fill('2026-11-01');
  await page.getByLabel('إلى تاريخ').fill('2026-11-15');
  await page.getByRole('button', { name: 'عرض الفترة' }).click();
  await expect(
    page.getByText('من 2026-11-01 إلى 2026-11-15').first(),
  ).toBeVisible();

  // Trigger Excel export download
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'تصدير تقرير المكاسب (Excel)' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(
    /^akeela-restaurant-7-earnings-2026-11-01_to_2026-11-15\.xlsx$/,
  );

  // Switch to Orders tab
  await page.getByRole('tab', { name: 'طلبات المطعم' }).click();
  await expect(
    page.getByRole('cell', { name: '#1248', exact: true }),
  ).toBeVisible();

  // Switch to Profile & Menu tab
  await page.getByRole('tab', { name: 'بيانات المطعم والمنيو' }).click();
  await expect(page.getByText('ملخص قائمة الطعام والتشغيل الحي')).toBeVisible();

  // Go back to restaurants list
  await page.getByRole('button', { name: 'العودة إلى المطاعم' }).click();
  await expect(
    page.getByRole('heading', { name: 'المطاعم', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
