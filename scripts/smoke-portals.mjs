import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';

// Only called by the random, disposable Compose smoke project.
export async function smokePortals({ docker, port }) {
  docker([
    'exec',
    '-T',
    'postgres',
    'psql',
    '-U',
    'smoke',
    '-d',
    'akeela_smoke_test',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    `
 INSERT INTO users(full_name,email,password_hash,phone_number,role,email_verified_at)
 SELECT 'Smoke Customer','customer-smoke@example.com',password_hash,'+201000000002','Customer',now() FROM users WHERE role='Admin';
 INSERT INTO users(full_name,email,password_hash,phone_number,role,email_verified_at)
 SELECT 'Smoke Restaurant','vendor-smoke@example.com',password_hash,'+201000000003','Restaurant',now() FROM users WHERE role='Admin';
 INSERT INTO users(full_name,email,password_hash,phone_number,role,email_verified_at)
 SELECT 'Smoke Delivery','delivery-smoke@example.com',password_hash,'+201000000004','Delivery_Company',now() FROM users WHERE role='Admin';
 INSERT INTO customer_profiles(user_id) SELECT user_id FROM users WHERE role='Customer';
 INSERT INTO restaurant_profiles(user_id,rest_title,rest_address,longitude,latitude,opens_at,closes_at,activation_status)
 SELECT user_id,'Smoke Kitchen','Ismailia pickup',32.28,30.60,'00:00:00','23:59:59','Active' FROM users WHERE role='Restaurant';
 INSERT INTO delivery_company_profiles(user_id,company_name,company_phone,company_address)
 SELECT user_id,'Smoke Delivery','+201000000005','Ismailia dispatch' FROM users WHERE role='Delivery_Company';
 INSERT INTO categories(rest_id,cat_title) SELECT rest_id,'Meals' FROM restaurant_profiles;
 INSERT INTO products(rest_id,cat_id,prod_name,price) SELECT rest_id,cat_id,'Smoke Meal',100.00 FROM categories;
 `,
  ]);
  docker([
    'up',
    '-d',
    '--no-deps',
    '--force-recreate',
    '--wait',
    '--wait-timeout',
    '90',
    'api',
  ]);
  const browser = await chromium.launch();
  // Local smoke certificates are trusted separately by the Node HTTPS checks.
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: 'ar-EG',
    timezoneId: 'Africa/Cairo',
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  async function call(path, body, token) {
    const response = await context.request.post(
      `https://localhost:${port}/api/v1${path}`,
      {
        data: body,
        headers: token ? { Authorization: 'Bearer ' + token } : {},
      },
    );
    const result = await response.json();
    assert.equal(
      response.ok(),
      true,
      `Real API ${path} failed (${response.status()}): ${result.error?.code}`,
    );
    return result.data;
  }
  async function open(app, email) {
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(`https://${app}.localhost:${port}/`);
    await page.getByLabel('البريد الإلكتروني', { exact: true }).fill(email);
    await page
      .getByLabel('كلمة المرور', { exact: true })
      .fill('SmokeOnlyPassword123');
    await page
      .getByRole('button', { name: 'تسجيل الدخول', exact: true })
      .click();
    return page;
  }
  try {
    const admin = await open('admin', 'smoke@example.com');
    await expect(
      admin.getByRole('heading', { name: 'نظرة عامة', exact: true }),
    ).toBeVisible();
    const delivery = await open('delivery', 'delivery-smoke@example.com');
    await expect(
      delivery.getByRole('heading', { name: 'نظرة عامة', exact: true }),
    ).toBeVisible();
    const vendor = await open('vendor', 'vendor-smoke@example.com');
    await expect(
      vendor.getByRole('button', { name: 'الطلبات', exact: true }),
    ).toBeVisible();
    await admin
      .getByRole('navigation')
      .getByRole('button', { name: 'الطلبات', exact: true })
      .click();
    await delivery
      .getByRole('navigation')
      .getByRole('button', { name: 'طلبات الشركة', exact: true })
      .click();
    await vendor.getByRole('button', { name: 'الطلبات', exact: true }).click();
    await expect(admin.getByText('متصل لحظيًا', { exact: true })).toBeVisible();
    await expect(
      delivery.getByText('متصل لحظيًا', { exact: true }),
    ).toBeVisible();
    const customer = await call('/auth/login', {
      email: 'customer-smoke@example.com',
      password: 'SmokeOnlyPassword123',
    });
    const token = customer.tokens.access_token;
    await call(
      '/customer/cart/items',
      { rest_id: '1', prod_id: '1', quantity: 1, addons: [] },
      token,
    );
    const order = await call(
      '/customer/orders',
      {
        delivery_address: {
          address_line: 'Ismailia smoke delivery',
          longitude: '32.28',
          latitude: '30.60',
        },
      },
      token,
    );
    await expect(
      admin.getByRole('cell', { name: '#' + order.order_id, exact: true }),
    ).toBeVisible();
    await expect(
      vendor.getByRole('cell', { name: '#' + order.order_id, exact: true }),
    ).toBeVisible();
    await vendor
      .getByRole('button', { name: 'عرض التفاصيل', exact: true })
      .click();
    await vendor
      .getByRole('button', { name: 'قبول الطلب', exact: true })
      .click();
    await vendor.getByRole('button', { name: 'تأكيد', exact: true }).click();
    await expect(
      delivery.getByRole('cell', { name: '#' + order.order_id, exact: true }),
    ).toBeVisible();
    await delivery
      .getByRole('navigation')
      .getByRole('button', { name: 'السائقون', exact: true })
      .click();
    await delivery
      .getByRole('button', { name: 'إضافة سائق', exact: true })
      .click();
    await delivery
      .getByLabel('اسم السائق', { exact: true })
      .fill('Smoke Driver');
    await delivery
      .getByLabel('رقم الهاتف', { exact: true })
      .fill('+201000000006');
    await delivery
      .getByRole('button', { name: 'حفظ السائق', exact: true })
      .click();
    await expect(delivery.getByText('تم حفظ بيانات السائق.')).toBeVisible();
    await delivery
      .getByRole('navigation')
      .getByRole('button', { name: 'طلبات الشركة', exact: true })
      .click();
    await delivery
      .getByRole('button', { name: 'عرض التفاصيل', exact: true })
      .click();
    await delivery
      .getByLabel('السائق', { exact: true })
      .selectOption({ label: 'Smoke Driver · +201000000006' });
    await delivery
      .getByRole('button', { name: 'إسناد السائق', exact: true })
      .click();
    await delivery
      .getByRole('button', { name: 'تأكيد تسليم الطلب', exact: true })
      .click();
    await delivery
      .getByRole('dialog')
      .getByRole('button', { name: 'تأكيد', exact: true })
      .click();
    await expect(delivery.locator('.detail-status')).toContainText(
      'تم التسليم',
    );
    await expect(
      admin.getByRole('row').filter({
        has: admin.getByRole('cell', {
          name: '#' + order.order_id,
          exact: true,
        }),
      }),
    ).toContainText('تم التسليم');
    await expect(vendor.getByRole('dialog')).toContainText('تم التوصيل');
    assert.deepEqual(
      errors,
      [],
      'Browser runtime/CSP errors in real production stack',
    );
    console.log(
      'Real frontend/API smoke passed: checkout → Restaurant accept → company driver creation/assignment → pickup → delivery, with live Admin/Restaurant updates over Caddy. No HTTP mocks.',
    );
  } finally {
    await context.close();
    await browser.close();
  }
}
