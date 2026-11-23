import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setup, login, mockMapTiles, profile } from './fixtures';

test.beforeEach(async ({ page }) => {
  await mockMapTiles(page);
});
for (const width of [1536, 390]) {
  test(`profile map edits existing coordinates and saves them across revisits at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1024 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const writes = await setup(page);
    await login(page);
    async function navigate(name: string) {
      if (width === 390)
        await page.getByRole('button', { name: 'فتح القائمة' }).click();
      await page.getByRole('button', { name, exact: true }).click();
    }
    await navigate('ملف المطعم');
    const map = page.getByRole('region', { name: 'خريطة اختيار موقع المطعم' });
    const marker = page.locator('.location-marker');
    await expect(marker).toBeVisible();
    await expect(page.getByLabel('خط الطول')).toHaveValue(profile.longitude);
    await expect(page.getByLabel('خط العرض')).toHaveValue(profile.latitude);
    await page.getByLabel('خط الطول').fill('32.3');
    await page.getByLabel('خط العرض').fill('30.6');
    await map.scrollIntoViewIfNeeded();
    // Marker anchor follows manually typed coordinates to the viewport center.
    const offset = await marker.evaluate((el) => {
      const pin = el.getBoundingClientRect();
      const map = el.closest('.leaflet-container')!.getBoundingClientRect();
      return {
        x: Math.abs(pin.x + pin.width / 2 - map.x - map.width / 2),
        y: Math.abs(pin.bottom - map.y - map.height / 2),
      };
    });
    expect(offset.x).toBeLessThan(2);
    expect(offset.y).toBeLessThan(2);
    await map.click({ position: { x: 180, y: 185 } });
    const beforeDrag = await page.getByLabel('خط الطول').inputValue();
    const box = await marker.boundingBox();
    await page.mouse.move(box!.x + 16, box!.y + 16);
    await page.mouse.down();
    await page.mouse.move(box!.x + 56, box!.y - 10, { steps: 12 });
    await page.mouse.up();
    await expect(page.getByLabel('خط الطول')).not.toHaveValue(beforeDrag);
    const longitude = await page.getByLabel('خط الطول').inputValue();
    const latitude = await page.getByLabel('خط العرض').inputValue();
    await page.screenshot({
      path: join(tmpdir(), `akeela-profile-map-${width}.png`),
      fullPage: true,
      animations: 'disabled',
    });
    await page
      .getByRole('button', { name: 'حفظ بيانات المطعم', exact: true })
      .click();
    await expect
      .poll(
        () =>
          writes.filter((write) => write.path === '/restaurant/profile').length,
      )
      .toBe(1);
    expect(
      writes.find((write) => write.path === '/restaurant/profile')?.body,
    ).toMatchObject({ longitude, latitude });
    await expect(page.getByLabel('خط الطول')).toBeEnabled();
    await navigate('التحليلات');
    await navigate('ملف المطعم');
    await expect(page.getByLabel('خط الطول')).toHaveValue(longitude);
    await expect(page.getByLabel('خط العرض')).toHaveValue(latitude);
    await expect(marker).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
}
for (const activation of ['Pending', 'Suspended']) {
  test(`${activation} profile map displays stored position without permitting edits`, async ({
    page,
  }) => {
    const writes = await setup(page, activation);
    await page.goto('/');
    await page
      .getByLabel('البريد الإلكتروني', { exact: true })
      .fill('owner@example.com');
    await page.getByLabel('كلمة المرور', { exact: true }).fill('Password123');
    await page
      .getByRole('button', { name: 'تسجيل الدخول', exact: true })
      .click();
    await page.getByRole('button', { name: 'ملف المطعم', exact: true }).click();
    await expect(page.locator('.location-marker')).toHaveAttribute(
      'title',
      'موقع المطعم المحفوظ',
    );
    await page
      .getByRole('region', { name: 'خريطة اختيار موقع المطعم' })
      .click({ position: { x: 180, y: 180 } });
    await expect(page.getByLabel('خط الطول')).toHaveValue(profile.longitude);
    await expect(page.getByLabel('خط العرض')).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'حفظ بيانات المطعم', exact: true }),
    ).toHaveCount(0);
    expect(
      writes.filter((write) => write.path === '/restaurant/profile'),
    ).toHaveLength(0);
  });
}

test('pending profile save locks map selection and an error retains the chosen point', async ({
  page,
}) => {
  await setup(page);
  await login(page);
  await page.getByRole('button', { name: 'ملف المطعم', exact: true }).click();
  const map = page.getByRole('region', { name: 'خريطة اختيار موقع المطعم' });
  await map.click({ position: { x: 180, y: 180 } });
  const longitude = await page.getByLabel('خط الطول').inputValue();
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/v1/restaurant/profile', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    await pending;
    await route.fulfill({
      status: 500,
      json: {
        success: false,
        message: 'Save failed.',
        error: { code: 'INTERNAL_ERROR' },
      },
    });
  });
  await page
    .getByRole('button', { name: 'حفظ بيانات المطعم', exact: true })
    .click();
  await expect(page.getByLabel('خط الطول')).toBeDisabled();
  await map.click({ position: { x: 220, y: 220 } });
  await expect(page.getByLabel('خط الطول')).toHaveValue(longitude);
  release();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('خط الطول')).toBeEnabled();
  await expect(page.getByLabel('خط الطول')).toHaveValue(longitude);
  await expect(page.locator('.location-marker')).toBeVisible();
});
