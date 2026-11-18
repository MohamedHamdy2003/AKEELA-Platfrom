import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  portalFixture,
  login,
} from '../../../../packages/portal/test/browser-fixtures';
test.use({ locale: 'en-US' });
for (const width of [1536, 390])
  test(`Arabic date controls send ISO filters even in an English browser at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1024 });
    await portalFixture(page, 'Admin');
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await login(page);
    if (width === 390)
      await page.getByRole('button', { name: 'فتح القائمة' }).click();
    await page
      .getByRole('navigation')
      .getByRole('button', { name: 'الطلبات', exact: true })
      .click();
    await expect(page.locator('input[type=date]')).toHaveCount(0);
    await page
      .getByLabel('من تاريخ — اليوم', { exact: true })
      .selectOption('29');
    await page
      .getByLabel('من تاريخ — الشهر', { exact: true })
      .selectOption('2');
    await page.getByLabel('من تاريخ — السنة', { exact: true }).fill('٢٠٢٤');
    await expect
      .poll(() =>
        requests.some(
          (url) => new URL(url).searchParams.get('date_from') === '2024-02-29',
        ),
      )
      .toBe(true);
    await expect(
      page.getByLabel('من تاريخ — السنة', { exact: true }),
    ).toHaveValue('٢٠٢٤');
    await expect(
      page
        .getByLabel('من تاريخ — الشهر', { exact: true })
        .locator('option:checked'),
    ).toHaveText('فبراير');
    await page
      .getByLabel('إلى تاريخ — اليوم', { exact: true })
      .selectOption('1');
    await page
      .getByLabel('إلى تاريخ — الشهر', { exact: true })
      .selectOption('3');
    await page.getByLabel('إلى تاريخ — السنة', { exact: true }).fill('2024');
    await expect
      .poll(() =>
        requests.some(
          (url) => new URL(url).searchParams.get('date_to') === '2024-03-01',
        ),
      )
      .toBe(true);
    await page.getByLabel('من تاريخ — السنة', { exact: true }).fill('٢٠٢٥');
    await expect(
      page.getByLabel('من تاريخ — اليوم', { exact: true }),
    ).toHaveValue('');
    await page
      .getByLabel('من تاريخ — اليوم', { exact: true })
      .selectOption('1');
    await expect(
      page.getByLabel('إلى تاريخ — السنة', { exact: true }),
    ).toHaveValue('');
    await page
      .getByLabel('إلى تاريخ — اليوم', { exact: true })
      .selectOption('1');
    await page
      .getByLabel('إلى تاريخ — الشهر', { exact: true })
      .selectOption('1');
    await page.getByLabel('إلى تاريخ — السنة', { exact: true }).fill('٢٠٢٥');
    await expect(page.getByRole('alert')).toContainText(
      'اختر تاريخًا مساويًا لتاريخ البداية أو بعده.',
    );
    expect(
      requests.every((url) => {
        const params = new URL(url).searchParams;
        return (
          !params.get('date_from') ||
          !params.get('date_to') ||
          params.get('date_from')! <= params.get('date_to')!
        );
      }),
    ).toBe(true);
    await page
      .getByRole('button', { name: 'مسح من تاريخ', exact: true })
      .click();
    await expect(
      page.getByLabel('من تاريخ — السنة', { exact: true }),
    ).toHaveValue('');
    await page.screenshot({
      path: join(tmpdir(), `akeela-admin-arabic-dates-${width}.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
test('dashboard native and server field feedback is Arabic; authentication remains outside its scope', async ({
  page,
}) => {
  await portalFixture(page, 'Admin');
  await login(page);
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'حسابي', exact: true })
    .click();
  const name = page.getByLabel('الاسم الكامل', { exact: true });
  await name.fill('');
  await page.getByRole('button', { name: 'حفظ البيانات', exact: true }).click();
  expect(
    await name.evaluate((input: HTMLInputElement) => input.validationMessage),
  ).toBe('هذا الحقل مطلوب.');
  await name.fill('اسم جديد');
  await page.route('**/api/v1/me', async (route) => {
    if (route.request().method() === 'PATCH')
      await route.fulfill({
        status: 422,
        json: {
          success: false,
          message: 'Validation failed.',
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            fields: { phone: ['phone must match a regular expression'] },
          },
        },
      });
    else await route.fallback();
  });
  await page.getByRole('button', { name: 'حفظ البيانات', exact: true }).click();
  await expect(page.locator('.field-error')).toContainText('أدخل رقم هاتف');
  await expect(page.locator('.field-error')).not.toContainText(
    'regular expression',
  );
  await page.getByRole('button', { name: 'تسجيل الخروج', exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'مرحبًا بعودتك' }),
  ).toBeVisible();
  const email = page.getByLabel('البريد الإلكتروني', { exact: true });
  await email.fill('invalid');
  await page.getByLabel('كلمة المرور', { exact: true }).fill('TestOnly123');
  await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  const message = await email.evaluate(
    (input: HTMLInputElement) => input.validationMessage,
  );
  expect(message).toMatch(/[A-Za-z]/);
  expect(message).not.toMatch(/\p{Script=Arabic}/u);
});
