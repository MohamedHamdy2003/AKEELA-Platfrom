import { expect, type Page } from '@playwright/test';
export const profile = {
  rest_id: '10',
  rest_title: 'مطبخ أكيلة',
  rest_description: 'مطبخ يومي',
  rest_address: 'شارع التحرير، الإسماعيلية',
  longitude: '32.2723000',
  latitude: '30.5965000',
  opens_at: '10:00:00',
  closes_at: '02:00:00',
  rest_image_url_mobile: null,
  is_active: true,
  activation_status: 'Active',
};
const orders = ['Pending', 'Accepted', 'Picked_Up', 'Delivered'].map(
  (status, i) => ({
    order_id: String(1084 - i),
    status,
    total_price: ['250.00', '180.00', '320.00', '210.00'][i],
    created_at: `2026-11-14T${['10:42', '10:15', '09:37', '09:10'][i]}:00+02:00`,
    company_id: i ? '1' : null,
    driver_id: null,
  }),
);
export async function setup(page: Page, activation = 'Active') {
  // UI fixtures must not open real API sockets with fixture-only JWTs.
  // The production smoke suite covers the real Caddy/Socket.IO connection.
  await page.routeWebSocket(/\/socket\.io\//, (socket) => {
    socket.send(
      '0' +
        JSON.stringify({
          sid: 'restaurant-fixture',
          upgrades: [],
          pingInterval: 25000,
          pingTimeout: 20000,
          maxPayload: 1024,
        }),
    );
    socket.onMessage((message) => {
      if (String(message).startsWith('40/orders,'))
        socket.send(
          '40/orders,' + JSON.stringify({ sid: 'restaurant-orders' }),
        );
    });
  });
  const writes: { path: string; body: unknown }[] = [];
  let orderStatus = 'Pending';
  let serviceActive = true;
  let savedProfile = { ...profile };
  const categories = [
    {
      cat_id: '100',
      cat_title: 'السندويتشات',
      display_order: 0,
      is_active: true,
    },
  ];
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    const method = request.method();
    let body: Record<string, unknown> = {};
    if (
      request.postData() &&
      !request.headers()['content-type']?.includes('multipart')
    )
      body = request.postDataJSON();
    if (method !== 'GET') writes.push({ path, body });
    let data: unknown;
    let meta: unknown;
    if (path === '/auth/login')
      data = {
        user: {
          user_id: '20',
          full_name: 'مالك المطعم',
          email: 'owner@example.com',
          phone: '+201000000000',
          role: 'Restaurant',
          profile: { ...profile, activation_status: activation },
        },
        tokens: {
          access_token: 'test-access',
          refresh_token: 'test-refresh',
          expires_in: 900,
          refresh_expires_in: 1000,
        },
      };
    else if (path === '/me' && method === 'GET')
      data = {
        user_id: '20',
        full_name: 'مالك المطعم',
        email: 'owner@example.com',
        phone: '+201000000000',
        role: 'Restaurant',
        profile: { ...profile, activation_status: activation },
      };
    else if (path === '/restaurant/dashboard')
      data = {
        rest_id: '10',
        activation_status: activation,
        can_manage: activation === 'Active',
        message:
          activation === 'Active'
            ? 'Your restaurant is active and ready to manage.'
            : 'Your restaurant is waiting for Admin activation.',
      };
    else if (path === '/restaurant/profile') {
      if (method === 'PATCH') savedProfile = { ...savedProfile, ...body };
      if (method === 'PATCH' && typeof body.is_active === 'boolean')
        serviceActive = body.is_active;
      data = {
        ...savedProfile,
        is_active: serviceActive,
        activation_status: activation,
        ...body,
      };
    } else if (path === '/restaurant/orders') {
      data = url.searchParams.get('status')
        ? orders.filter((o) => o.status === url.searchParams.get('status'))
        : orders;
      meta = {
        page: 1,
        per_page: 20,
        total: (data as unknown[]).length,
        last_page: 1,
      };
    } else if (path.endsWith('/accept')) {
      orderStatus = 'Accepted';
      data = {
        order_id: '1084',
        status: orderStatus,
        company_id: '1',
        driver_id: null,
      };
    } else if (path === '/restaurant/orders/1084')
      data = {
        ...orders[0],
        status: orderStatus,
        delivery_fee: '30.00',
        customer_address: 'شارع التحرير، الإسماعيلية',
        notes: 'بدون بصل',
        items: [
          {
            order_item_id: '90',
            item_name: 'برجر مشوي',
            quantity: 2,
            unit_price: '100.00',
            subtotal: '200.00',
            addons: [
              {
                order_item_addon_id: '91',
                addon_name: 'إضافة جبنة',
                quantity: 2,
                unit_price: '10.00',
                subtotal: '20.00',
              },
            ],
          },
        ],
      };
    else if (path === '/restaurant/categories' && method === 'GET') {
      data = categories;
      meta = { page: 1, per_page: 20, total: categories.length, last_page: 1 };
    } else if (path.startsWith('/restaurant/categories') && method !== 'GET') {
      const row = { cat_id: '101', ...body };
      categories.push(row as (typeof categories)[number]);
      data = row;
    } else if (path === '/restaurant/products') {
      data = method === 'GET' ? [] : { prod_id: '200', ...body };
      meta = { page: 1, per_page: 20, total: 0, last_page: 1 };
    } else if (path === '/restaurant/addons' || path === '/restaurant/offers') {
      data =
        method === 'GET' ? [] : { addon_id: '300', offer_id: '400', ...body };
      meta = { page: 1, per_page: 20, total: 0, last_page: 1 };
    } else if (path.startsWith('/auth/')) data = null;
    else
      throw new Error('Unexpected mocked API request: ' + method + ' ' + path);
    await route.fulfill({
      status:
        method === 'POST' &&
        !path.startsWith('/auth') &&
        !path.endsWith('/accept')
          ? 201
          : 200,
      json: {
        success: true,
        message: 'Request completed.',
        data,
        ...(meta ? { meta } : {}),
      },
    });
  });
  return writes;
}
export async function login(page: Page) {
  await page.goto('/');
  await page
    .getByLabel('البريد الإلكتروني', { exact: true })
    .fill('owner@example.com');
  await page.getByLabel('كلمة المرور', { exact: true }).fill('Password123');
  await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'صباح الخير، مطبخ أكيلة' }),
  ).toBeVisible();
}

export async function mockMapTiles(page: Page) {
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
        'base64',
      ),
    }),
  );
}
