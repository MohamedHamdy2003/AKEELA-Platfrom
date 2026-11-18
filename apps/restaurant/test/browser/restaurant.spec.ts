import { mockMapTiles } from './fixtures';
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await mockMapTiles(page);
});
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setup, login, profile } from './fixtures';

test('desktop: identity, orders, details, acceptance and contract-safe category creation', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const writes = await setup(page);
  await page.goto('/');
  await page.screenshot({
    animations: 'disabled',
    path: join(tmpdir(), 'akeela-login.png'),
  });
  await login(page);
  await expect(page).toHaveTitle('AKEELA - المطعم - الرئيسية');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(
    page.getByRole('cell', { name: '#1084', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    animations: 'disabled',
    path: join(tmpdir(), 'akeela-home.png'),
  });
  await page
    .getByRole('button', { name: 'عرض التفاصيل', exact: true })
    .first()
    .click();
  await expect(page.getByRole('dialog')).toContainText('بدون بصل');
  await page.screenshot({
    animations: 'disabled',
    path: join(tmpdir(), 'akeela-order.png'),
  });
  await page.getByRole('button', { name: 'قبول الطلب', exact: true }).click();
  await page.getByRole('button', { name: 'تأكيد', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByText('مقبول', { exact: true }),
  ).toBeVisible();
  expect(writes.find((write) => write.path.endsWith('/accept'))?.body).toEqual(
    {},
  );
  await page.getByRole('button', { name: 'إغلاق', exact: true }).click();
  await page.getByRole('button', { name: 'التصنيفات', exact: true }).click();
  await page.getByRole('button', { name: 'إضافة تصنيف', exact: true }).click();
  await page.getByLabel('اسم التصنيف', { exact: true }).fill('وجبات');
  await page.getByRole('button', { name: 'حفظ التصنيف' }).click();
  await expect(
    page.getByRole('cell', { name: 'وجبات', exact: true }),
  ).toBeVisible();
  expect(
    writes.find((write) => write.path === '/restaurant/categories')?.body,
  ).toEqual({ cat_title: 'وجبات', is_active: true, display_order: 0 });
  await page.getByRole('button', { name: 'المنتجات', exact: true }).click();
  await page.getByRole('button', { name: 'إضافة منتج' }).click();
  await page.screenshot({
    animations: 'disabled',
    path: join(tmpdir(), 'akeela-product.png'),
  });
  await page.getByLabel('اسم المنتج').fill('برجر');
  await page
    .getByRole('combobox', { name: 'التصنيف', exact: true })
    .last()
    .selectOption('100');
  await page.getByLabel('السعر بالجنيه المصري').fill('100.00');
  await page.getByRole('button', { name: 'حفظ المنتج' }).click();
  expect(
    writes.find((write) => write.path === '/restaurant/products')?.body,
  ).toEqual({
    prod_name: 'برجر',
    is_active: true,
    cat_id: '100',
    prod_description: null,
    price: '100.00',
  });
  expect(errors).toEqual([]);
  await page.reload();
  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'المنتجات', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});
test('mobile RTL navigation and non-overflowing first screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await login(page);
  await expect(
    page.getByRole('heading', { name: 'صباح الخير، مطبخ أكيلة' }),
  ).toBeVisible();
  await page.screenshot({
    animations: 'disabled',
    path: join(tmpdir(), 'akeela-mobile.png'),
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'فتح القائمة' }).click();
  await page.getByRole('button', { name: 'ملف المطعم', exact: true }).click();
  await expect(page.getByLabel('عنوان الاستلام')).toHaveValue(
    profile.rest_address,
  );
  await page.getByRole('button', { name: 'فتح القائمة' }).click();
  await page.getByRole('button', { name: 'المنتجات', exact: true }).click();
  await page.getByRole('button', { name: 'إضافة منتج' }).click();
  await page.screenshot({
    animations: 'disabled',
    path: join(tmpdir(), 'akeela-product-mobile.png'),
  });
  await page
    .getByRole('button', { name: 'حفظ المنتج', exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole('button', { name: 'حفظ المنتج', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'إلغاء', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('Pending owner can only read own status/profile/account; management stays disabled', async ({
  page,
}) => {
  await setup(page, 'Pending');
  await page.goto('/');
  await page
    .getByLabel('البريد الإلكتروني', { exact: true })
    .fill('owner@example.com');
  await page.getByLabel('كلمة المرور', { exact: true }).fill('Password123');
  await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'خطوتك التالية: تفعيل المطعم' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'الطلبات', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'ملف المطعم', exact: true }).click();
  await expect(page.getByLabel('اسم المطعم', { exact: true })).toBeDisabled();
  await page.screenshot({
    animations: 'disabled',
    path: join(tmpdir(), 'akeela-pending.png'),
  });
});
test('network failure renders retry instead of a fabricated dashboard', async ({
  page,
}) => {
  await page.route('**/api/v1/auth/login', (route) => route.abort());
  await page.goto('/');
  await page
    .getByLabel('البريد الإلكتروني', { exact: true })
    .fill('owner@example.com');
  await page.getByLabel('كلمة المرور', { exact: true }).fill('Password123');
  await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('تعذّر الاتصال');
});

test('registration creates only the documented nested profile, then verifies email', async ({
  page,
}) => {
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({
    longitude: Number(profile.longitude),
    latitude: Number(profile.latitude),
  });
  const writes = await setup(page);
  await page.goto('/');
  await page
    .getByRole('button', { name: 'إنشاء حساب مطعم', exact: true })
    .click();
  await page.getByLabel('اسم المالك').fill('مالك المطعم');
  await page
    .getByLabel('البريد الإلكتروني', { exact: true })
    .fill('owner@example.com');
  await page.getByLabel('رقم الهاتف').fill('+201000000000');
  await page.getByLabel('كلمة المرور', { exact: true }).fill('Password123');
  await page.getByLabel('اسم المطعم', { exact: true }).fill('مطبخ أكيلة');
  await page.getByLabel('عنوان المطعم').fill(profile.rest_address);
  await expect(page.getByLabel('خط الطول')).toHaveValue(profile.longitude);
  await expect(page.getByLabel('خط العرض')).toHaveValue(profile.latitude);
  await page.getByLabel('وقت الفتح (القاهرة)').fill('10:00');
  await page.getByLabel('وقت الإغلاق (القاهرة)').fill('02:00');
  await page
    .getByRole('button', { name: 'إنشاء حساب مطعم', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'تأكيد البريد الإلكتروني' }),
  ).toBeVisible();
  const body = writes.find(
    (write) => write.path === '/auth/register/restaurant',
  )?.body as Record<string, unknown>;
  expect(body.profile).toEqual({
    rest_title: 'مطبخ أكيلة',
    rest_address: profile.rest_address,
    longitude: profile.longitude,
    latitude: profile.latitude,
    opens_at: '10:00:00',
    closes_at: '02:00:00',
  });
  expect(body).not.toHaveProperty('activation_status');
  expect(body).not.toHaveProperty('role');
  await page.getByLabel('رمز التحقق').fill('123456');
  await page.getByRole('button', { name: 'تأكيد البريد', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'أهلًا بعودتك' }),
  ).toBeVisible();
  expect(writes.some((write) => write.path === '/auth/login')).toBe(false);
  await expect(
    page.getByRole('button', { name: 'تسجيل الدخول', exact: true }),
  ).toBeEnabled();
});

test('offers use Cairo dates and decimal strings; orders filter only supported status', async ({
  page,
}) => {
  const writes = await setup(page);
  await login(page);
  await page.getByRole('button', { name: 'العروض', exact: true }).click();
  await page.getByRole('button', { name: 'إضافة عرض', exact: true }).click();
  await page.getByLabel('اسم العرض').fill('غداء الصيف');
  await page.getByLabel('السعر الأصلي (ج.م)').fill('150.00');
  await page.getByLabel('سعر العرض (ج.م)').fill('130.00');
  await page.getByLabel('بداية العرض (القاهرة)').fill('2027-07-01T12:00');
  await page.getByLabel('نهاية العرض (القاهرة)').fill('2027-07-02T12:00');
  await page.getByRole('button', { name: 'حفظ العرض', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(
    writes.find((write) => write.path === '/restaurant/offers')?.body,
  ).toEqual({
    offer_title: 'غداء الصيف',
    is_active: true,
    offer_description: null,
    initial_price: '150.00',
    real_price: '130.00',
    starts_at: '2027-07-01T09:00:00.000Z',
    expires_at: '2027-07-02T09:00:00.000Z',
  });
  await page.getByRole('button', { name: 'الطلبات', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'الحالة', exact: true })
    .selectOption('Accepted');
  await page.getByRole('button', { name: 'تطبيق الفلاتر' }).click();
  await expect(page.getByRole('row')).toHaveCount(2);
  await expect(
    page.getByRole('cell', { name: '#1083', exact: true }),
  ).toBeVisible();
});

test('tablet composition, password recovery and absence of framework overlay', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  const writes = await setup(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'نسيت كلمة المرور؟' }).click();
  await page.getByLabel('البريد الإلكتروني').fill('owner@example.com');
  await page.getByRole('button', { name: 'إرسال رمز الاستعادة' }).click();
  await page.getByLabel('رمز التحقق').fill('123456');
  await page.getByLabel('كلمة المرور الجديدة').fill('NewPassword123');
  await page.getByRole('button', { name: 'حفظ كلمة المرور' }).click();
  expect(
    writes.find((write) => write.path === '/auth/reset-password')?.body,
  ).toEqual({
    email: 'owner@example.com',
    otp: '123456',
    new_password: 'NewPassword123',
  });
  await login(page);
  await expect(
    page.getByRole('cell', { name: '#1084', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    animations: 'disabled',
    path: join(tmpdir(), 'akeela-tablet.png'),
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
});
