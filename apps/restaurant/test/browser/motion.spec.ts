import { mockMapTiles } from './fixtures';
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await mockMapTiles(page);
});
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setup, login } from './fixtures';

test('busy buttons keep size; genuine table loading has a skeleton; dialog exit releases interaction immediately', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await setup(page);
  let finishLogin!: () => void;
  const loginGate = new Promise<void>((resolve) => {
    finishLogin = resolve;
  });
  let finishOrders!: () => void;
  const ordersGate = new Promise<void>((resolve) => {
    finishOrders = resolve;
  });
  await page.route('**/api/v1/auth/login', async (route) => {
    await loginGate;
    await route.fallback();
  });
  await page.route(/\/api\/v1\/restaurant\/orders\?/, async (route) => {
    await ordersGate;
    await route.fallback();
  });
  await page.goto('/');
  await page
    .getByLabel('البريد الإلكتروني', { exact: true })
    .fill('owner@example.com');
  await page.getByLabel('كلمة المرور', { exact: true }).fill('Password123');
  const submit = page.locator('.auth-submit');
  const before = await submit.boundingBox();
  await submit.focus();
  await expect(submit).toBeFocused();
  await expect(submit).toHaveCSS('outline-width', '3px');
  await submit.hover();
  await expect(submit).toHaveCSS('background-color', 'rgb(0, 109, 70)');
  const box = (await submit.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect
    .poll(() =>
      submit.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).scale),
      ),
    )
    .toBeLessThan(1);
  await page.mouse.up();
  await expect(submit).toBeDisabled();
  await expect(submit.locator('.button-rest')).toHaveCSS(
    'visibility',
    'hidden',
  );
  // The pressed transform settles, then disabled/loading has the same layout box.
  await expect(submit).toHaveCSS('scale', /^(none|1)$/);
  const pending = await submit.boundingBox();
  expect(pending!.width).toBeCloseTo(before!.width, 1);
  expect(pending!.height).toBeCloseTo(before!.height, 1);
  finishLogin();
  await expect(
    page.getByRole('heading', { name: 'تحليلات المطعم', exact: true }),
  ).toBeVisible();
  const service = page.getByRole('switch');
  const serviceWidth = (await service.boundingBox())!.width;
  await service.click();
  await expect(service).toHaveAttribute('aria-checked', 'false');
  await expect(service.locator('span')).toHaveCSS(
    'transform',
    'matrix(1, 0, 0, 1, -30, 0)',
  );
  expect((await service.boundingBox())!.width).toBe(serviceWidth);
  await service.click();
  await expect(service).toHaveAttribute('aria-checked', 'true');
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'الطلبات', exact: true })
    .click();
  await expect(
    page.getByRole('status', { name: 'جارٍ تحميل البيانات' }),
  ).toBeVisible();
  await expect(page.locator('.table-skeleton tbody tr')).toHaveCount(5);
  await page.screenshot({
    animations: 'disabled',
    path: join(tmpdir(), 'akeela-motion-loading.png'),
  });
  finishOrders();
  await expect(
    page.getByRole('cell', { name: '#1084', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.table-skeleton')).toHaveCount(0);
  await page.screenshot({
    animations: 'disabled',
    path: join(tmpdir(), 'akeela-motion-home.png'),
  });
  await page.getByRole('button', { name: 'التصنيفات', exact: true }).click();
  const opener = page.getByRole('button', { name: 'إضافة تصنيف', exact: true });
  await opener.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveCSS('animation-name', 'dialog-in');
  await page.getByLabel('اسم التصنيف').fill('قيمة قبل الإغلاق');
  const exitProof = page.evaluate(
    () =>
      new Promise<{
        open: boolean;
        animation: string;
        pointer: string;
        focusReleased: boolean;
      }>((resolve) => {
        const element = document.querySelector('dialog')!;
        element.addEventListener(
          'close',
          () =>
            resolve({
              open: element.open,
              animation: getComputedStyle(element).animationName,
              pointer: getComputedStyle(element).pointerEvents,
              focusReleased: !element.contains(document.activeElement),
            }),
          { once: true },
        );
      }),
  );
  await page.getByRole('button', { name: 'إغلاق', exact: true }).click();
  expect(await exitProof).toEqual({
    open: false,
    animation: 'dialog-out',
    pointer: 'none',
    focusReleased: true,
  });
  // Reopening during/after the visual tail must create a clean editor, not stale fields.
  await opener.click();
  await expect(page.getByLabel('اسم التصنيف')).toHaveValue('');
  await expect
    .poll(() =>
      page
        .getByRole('dialog')
        .evaluate((element) => element.contains(document.activeElement)),
    )
    .toBe(true);
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('اسم التصنيف')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(page.locator('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('order confirmation stays guarded during a pending API action and success/status remain correct', async ({
  page,
}) => {
  await setup(page);
  await login(page);
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'الطلبات', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'عرض التفاصيل', exact: true })
    .first()
    .click();
  await expect(page.getByRole('dialog')).toHaveCSS(
    'animation-name',
    'drawer-in',
  );
  await page.getByRole('button', { name: 'قبول الطلب', exact: true }).click();
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route('**/api/v1/restaurant/orders/1084/accept', async (route) => {
    await gate;
    await route.fallback();
  });
  const confirm = page.getByRole('button', { name: 'تأكيد', exact: true });
  const size = await confirm.boundingBox();
  await confirm.click();
  const busy = page.locator('.confirm-box .button').first();
  await expect(busy).toBeDisabled();
  expect((await busy.boundingBox())!.width).toBeCloseTo(size!.width, 1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  finish();
  await expect(
    page.getByRole('dialog').getByText('مقبول', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toContainText('تم قبول الطلب');
  await expect(page.getByRole('dialog').locator('.badge-label')).toHaveCSS(
    'animation-name',
    'status-in',
  );
});

test('inline feedback enters and exits without retaining an accessible stale alert', async ({
  page,
}) => {
  await setup(page);
  let attempt = 0;
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route('**/api/v1/auth/login', async (route) => {
    if (++attempt === 1)
      await route.fulfill({
        status: 422,
        json: {
          success: false,
          message: 'Please check the input.',
          error: {
            code: 'VALIDATION_ERROR',
            fields: { email: ['Check the email.'] },
          },
        },
      });
    else {
      await gate;
      await route.fallback();
    }
  });
  await page.goto('/');
  await page
    .getByLabel('البريد الإلكتروني', { exact: true })
    .fill('owner@example.com');
  await page.getByLabel('كلمة المرور', { exact: true }).fill('Password123');
  await page.locator('.auth-submit').click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('.notice.error')).toHaveCSS(
    'animation-name',
    'feedback-in',
  );
  await page.locator('.auth-submit').click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.notice')).toHaveCount(0);
  finish();
  await expect(
    page.getByRole('heading', { name: 'تحليلات المطعم', exact: true }),
  ).toBeVisible();
});

for (const viewport of [
  { width: 1536, height: 1024 },
  { width: 390, height: 844 },
]) {
  test(`reduced motion disables transitions and preserves RTL/focus at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup(page);
    await login(page);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('switch')).toHaveCSS(
      'transition-duration',
      '0s',
    );
    await expect(page.getByRole('switch').locator('span')).toHaveCSS(
      'transition-duration',
      '0s',
    );
    if (viewport.width === 390) {
      await page.getByRole('button', { name: 'فتح القائمة' }).click();
    }
    await page
      .getByRole('navigation')
      .getByRole('button', { name: 'الطلبات', exact: true })
      .click();
    await expect(page.locator('.page-heading')).toHaveCSS(
      'animation-name',
      'none',
    );
    if (viewport.width < 960) {
      const open = page.getByRole('button', { name: 'فتح القائمة' });
      await open.click();
      await expect(page.locator('.sidebar')).toHaveCSS(
        'transition-duration',
        '0s',
      );
      await page.keyboard.press('Escape');
      await expect(open).toBeFocused();
      await expect(page.locator('.sidebar')).toHaveAttribute('inert', '');
      await open.click();
    }
    await page.getByRole('button', { name: 'التصنيفات', exact: true }).click();
    const opener = page.getByRole('button', {
      name: 'إضافة تصنيف',
      exact: true,
    });
    await opener.click();
    await expect(page.getByRole('dialog')).toHaveCSS('animation-name', 'none');
    await expect
      .poll(() =>
        page
          .getByRole('dialog')
          .evaluate((element) => element.contains(document.activeElement)),
      )
      .toBe(true);
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('اسم التصنيف')).toBeFocused();
    await page.screenshot({
      animations: 'disabled',
      path: join(tmpdir(), `akeela-motion-reduced-${viewport.width}.png`),
    });
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog')).toHaveCount(0);
    await expect(opener).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test('fresh palette and compact typography retain contrast, visible motion and reduced-motion support', async ({
  page,
}) => {
  await setup(page);
  await login(page);
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'الطلبات', exact: true })
    .click();
  await page.mouse.move(0, 0);
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(255, 253, 249)',
  );
  const heading = page.getByRole('heading', { level: 1 });
  const sizes = await heading.evaluate((element) => ({
    heading: parseFloat(getComputedStyle(element).fontSize),
    body: parseFloat(getComputedStyle(document.body).fontSize),
    navigation: parseFloat(
      getComputedStyle(document.querySelector('.sidebar nav button')!).fontSize,
    ),
    table: parseFloat(getComputedStyle(document.querySelector('td')!).fontSize),
  }));
  expect(sizes.heading).toBeLessThanOrEqual(32);
  expect(sizes.heading).toBeGreaterThanOrEqual(24);
  expect(sizes.body).toBe(16);
  expect(sizes.navigation).toBeLessThanOrEqual(16);
  expect(sizes.table).toBeLessThanOrEqual(15);
  const active = page.locator('.sidebar nav [aria-current="page"]');
  await expect(active).toHaveCSS('background-color', 'rgb(0, 134, 87)');
  await expect(active).toHaveCSS('color', 'rgb(255, 255, 255)');
  const contrast = await active.evaluate((element) => {
    const style = getComputedStyle(element);
    function luminance(color: string) {
      const rgb = color
        .match(/\d+/g)!
        .slice(0, 3)
        .map(Number)
        .map((n) => {
          const s = n / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    }
    return (
      (luminance(style.color) + 0.05) /
      (luminance(style.backgroundColor) + 0.05)
    );
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  await expect(page.locator('tbody tr').nth(1)).toHaveCSS(
    'animation-delay',
    '0.035s',
  );
  await page.getByRole('button', { name: 'التصنيفات', exact: true }).click();
  const cta = page.getByRole('button', { name: 'إضافة تصنيف', exact: true });
  await cta.hover();
  await expect(cta).toHaveCSS('translate', '0px -2px');
  await expect(cta.locator('svg')).toHaveCSS('translate', '-4px');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(cta).toHaveCSS('translate', 'none');
  await expect(page.locator('tbody tr').first()).toHaveCSS(
    'animation-name',
    'none',
  );
  expect(
    await cta.evaluate(
      (element) => getComputedStyle(element, '::after').display,
    ),
  ).toBe('none');
});
