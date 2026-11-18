import { mockMapTiles } from './fixtures';
import { test, expect, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await mockMapTiles(page);
});
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test.use({
  permissions: ['geolocation'],
  geolocation: { longitude: 32.2723, latitude: 30.5965, accuracy: 20 },
});

async function openRegistration(page: Page) {
  await page.goto('/');
  await expect(page).toHaveTitle('AKEELA - المطعم - تسجيل الدخول');
  await page
    .getByRole('button', { name: 'إنشاء حساب مطعم', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'ابدأ حكاية مطعمك' }),
  ).toBeVisible();
}
async function fillRegistration(page: Page) {
  await page.getByLabel('اسم المالك').fill('مالك اختباري');
  await page
    .getByLabel('البريد الإلكتروني', { exact: true })
    .fill('test-owner@example.com');
  await page.getByLabel('رقم الهاتف').fill('+201000000000');
  await page.getByLabel('كلمة المرور', { exact: true }).fill('Password123');
  await page.getByLabel('اسم المطعم', { exact: true }).fill('مطعم اختباري');
  await page.getByLabel('عنوان المطعم').fill('عنوان مطعم اختباري');
  await page.getByLabel('وقت الفتح (القاهرة)').fill('10:00');
  await page.getByLabel('وقت الإغلاق (القاهرة)').fill('02:00');
}
async function expectEyeCentered(page: Page) {
  // Sample both rectangles in one frame, including while their form is entering.
  const distance = await page.locator('.password-field').evaluate((field) => {
    const input = field.querySelector('input')!.getBoundingClientRect();
    const eye = field.querySelector('button')!.getBoundingClientRect();
    return Math.abs(eye.y + eye.height / 2 - input.y - input.height / 2);
  });
  expect(distance).toBeLessThan(1);
}

for (const viewport of [
  { width: 1536, height: 1024 },
  { width: 390, height: 844 },
]) {
  test(`password eyes stay centered with hints/errors at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto('/');
    await page.getByLabel('كلمة المرور', { exact: true }).fill('Password123');
    await expectEyeCentered(page);
    await page.getByRole('button', { name: 'إظهار كلمة المرور' }).click();
    await expect(
      page.getByLabel('كلمة المرور', { exact: true }),
    ).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'إخفاء كلمة المرور' }).click();
    await expect(
      page.getByLabel('كلمة المرور', { exact: true }),
    ).toHaveAttribute('type', 'password');
    await page.screenshot({
      animations: 'disabled',
      path: join(tmpdir(), `akeela-auth-login-${viewport.width}.png`),
    });
    await page
      .getByRole('button', { name: 'إنشاء حساب مطعم', exact: true })
      .click();
    await expect(page.getByLabel('خط الطول')).toHaveValue('32.2723000');
    await expect(page.getByLabel('خط العرض')).toHaveValue('30.5965000');
    await expect(page.getByLabel('عنوان الاستلام')).toHaveCount(0);
    await expectEyeCentered(page);
    await page.screenshot({
      animations: 'disabled',
      path: join(tmpdir(), `akeela-auth-register-${viewport.width}.png`),
      fullPage: true,
    });
    await page.route('**/api/v1/auth/register/restaurant', (route) =>
      route.fulfill({
        status: 422,
        json: {
          success: false,
          message: 'Please check the input.',
          error: {
            code: 'VALIDATION_ERROR',
            fields: { password: ['Check this password.'] },
          },
        },
      }),
    );
    await fillRegistration(page);
    // Expected HTTP error responses may be reported by Chromium's console.
    await page
      .getByRole('button', { name: 'إنشاء حساب مطعم', exact: true })
      .click();
    await expect(
      page.getByText('Check this password.', { exact: true }),
    ).toBeVisible();
    await expect(page.locator('.notice.error')).toHaveCSS(
      'animation-name',
      'feedback-in',
    );
    await expect(page.locator('.field-error').first()).toHaveCSS(
      'animation-name',
      'feedback-in',
    );
    await expectEyeCentered(page);
    expect(errors.filter((error) => !error.includes('422'))).toEqual([]);
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test('denied location stays blank and supports manual coordinates without inventing a position', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: (
          _success: PositionCallback,
          failure: PositionErrorCallback,
        ) => {
          failure({ code: 1 } as GeolocationPositionError);
          return 1;
        },
        clearWatch: () => {},
      },
    });
  });
  let sent: unknown;
  await page.route('**/api/v1/auth/register/restaurant', async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      json: { success: true, message: 'Account created.', data: {} },
    });
  });
  await openRegistration(page);
  await expect(page.getByRole('status')).toContainText('إذن الموقع غير متاح');
  await expect(page.getByLabel('خط الطول')).toHaveValue('');
  await expect(page.getByLabel('خط العرض')).toHaveValue('');
  await fillRegistration(page);
  await page.getByLabel('خط الطول').fill('32.2000000');
  await page.getByLabel('خط العرض').fill('30.5000000');
  await page
    .getByRole('button', { name: 'إنشاء حساب مطعم', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'تأكيد البريد الإلكتروني' }),
  ).toBeVisible();
  expect(sent).toMatchObject({
    profile: {
      rest_address: 'عنوان مطعم اختباري',
      longitude: '32.2000000',
      latitude: '30.5000000',
    },
  });
});

test('duplicate registration explains the actual conflict, preserves form and offers email verification', async ({
  page,
}) => {
  let submissions = 0;
  await page.route('**/api/v1/auth/register/restaurant', async (route) => {
    submissions++;
    await route.fulfill({
      status: 409,
      json: {
        success: false,
        message: 'An account with this email or phone already exists.',
        error: { code: 'CONFLICT' },
      },
    });
  });
  await openRegistration(page);
  await fillRegistration(page);
  await expect(page.getByLabel('خط الطول')).toHaveValue('32.2723000');
  await page
    .getByRole('button', { name: 'إنشاء حساب مطعم', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'البريد الإلكتروني أو رقم الهاتف مستخدم بالفعل',
  );
  await expect(page.getByRole('alert')).not.toContainText('تغيّر الحالة');
  await expect(page.getByLabel('اسم المطعم', { exact: true })).toHaveValue(
    'مطعم اختباري',
  );
  expect(submissions).toBe(1);
  await page.screenshot({
    animations: 'disabled',
    path: join(tmpdir(), 'akeela-auth-duplicate.png'),
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'تأكيد البريد الإلكتروني', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'تأكيد البريد الإلكتروني' }),
  ).toBeVisible();
  await expect(
    page.getByLabel('البريد الإلكتروني', { exact: true }),
  ).toHaveValue('test-owner@example.com');
});

async function mockLocationStream(page: Page) {
  await page.addInitScript(() => {
    let callback: PositionCallback;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: (success: PositionCallback) => {
          callback = success;
          return 7;
        },
        clearWatch: () => {},
      },
    });
    Object.assign(window, {
      emitLocation: (accuracy: number, longitude: number, latitude: number) =>
        callback({
          coords: { accuracy, longitude, latitude },
        } as GeolocationPosition),
    });
  });
}
async function emitLocation(
  page: Page,
  accuracy: number,
  longitude = 32.2,
  latitude = 30.5,
) {
  await page.evaluate(
    ({ accuracy, longitude, latitude }) => {
      (
        window as unknown as {
          emitLocation: (a: number, x: number, y: number) => void;
        }
      ).emitLocation(accuracy, longitude, latitude);
    },
    { accuracy, longitude, latitude },
  );
}

test('location improves its best estimate, shows accuracy and protects manual edits from late fixes', async ({
  page,
}) => {
  await mockLocationStream(page);
  await openRegistration(page);
  await emitLocation(page, 5000);
  await expect(page.getByRole('status')).toContainText('5000 متر');
  await emitLocation(page, 200, 32.3, 30.6);
  await expect(page.getByLabel('خط الطول')).toHaveValue('32.3000000');
  await emitLocation(page, 8000, 33, 31);
  await expect(page.getByLabel('خط الطول')).toHaveValue('32.3000000');
  await expect(page.getByRole('status')).toContainText('200 متر');
  await expect(
    page.getByRole('link', { name: 'مراجعة الموقع على الخريطة' }),
  ).toHaveAttribute(
    'href',
    'https://www.openstreetmap.org/?mlat=30.6&mlon=32.3#map=18/30.6/32.3',
  );
  await page.getByLabel('خط الطول').fill('32.4');
  await emitLocation(page, 10, 34, 32);
  await expect(page.getByLabel('خط الطول')).toHaveValue('32.4');
  await expect(page.getByRole('status')).toContainText('يدويًا');
  await expect(
    page.getByRole('button', { name: 'تحديث الموقع' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'تحديث الموقع' }).click();
  await emitLocation(page, 15, 32.5, 30.7);
  await expect(page.getByRole('status')).toContainText('15 متر');
  await expect(page.getByLabel('خط الطول')).toHaveValue('32.5000000');
  await page.screenshot({
    animations: 'disabled',
    path: join(tmpdir(), 'akeela-location.png'),
    fullPage: true,
  });
});

test('location acquisition ends after bounded wait and ignores late callbacks', async ({
  page,
}) => {
  await page.clock.install();
  await mockLocationStream(page);
  await openRegistration(page);
  await emitLocation(page, 6000);
  await page.clock.fastForward(25001);
  await expect(
    page.getByRole('button', { name: 'تحديث الموقع' }),
  ).toBeEnabled();
  await expect(page.getByRole('status')).toContainText('6000 متر');
  await emitLocation(page, 10, 35, 33);
  await expect(page.getByLabel('خط الطول')).toHaveValue('32.2000000');
});

for (const width of [1536, 390]) {
  test(`automatic map marker, click, drag, keyboard and manual fields stay synchronized at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 844 });
    await mockLocationStream(page);
    let sent: unknown;
    await page.route('**/api/v1/auth/register/restaurant', async (route) => {
      sent = route.request().postDataJSON();
      await route.fulfill({ status: 201, json: { success: true, data: {} } });
    });
    await openRegistration(page);
    const map = page.getByRole('region', { name: 'خريطة اختيار موقع المطعم' });
    await expect(map).toBeVisible();
    await expect(page.locator('.location-marker')).toHaveCount(0);
    await emitLocation(page, 200, 10.18, 36.8);
    const marker = page.locator('.location-marker');
    await expect(marker).toBeVisible();
    await expect(page.getByLabel('خط الطول')).toHaveValue('10.1800000');
    await emitLocation(page, 100, 10.19, 36.81);
    await expect(page.getByLabel('خط العرض')).toHaveValue('36.8100000');
    // Move across countries through manual fields; the marker and viewport follow.
    await page.getByLabel('خط الطول').fill('32.2723');
    await page.getByLabel('خط العرض').fill('30.5965');
    await map.scrollIntoViewIfNeeded();
    await map.click({ position: { x: 180, y: 190 } });
    const clickedLongitude = await page.getByLabel('خط الطول').inputValue();
    const clickedLatitude = await page.getByLabel('خط العرض').inputValue();
    expect(Number(clickedLongitude)).toBeCloseTo(32.2723, 1);
    expect(Number(clickedLatitude)).toBeCloseTo(30.5965, 1);
    expect(clickedLongitude).not.toBe('32.2723');
    await emitLocation(page, 5, 10.18, 36.8);
    await expect(page.getByLabel('خط الطول')).toHaveValue(clickedLongitude);
    await marker.focus();
    await marker.press('ArrowRight');
    const keyboardLongitude = await page.getByLabel('خط الطول').inputValue();
    expect(Number(keyboardLongitude)).toBeGreaterThan(Number(clickedLongitude));
    const box = await marker.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box!.x + box!.width / 2 + 55,
      box!.y + box!.height / 2 - 35,
      { steps: 12 },
    );
    await page.mouse.up();
    await expect(page.getByLabel('خط الطول')).not.toHaveValue(
      keyboardLongitude,
    );
    const longitude = await page.getByLabel('خط الطول').inputValue();
    const latitude = await page.getByLabel('خط العرض').inputValue();
    expect(Number(longitude)).toBeGreaterThan(Number(keyboardLongitude));
    expect(Number(latitude)).toBeGreaterThan(Number(clickedLatitude));
    await expect(page.getByRole('status')).toContainText(
      'التحديد التلقائي متوقف',
    );
    await expect(map.getByText('OpenStreetMap')).toBeVisible();
    await page.screenshot({
      animations: 'disabled',
      fullPage: true,
      path: join(tmpdir(), `akeela-leaflet-${width}.png`),
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await fillRegistration(page);
    await page
      .getByRole('button', { name: 'إنشاء حساب مطعم', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'تأكيد البريد الإلكتروني' }),
    ).toBeVisible();
    expect(sent).toMatchObject({ profile: { longitude, latitude } });
    expect(errors).toEqual([]);
  });
}

test('denied geolocation permits map selection; tile failure keeps manual fallback and retry available', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: (
          _success: PositionCallback,
          failure: PositionErrorCallback,
        ) => {
          queueMicrotask(() =>
            failure({ code: 1 } as GeolocationPositionError),
          );
          return 1;
        },
        clearWatch: () => {},
      },
    });
  });
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({ status: 503, body: '' }),
  );
  await openRegistration(page);
  await expect(page.getByRole('status')).toContainText('إذن الموقع غير متاح');
  await expect(
    page.getByText('تعذّر تحميل بعض أجزاء الخريطة.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel('خط الطول')).toHaveValue('');
  await expect(page.locator('.location-marker')).toHaveCount(0);
  await page
    .getByRole('region', { name: 'خريطة اختيار موقع المطعم' })
    .click({ position: { x: 180, y: 180 } });
  await expect(page.locator('.location-marker')).toBeVisible();
  await page.getByLabel('خط الطول').fill('32.2');
  await page.getByLabel('خط العرض').fill('30.5');
  await expect(page.locator('.location-marker')).toBeVisible();
  await mockMapTiles(page);
  await page.getByRole('button', { name: 'إعادة تحميل الخريطة' }).click();
  await expect(
    page.getByText('تعذّر تحميل بعض أجزاء الخريطة.', { exact: false }),
  ).toHaveCount(0);
  await page
    .getByRole('region', { name: 'خريطة اختيار موقع المطعم' })
    .click({ position: { x: 180, y: 180 } });
  await expect(page.getByLabel('خط الطول')).not.toHaveValue('32.2');
  // Route exit destroys the map, and reopening creates exactly one fresh instance.
  await page.getByRole('button', { name: 'العودة لتسجيل الدخول' }).click();
  await page
    .getByRole('button', { name: 'إنشاء حساب مطعم', exact: true })
    .click();
  await expect(page.locator('.leaflet-container')).toHaveCount(1);
});
