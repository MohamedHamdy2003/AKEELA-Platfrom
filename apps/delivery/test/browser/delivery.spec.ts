import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  portalFixture,
  login,
} from '../../../../packages/portal/test/browser-fixtures';
test('dispatcher assigns, picks up and delivers, then sees live changes', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const fixture = await portalFixture(page, 'Delivery_Company');
  await login(page);
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'طلبات الشركة', exact: true })
    .click();
  await page.getByRole('button', { name: 'عرض التفاصيل' }).first().click();
  await expect(
    page.getByText('مطعم بيت الشواية', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'إسناد السائق', exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await page.screenshot({
    path: join(tmpdir(), 'akeela-delivery-desktop.png'),
    fullPage: true,
  });
  await page.getByLabel('السائق', { exact: true }).selectOption('11');
  await page.getByRole('button', { name: 'إسناد السائق', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'تأكيد تسليم الطلب', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('السائق', { exact: true })).toHaveCount(0);
  await page
    .getByRole('button', { name: 'تأكيد تسليم الطلب', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'تأكيد', exact: true })
    .click();
  await expect(page.locator('.detail-status')).toContainText('تم التسليم');
  expect(
    fixture.calls
      .filter((call) => call.method === 'PUT' || call.method === 'POST')
      .map((call) => call.path),
  ).toEqual(
    expect.arrayContaining([
      '/delivery-company/orders/1248/driver',
      '/delivery-company/orders/1248/deliver',
    ]),
  );
  fixture.orders[0]!.status = 'Failed';
  fixture.notify();
  await expect(page.locator('.detail-status')).toContainText('متعثر');
  await page.reload();
  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'طلبات الشركة', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test('driver create/edit and mobile navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await portalFixture(page, 'Delivery_Company');
  await login(page);
  await page.getByRole('button', { name: 'فتح القائمة' }).click();
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'السائقون', exact: true })
    .click();
  await page.getByRole('button', { name: 'إضافة سائق', exact: true }).click();
  await page.getByLabel('اسم السائق', { exact: true }).fill('علي حسن');
  await page.getByLabel('رقم الهاتف', { exact: true }).fill('+201000000099');
  await page.getByRole('button', { name: 'حفظ السائق', exact: true }).click();
  await expect(page.getByText('تم حفظ بيانات السائق.')).toBeVisible();
  expect(
    fixture.calls.some(
      (call) =>
        call.path === '/delivery-company/drivers' && call.method === 'POST',
    ),
  ).toBeTruthy();
  await page.getByRole('button', { name: 'تعديل السائق', exact: true }).click();
  await page.getByLabel('سائق نشط').uncheck();
  await page.getByRole('button', { name: 'حفظ السائق', exact: true }).click();
  await expect
    .poll(() => fixture.calls.filter((call) => call.method === 'PATCH').length)
    .toBe(1);
  await page.screenshot({
    path: join(tmpdir(), 'akeela-delivery-mobile.png'),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
test('delivery executive analytics dashboard displays dispatch radar, fleet metrics, driver load tabs and responsive layout', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1536, height: 960 });
  const fixture = await portalFixture(page, 'Delivery_Company');
  await login(page);

  await expect(
    page.getByRole('heading', { name: 'نظرة عامة', exact: true }),
  ).toBeVisible();
  const topbarBrand = page.locator('.topbar-brand');
  await expect(topbarBrand).toBeVisible();
  await expect(topbarBrand.locator('.topbar-brand-name')).toContainText(
    'شركة أكيلة للتوصيل',
  );
  await expect(topbarBrand.locator('.topbar-brand-name')).toHaveCSS(
    'text-transform',
    'uppercase',
  );
  await expect(page.locator('.sidebar-partner-name')).toContainText(
    'شركة أكيلة للتوصيل',
  );
  await expect(page.getByText('إيرادات رسوم التوصيل')).toBeVisible();
  await expect(page.getByText('متوسط زمن التوصيل')).toBeVisible();
  await expect(page.getByText('التحصيل النقدي (COD)')).toBeVisible();
  await expect(page.getByText('منحنى التوصيل اليومي')).toBeVisible();
  await expect(
    page.getByText('ساعات ذروة التوصيل (تخطيط الورديات)'),
  ).toBeVisible();
  await expect(page.getByText('أداء وحمل السائقين')).toBeVisible();
  await expect(page.getByText('أكثر المطاعم استلاماً')).toBeVisible();
  await expect(page.getByText('كريم عبد الله')).toBeVisible();

  await page.screenshot({
    path: join(tmpdir(), 'akeela-delivery-analytics-desktop.png'),
    fullPage: true,
  });

  await page.getByRole('button', { name: '7 أيام', exact: true }).click();
  await expect
    .poll(
      () =>
        fixture.calls.filter(
          (call) => call.path === '/delivery-company/analytics',
        ).length,
    )
    .toBeGreaterThanOrEqual(2);

  await page.getByRole('button', { name: 'الكل', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'الكل', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');

  await page
    .getByRole('group', { name: 'معيار منحنى التوصيل' })
    .getByRole('button', { name: 'رسوم التوصيل', exact: true })
    .click();
  await expect(
    page.getByText('إيرادات رسوم التوصيل اليومية (EGP)'),
  ).toBeVisible();

  await page
    .getByRole('group', { name: 'ترتيب قائمة السائقين' })
    .getByRole('button', { name: 'الحمل الحالي', exact: true })
    .click();
  await expect(
    page.getByText('ترتيب السائقين حسب عدد الطلبات المفتوحة عليهم الآن'),
  ).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: join(tmpdir(), 'akeela-delivery-analytics-mobile.png'),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();

  await page
    .getByRole('button', { name: /طلب بانتظار سائق لأكثر من 15 دقيقة/ })
    .click();
  await expect(
    page.getByRole('heading', { name: 'طلبات الشركة', exact: true }),
  ).toBeVisible();

  await page.setViewportSize({ width: 1536, height: 960 });
  await page.locator('.topbar-brand').click();
  await expect(
    page.getByRole('heading', { name: 'بيانات الشركة', exact: true }),
  ).toBeVisible();
  await page.getByLabel('اسم الشركة', { exact: true }).fill('bosta express');
  await page.getByRole('button', { name: 'حفظ البيانات', exact: true }).click();
  await expect(page.locator('.topbar-brand-name')).toContainText(
    'bosta express',
  );
  await expect(page.locator('.topbar-brand-name')).toHaveClass(/is-latin/);
  await page.screenshot({
    path: join(tmpdir(), 'akeela-delivery-branded-profile.png'),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
