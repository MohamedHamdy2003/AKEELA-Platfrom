import { test, expect, type Page } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  portalFixture,
  login,
} from '../../../../packages/portal/test/browser-fixtures';

async function companies(page: Page, verified = false) {
  await portalFixture(page, 'Admin');
  const user = {
    user_id: '71',
    full_name: 'مسؤول شركة التوصيل',
    email: 'company-login@example.com',
    phone: '+201000000071',
    role: 'Delivery_Company',
    is_active: true,
    email_verified_at: verified ? '2026-11-18T12:00:00+02:00' : null,
    profile: {
      company_id: '9',
      company_name: 'شركة الاختبار',
      company_address: 'الإسماعيلية',
      company_email: 'contact@example.com',
      company_phone: '+201000000079',
    },
  };
  const calls: Array<{
    path: string;
    body: unknown;
    authorization: string | undefined;
  }> = [];
  page.on('request', (request) => {
    if (
      request.url().includes('/auth/resend-verification') ||
      request.url().includes('/auth/verify-email')
    )
      calls.push({
        path: new URL(request.url()).pathname,
        body: request.postDataJSON(),
        authorization: request.headers().authorization,
      });
  });
  await page.route('**/api/v1/admin/users**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      json: {
        success: true,
        data: path.endsWith('/users') ? [user] : user,
        meta: { page: 1, per_page: 10, total: 1, last_page: 1 },
      },
    });
  });
  await login(page);
  if (page.viewportSize()!.width < 680)
    await page
      .getByRole('button', { name: 'فتح القائمة', exact: true })
      .click();
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'شركات التوصيل', exact: true })
    .click();
  return {
    user,
    calls,
    trigger: () =>
      page
        .getByRole('button', {
          name: user.email_verified_at ? 'بريد موثّق' : 'بريد غير موثّق',
          exact: true,
        })
        .first(),
  };
}

test('company verification from the account pane keeps the pane and its focus context', async ({
  page,
}) => {
  await companies(page);
  await page.getByRole('button', { name: 'عرض الحساب', exact: true }).click();
  const pane = page.getByRole('complementary', { name: 'تفاصيل الحساب' });
  const shield = pane.getByRole('button', {
    name: 'بريد غير موثّق',
    exact: true,
  });
  await shield.click();
  const dialog = page.getByRole('dialog', { name: 'توثيق بريد شركة التوصيل' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(pane).toBeVisible();
  await expect(shield).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(pane).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'عرض الحساب', exact: true }),
  ).toBeFocused();
});

for (const width of [1536, 390]) {
  test(`company email verification sends the fixed account email, handles OTP errors and refreshes the badge at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const fixture = await companies(page);
    await page.route('**/api/v1/auth/resend-verification', (route) =>
      route.fulfill({ json: { success: true, data: null } }),
    );
    await page.route('**/api/v1/auth/verify-email', (route) => {
      const body = route.request().postDataJSON();
      if (body.otp !== '123456')
        return route.fulfill({
          status: 400,
          json: { success: false, error: { code: 'OTP_INVALID_OR_EXPIRED' } },
        });
      fixture.user.email_verified_at = '2026-11-18T12:01:00+02:00';
      return route.fulfill({ json: { success: true, data: null } });
    });
    await fixture.trigger().click();
    const dialog = page.getByRole('dialog', {
      name: 'توثيق بريد شركة التوصيل',
    });
    await expect(dialog).toBeVisible();
    await page.screenshot({
      path: join(tmpdir(), `akeela-company-verification-start-${width}.png`),
    });
    await dialog
      .getByRole('button', {
        name: 'إرسال رمز التحقق إلى بريد الشركة',
        exact: true,
      })
      .click();
    const email = dialog.getByLabel('البريد الإلكتروني للشركة', {
      exact: true,
    });
    await expect(email).toHaveValue(fixture.user.email);
    await expect(email).toHaveAttribute('readonly', '');
    const otp = dialog.getByLabel('رمز التأكيد (OTP)', { exact: true });
    await expect(otp).toBeFocused();
    await otp.fill('000000');
    await dialog
      .getByRole('button', { name: 'تأكيد توثيق البريد', exact: true })
      .click();
    await expect(dialog.getByRole('alert')).toContainText('الرمز غير صحيح');
    await expect(otp).toHaveValue('000000');
    await otp.fill('١٢٣٤٥٦');
    await expect(otp).toHaveValue('123456');
    await page.screenshot({
      path: join(tmpdir(), `akeela-company-verification-otp-${width}.png`),
    });
    await dialog
      .getByRole('button', { name: 'تأكيد توثيق البريد', exact: true })
      .click();
    await expect(
      dialog.getByRole('heading', {
        name: 'البريد الإلكتروني موثّق',
        exact: true,
      }),
    ).toBeVisible();
    expect(fixture.calls.map((call) => call.body)).toEqual([
      { email: fixture.user.email },
      { email: fixture.user.email, otp: '000000' },
      { email: fixture.user.email, otp: '123456' },
    ]);
    expect(fixture.calls.every((call) => !call.authorization)).toBeTruthy();
    await dialog.getByRole('button', { name: 'إغلاق', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(fixture.trigger()).toBeVisible();
    await fixture.trigger().click();
    await expect(
      dialog.getByRole('heading', {
        name: 'البريد الإلكتروني موثّق',
        exact: true,
      }),
    ).toBeVisible();
    await expect(dialog.getByRole('button', { name: /إرسال/ })).toHaveCount(0);
    await page.keyboard.press('Escape');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    expect(errors).toEqual([]);
  });
}

test('a verified company opens a read-only modal with native keyboard activation and focus return', async ({
  page,
}) => {
  const fixture = await companies(page, true);
  const trigger = fixture.trigger();
  await trigger.focus();
  await page.keyboard.press('Space');
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('heading', {
      name: 'البريد الإلكتروني موثّق',
      exact: true,
    }),
  ).toBeVisible();
  await expect(dialog.getByRole('textbox')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  expect(fixture.calls).toHaveLength(0);
});

test('Retry-After survives modal reopening and unlocks resend after its deadline', async ({
  page,
}) => {
  await page.clock.install();
  const fixture = await companies(page);
  await page.route('**/api/v1/auth/resend-verification', (route) =>
    route.fulfill({
      status: 429,
      headers: { 'Retry-After': '120' },
      json: { success: false, error: { code: 'RATE_LIMITED' } },
    }),
  );
  await fixture.trigger().click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByRole('button', {
      name: 'إرسال رمز التحقق إلى بريد الشركة',
      exact: true,
    })
    .click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: /إعادة الإرسال بعد/ }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  await fixture.trigger().click();
  await expect(
    dialog.getByRole('button', { name: /إعادة الإرسال بعد/ }),
  ).toBeDisabled();
  await page.clock.fastForward(61000);
  await expect(
    dialog.getByRole('button', { name: /إعادة الإرسال بعد/ }),
  ).toBeDisabled();
  await page.clock.fastForward(61000);
  await expect(
    dialog.getByRole('button', {
      name: 'إرسال رمز التحقق إلى بريد الشركة',
      exact: true,
    }),
  ).toBeEnabled();
  expect(fixture.calls).toHaveLength(1);
});

test('pending mail blocks duplicate submissions and dismissal; network verification errors keep the draft', async ({
  page,
}) => {
  const fixture = await companies(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/v1/auth/resend-verification', async (route) => {
    await pending;
    await route.fulfill({ json: { success: true, data: null } });
  });
  await page.route('**/api/v1/auth/verify-email', (route) =>
    route.abort('failed'),
  );
  await fixture.trigger().click();
  const dialog = page.getByRole('dialog');
  const send = dialog.getByRole('button', {
    name: 'إرسال رمز التحقق إلى بريد الشركة',
    exact: true,
  });
  await send.evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect(
    dialog.getByRole('button', { name: 'إغلاق النافذة' }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect.poll(() => fixture.calls.length).toBe(1);
  release();
  const otp = dialog.getByLabel('رمز التأكيد (OTP)', { exact: true });
  await otp.fill('123456');
  await dialog
    .getByRole('button', { name: 'تأكيد توثيق البريد', exact: true })
    .click();
  await expect(dialog.getByRole('alert')).toContainText('تعذّر الاتصال');
  await expect(otp).toHaveValue('123456');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('navigation')).toBeVisible();
});
