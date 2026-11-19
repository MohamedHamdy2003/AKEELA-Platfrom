import { test, expect, type Page } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  portalFixture,
  login,
} from '../../../../packages/portal/test/browser-fixtures';

async function navigate(page: Page, label: string) {
  if (page.viewportSize()!.width < 680)
    await page
      .getByRole('button', { name: 'فتح القائمة', exact: true })
      .click();
  await page
    .getByRole('navigation')
    .getByRole('button', { name: label, exact: true })
    .click();
}

for (const width of [1536, 390]) {
  test(`restaurant review opens beside the list, keeps confirmation and closes smoothly at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const fixture = await portalFixture(page, 'Admin');
    await login(page);
    await navigate(page, 'المطاعم');
    const trigger = page.getByRole('button', {
      name: 'مراجعة المطعم',
      exact: true,
    });
    await trigger.click();
    const pane = page.getByRole('complementary', {
      name: 'مراجعة المطعم',
      exact: true,
    });
    await expect(pane).toBeVisible();
    const close = pane.getByRole('button', { name: 'إغلاق مراجعة المطعم' });
    await expect(close).toBeFocused();
    await expect(pane).toContainText('بيانات المالك');
    await expect(pane).toContainText('مطعم بيت الشواية');
    await expect(pane).toHaveCSS('animation-name', 'admin-detail-enter');
    await expect
      .poll(async () => {
        const sheet = await pane.boundingBox(),
          list = await page.locator('.admin-detail-list').boundingBox();
        return width > 1080
          ? sheet!.x < list!.x && sheet!.x + sheet!.width <= list!.x + 1
          : sheet!.y < list!.y;
      })
      .toBe(true);
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    await pane
      .getByRole('button', { name: 'تفعيل المطعم', exact: true })
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(pane).toBeVisible();
    expect(
      fixture.calls.filter(
        (call) => call.path.includes('/activation') && call.method === 'PATCH',
      ),
    ).toHaveLength(0);
    await page.screenshot({
      path: join(tmpdir(), `akeela-admin-restaurant-pane-${width}.png`),
      fullPage: true,
    });
    await close.click();
    await expect(pane).toHaveAttribute('data-closing', 'true');
    await expect(pane).toHaveCSS('animation-name', 'admin-detail-leave');
    await expect(pane).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(pane).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(pane).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(errors).toEqual([]);
  });

  test(`account detail has loading/retry, current record, and focus return at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await portalFixture(page, 'Admin');
    let release: (() => void) | undefined;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    let failure = false;
    await page.route('**/api/v1/admin/users/4', async (route) => {
      await wait;
      if (failure) {
        await route.fulfill({
          status: 503,
          json: {
            success: false,
            message: 'تعذر تحميل الحساب، حاول مرة أخرى.',
            error: { code: 'NOT_READY' },
          },
        });
        return;
      }
      await route.fallback();
    });
    await login(page);
    await navigate(page, 'المستخدمون');
    const trigger = page
      .getByRole('row')
      .filter({
        has: page.getByRole('cell', { name: 'عميل أكيلة', exact: true }),
      })
      .getByRole('button', { name: 'عرض الحساب' });
    await trigger.click();
    const pane = page.getByRole('complementary', { name: 'تفاصيل الحساب' });
    await expect(pane).toBeVisible();
    await expect(
      pane.getByRole('status', { name: 'جار التحميل' }),
    ).toBeVisible();
    failure = true;
    release!();
    await expect(pane.getByRole('alert')).toBeVisible();
    failure = false;
    await pane.getByRole('button', { name: 'إعادة المحاولة' }).click();
    await expect(
      pane.getByRole('heading', { name: 'عميل أكيلة', exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: join(tmpdir(), `akeela-admin-account-pane-${width}.png`),
      fullPage: true,
    });
    await page.keyboard.press('Escape');
    await expect(pane).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await page
      .getByRole('row')
      .filter({
        has: page.getByRole('cell', { name: 'مالك المطعم', exact: true }),
      })
      .getByRole('button', { name: 'عرض الحساب' })
      .click();
    await expect(
      pane.getByRole('heading', { name: 'مالك المطعم', exact: true }),
    ).toBeVisible();
    await expect(
      pane.getByRole('region', { name: 'بيانات الملف' }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    expect(errors).toEqual([]);
  });
}

test('reduced motion removes pane animation and close delay', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await portalFixture(page, 'Admin');
  await login(page);
  await navigate(page, 'المطاعم');
  await page
    .getByRole('button', { name: 'مراجعة المطعم', exact: true })
    .click();
  const pane = page.getByRole('complementary', {
    name: 'مراجعة المطعم',
    exact: true,
  });
  await expect(pane).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.admin-detail-workspace')).toHaveCSS(
    'transition-duration',
    '0s',
  );
  await page.keyboard.press('Escape');
  await expect(pane).toHaveCount(0);
});

test('switching accounts during exit cancels the old close and never renders stale data', async ({
  page,
}) => {
  const fixture = await portalFixture(page, 'Admin');
  await login(page);
  await navigate(page, 'المستخدمون');
  const customer = page
    .getByRole('row')
    .filter({
      has: page.getByRole('cell', { name: 'عميل أكيلة', exact: true }),
    })
    .getByRole('button', { name: 'عرض الحساب' });
  const owner = page
    .getByRole('row')
    .filter({
      has: page.getByRole('cell', { name: 'مالك المطعم', exact: true }),
    })
    .getByRole('button', { name: 'عرض الحساب' });
  await customer.click();
  const pane = page.getByRole('complementary', { name: 'تفاصيل الحساب' });
  await expect(
    pane.getByRole('heading', { name: 'عميل أكيلة', exact: true }),
  ).toBeVisible();
  await pane.getByRole('button', { name: 'إغلاق تفاصيل الحساب' }).click();
  await expect(pane).toHaveAttribute('data-closing', 'true');
  // A quick tap can arrive before the list's layout transition has settled.
  await owner.dispatchEvent('click');
  await expect(
    pane.getByRole('heading', { name: 'مالك المطعم', exact: true }),
  ).toBeVisible();
  await expect(
    pane.getByRole('heading', { name: 'عميل أكيلة', exact: true }),
  ).toHaveCount(0);
  await page.waitForTimeout(350);
  await expect(pane).toBeVisible();
  await expect(pane).toHaveAttribute('data-closing', 'false');
  expect(
    fixture.calls.filter(
      (call) => call.method !== 'GET' && !call.path.startsWith('/auth/'),
    ),
  ).toHaveLength(0);
});
