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
  ).toEqual({ cat_title: 'وجبات', is_active: true });
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
    page.getByRole('heading', { name: /^(صباح|مساء) الخير، مطبخ أكيلة$/ }),
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
  const [rstStatusBox, rstDayBox, rstResetBox, rstFilterPadBottom] =
    await Promise.all([
      page.getByRole('combobox', { name: 'الحالة', exact: true }).boundingBox(),
      page.getByLabel('من تاريخ — اليوم', { exact: true }).boundingBox(),
      page
        .getByRole('button', { name: 'إعادة ضبط الفلاتر', exact: true })
        .boundingBox(),
      page
        .locator('.filter-bar')
        .evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom)),
    ]);
  expect(rstFilterPadBottom).toBeGreaterThanOrEqual(14);
  expect(rstStatusBox && rstDayBox && rstResetBox).toBeTruthy();
  expect(Math.abs(rstStatusBox!.y - rstDayBox!.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(rstResetBox!.y - rstDayBox!.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(rstResetBox!.height - rstDayBox!.height)).toBeLessThanOrEqual(
    1,
  );
  await page
    .getByRole('combobox', { name: 'الحالة', exact: true })
    .selectOption('Accepted');
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

test('restaurant analytics page supports ranges, chart toggles, menu insights, and responsive layout', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1536, height: 960 });
  await setup(page);
  await login(page);

  await page.getByRole('button', { name: 'التحليلات', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'تحليلات المطعم', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('صافي مبيعات الطعام')).toBeVisible();
  await expect(page.getByText('العملاء العائدون (الولاء)')).toBeVisible();
  await expect(page.getByText('عائد الإضافات الإضافي')).toBeVisible();
  await expect(page.getByText('برجر مشوي مخصوص')).toBeVisible();
  await expect(page.getByText('صوص شيدر سايح')).toBeVisible();

  await page.screenshot({
    path: join(tmpdir(), 'akeela-restaurant-analytics-desktop.png'),
    fullPage: true,
    animations: 'disabled',
  });

  await page.getByRole('button', { name: '7 أيام', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '7 أيام', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'الكل', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'الكل', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');

  await page
    .getByRole('group', { name: 'معيار منحنى مبيعات المطعم' })
    .getByRole('button', { name: 'الطلبات', exact: true })
    .click();
  await expect(
    page.getByText('إجمالي الطلبات الواردة للمطعم يومياً'),
  ).toBeVisible();

  await page.getByRole('button', { name: 'تحتاج ترويج', exact: true }).click();
  await expect(page.getByText('عصير جوافة فريش')).toBeVisible();

  await page
    .getByRole('group', { name: 'عرض الإضافات والتصنيفات' })
    .getByRole('button', { name: 'التصنيفات', exact: true })
    .click();
  await expect(page.getByText('السندويتشات')).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: join(tmpdir(), 'akeela-restaurant-analytics-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.getByRole('button', { name: /طلب جديد بانتظار القبول/ }).click();
  await expect(
    page.getByRole('heading', { name: 'الطلبات', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('catalog swap ordering, category details with move/unlink/delete, and unlinked products/addons pools', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.setViewportSize({ width: 1440, height: 920 });
  await setup(page);
  await login(page);

  // 1. Categories: auto-order + atomic swap selector
  await page.getByRole('button', { name: 'التصنيفات', exact: true }).click();
  await page.getByRole('button', { name: 'إضافة تصنيف', exact: true }).click();
  await page.getByLabel('اسم التصنيف', { exact: true }).fill('المشويات');
  await page.getByRole('button', { name: 'حفظ التصنيف', exact: true }).click();

  await page.getByRole('button', { name: 'إضافة تصنيف', exact: true }).click();
  await page.getByLabel('اسم التصنيف', { exact: true }).fill('المشروبات');
  await page.getByRole('button', { name: 'حفظ التصنيف', exact: true }).click();

  // Swap المشروبات (#3) with السندويتشات (#1)
  await page
    .getByRole('row', { name: /المشروبات/ })
    .getByRole('button', { name: 'تعديل', exact: true })
    .click();
  const swapSelect = page.getByRole('combobox', {
    name: 'ترتيب العرض (تبديل مع تصنيف موجود)',
  });
  await expect(swapSelect).toHaveValue('3');
  await swapSelect.selectOption('1');
  await page.getByRole('button', { name: 'حفظ التصنيف', exact: true }).click();

  const catRows = page.locator('tbody tr');
  await expect(catRows.nth(0)).toContainText('المشروبات');
  await expect(catRows.nth(0)).toContainText('#1');
  await expect(catRows.nth(2)).toContainText('السندويتشات');
  await expect(catRows.nth(2)).toContainText('#3');

  // 2. Add two products under السندويتشات + one unlinked draft product
  await page.getByRole('button', { name: 'المنتجات', exact: true }).click();
  await page.getByRole('button', { name: 'إضافة منتج', exact: true }).click();
  await page.getByLabel('اسم المنتج').fill('شاورما فراخ');
  await page
    .getByRole('combobox', { name: 'التصنيف', exact: true })
    .last()
    .selectOption('100');
  await page.getByLabel('السعر بالجنيه المصري').fill('85.00');
  await page.getByRole('button', { name: 'حفظ المنتج', exact: true }).click();

  await page.getByRole('button', { name: 'إضافة منتج', exact: true }).click();
  await page.getByLabel('اسم المنتج').fill('برجر كلاسيك');
  await page
    .getByRole('combobox', { name: 'التصنيف', exact: true })
    .last()
    .selectOption('100');
  await page.getByLabel('السعر بالجنيه المصري').fill('110.00');
  await page.getByRole('button', { name: 'حفظ المنتج', exact: true }).click();

  // Unlinked draft product starts inactive with disabled checkbox
  await page.getByRole('button', { name: 'إضافة منتج', exact: true }).click();
  await page.getByLabel('اسم المنتج').fill('بطاطس مقرمشة');
  await expect(page.getByLabel('متاح للطلب')).toBeDisabled();
  await page.getByLabel('السعر بالجنيه المصري').fill('35.00');
  await page.getByRole('button', { name: 'حفظ المنتج', exact: true }).click();

  // 3. Category Details: disabled Delete until products moved/unlinked, then unlocked!
  await page.getByRole('button', { name: 'التصنيفات', exact: true }).click();
  await expect(
    page.getByRole('columnheader', { name: 'عدد المنتجات', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('row', { name: /المشروبات/ })).toContainText(
    'فارغ (0)',
  );
  await expect(
    page.getByRole('button', { name: 'السندويتشات', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: join(tmpdir(), 'akeela-catalog-categories.png'),
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'السندويتشات', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'السندويتشات', exact: true }),
  ).toBeVisible();

  // Test "إضافة منتجات" dialog inside Category Details: green "إضافة" -> red "حذف" -> green "إضافة"
  await page.getByRole('button', { name: 'إضافة منتجات', exact: true }).click();
  const pickDialog = page.getByRole('dialog');
  const friesRow = pickDialog
    .locator('.cat-product-pick-row')
    .filter({ hasText: 'بطاطس مقرمشة' });
  await expect(
    friesRow.getByRole('button', { name: 'إضافة', exact: true }),
  ).toBeVisible();
  await friesRow.getByRole('button', { name: 'إضافة', exact: true }).click();
  await expect(
    friesRow.getByRole('button', { name: 'حذف', exact: true }),
  ).toBeVisible();
  await friesRow.getByRole('button', { name: 'حذف', exact: true }).click();
  await expect(
    friesRow.getByRole('button', { name: 'إضافة', exact: true }),
  ).toBeVisible();
  await pickDialog.getByRole('button', { name: 'تم', exact: true }).click();

  const deleteCatBtn = page.getByRole('button', {
    name: 'مسح التصنيف',
    exact: true,
  });
  await expect(deleteCatBtn).toBeVisible();
  await expect(deleteCatBtn).toBeDisabled();
  await page.screenshot({
    path: join(tmpdir(), 'akeela-catalog-category-details.png'),
    animations: 'disabled',
  });

  // Move شاورما فراخ to المشويات via modal
  await page
    .getByRole('row', { name: /شاورما فراخ/ })
    .getByRole('button', { name: 'نقل لتصنيف آخر', exact: true })
    .click();
  await page
    .getByRole('combobox', { name: 'التصنيف المستهدف', exact: true })
    .selectOption('101');
  await page.getByRole('button', { name: 'نقل المنتج', exact: true }).click();
  await expect(page.getByRole('row', { name: /شاورما فراخ/ })).toHaveCount(0);

  // Unlink برجر كلاسيك via confirmation modal
  await page
    .getByRole('row', { name: /برجر كلاسيك/ })
    .getByRole('button', { name: 'فك الربط', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'تأكيد فك الربط', exact: true })
    .click();

  // Delete button unlocks immediately when category reaches 0 products!
  await expect(deleteCatBtn).toBeEnabled();
  await deleteCatBtn.click();
  await page
    .getByRole('button', { name: 'مسح التصنيف نهائياً', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'التصنيفات', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('row', { name: /السندويتشات/ })).toHaveCount(0);

  // 4. Unlinked Products Pool: link auto-activates, delete permanently deletes
  await page.getByRole('button', { name: 'المنتجات', exact: true }).click();
  await page
    .getByRole('button', { name: 'غير مربوطة (غير مفعّلة)', exact: true })
    .click();
  await expect(page.getByRole('row', { name: /برجر كلاسيك/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /بطاطس مقرمشة/ })).toBeVisible();
  await page.screenshot({
    path: join(tmpdir(), 'akeela-catalog-unlinked-products.png'),
    animations: 'disabled',
  });

  // Link برجر كلاسيك -> auto-activates & leaves unlinked pool
  await page
    .getByRole('row', { name: /برجر كلاسيك/ })
    .getByRole('button', { name: 'ربط بتصنيف', exact: true })
    .click();
  await page
    .getByRole('combobox', { name: 'التصنيف المستهدف', exact: true })
    .selectOption('101');
  await page
    .getByRole('button', { name: 'ربط وتفعيل المنتج', exact: true })
    .click();
  await expect(page.getByRole('row', { name: /برجر كلاسيك/ })).toHaveCount(0);

  // Permanently delete بطاطس مقرمشة
  await page
    .getByRole('row', { name: /بطاطس مقرمشة/ })
    .getByRole('button', { name: 'مسح بطاطس مقرمشة', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'مسح المنتج نهائياً', exact: true })
    .click();
  await expect(
    page.getByText('لا توجد منتجات غير مربوطة حالياً.'),
  ).toBeVisible();

  // 5. Addons Pool: starts unlinked/inactive -> link auto-activates -> delete blocked while linked -> unlink -> delete
  await page.getByRole('button', { name: 'الإضافات', exact: true }).click();
  await page.getByRole('button', { name: 'إضافة إضافة', exact: true }).click();
  await expect(page.getByLabel('مفعّل')).toBeDisabled();
  await page.getByLabel('اسم الإضافة').fill('صوص ثومية');
  await page.getByLabel('السعر بالجنيه المصري').fill('15.00');
  await page.getByRole('button', { name: 'حفظ الإضافة', exact: true }).click();

  await expect(page.getByRole('row', { name: /صوص ثومية/ })).toContainText(
    'متوقف',
  );
  await page
    .getByRole('row', { name: /صوص ثومية/ })
    .getByRole('button', { name: 'ربط بمنتجات', exact: true })
    .click();
  await page.getByLabel('برجر كلاسيك').check();
  await page.getByRole('button', { name: 'تم', exact: true }).click();
  await expect(page.getByRole('row', { name: /صوص ثومية/ })).toContainText(
    'مفعّل',
  );
  await expect(page.getByRole('row', { name: /صوص ثومية/ })).toContainText(
    'مربوطة بـ 1 منتج',
  );

  // Linked addon cannot be deleted in Edit modal
  await page
    .getByRole('row', { name: /صوص ثومية/ })
    .getByRole('button', { name: 'تعديل', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'مسح الإضافة نهائياً', exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: join(tmpdir(), 'akeela-catalog-addon-edit.png'),
    animations: 'disabled',
  });
  await page
    .getByRole('button', { name: 'إدارة ربط المنتجات', exact: true })
    .click();
  await page.getByLabel('برجر كلاسيك').uncheck();
  await page.getByRole('button', { name: 'تم', exact: true }).click();

  // Now unlinked & inactive -> permanently delete
  await page
    .getByRole('button', { name: 'غير مربوطة (غير مفعّلة)', exact: true })
    .click();
  await expect(page.getByRole('row', { name: /صوص ثومية/ })).toContainText(
    'متوقف',
  );
  await page
    .getByRole('row', { name: /صوص ثومية/ })
    .getByRole('button', { name: 'مسح صوص ثومية', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'مسح الإضافة نهائياً', exact: true })
    .click();
  await expect(
    page.getByText('لا توجد إضافات غير مربوطة حالياً.'),
  ).toBeVisible();

  // 6. Mobile responsive overflow check
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'فتح القائمة' }).click();
  await page.getByRole('button', { name: 'التصنيفات', exact: true }).click();
  await page.screenshot({
    path: join(tmpdir(), 'akeela-catalog-mobile.png'),
    animations: 'disabled',
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
