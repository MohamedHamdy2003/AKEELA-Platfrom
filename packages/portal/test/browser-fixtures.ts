import type { Page, WebSocketRoute } from '@playwright/test';
export async function portalFixture(
  page: Page,
  role: 'Admin' | 'Delivery_Company',
  restaurantImageUrl: string | null = null,
) {
  const now = '2026-11-18T12:30:00+02:00';
  const user = {
    user_id: '1',
    full_name: role === 'Admin' ? 'محمد أحمد' : 'مسؤول التوصيل',
    email: 'operator@example.com',
    phone: '+201000000001',
    role,
    is_active: true,
    email_verified_at: now,
    profile: {
      company_id: '3',
      company_name: 'شركة أكيلة للتوصيل',
      company_address: 'الإسماعيلية',
      company_phone: '+201000000003',
      company_email: null,
    },
  };
  const driver = {
    driver_id: '11',
    company_id: '3',
    driver_name: 'أحمد محمود',
    driver_phone: '+201000000011',
    driver_email: null,
    is_active: true,
  };
  const restaurantProfile = {
    rest_id: '7',
    rest_title: 'مطعم بيت الشواية',
    rest_description: 'وجبات ومشويات',
    rest_address: 'الإسماعيلية',
    longitude: '32.2700000',
    latitude: '30.5900000',
    opens_at: '10:00:00',
    closes_at: '23:00:00',
    rest_image_url_mobile: restaurantImageUrl,
    is_active: true,
    activation_status: 'Pending',
    created_at: now,
    updated_at: now,
  };
  const orders = Array.from({ length: 6 }, (_, index) => ({
    order_id: String(1248 - index),
    rest_id: '7',
    customer_id: '9',
    company_id: '3',
    driver_id: index === 0 ? null : '11',
    status:
      index === 0
        ? 'Accepted'
        : index === 1
          ? 'Picked_Up'
          : index === 2
            ? 'Pending'
            : 'Delivered',
    total_price: ['240.00', '180.00', '320.00'][index % 3]!,
    delivery_fee: '30.00',
    customer_address: 'شارع الجمهورية، الإسماعيلية',
    delivery_longitude: '32.2720000',
    delivery_latitude: '30.5960000',
    notes: 'الاتصال عند الوصول',
    created_at: now,
    updated_at: now,
    items: [
      {
        order_item_id: '1',
        item_name: 'وجبة دجاج مشوي',
        quantity: 2,
        unit_price: '100.00',
        subtotal: '200.00',
        addons: [
          {
            order_item_addon_id: '1',
            addon_name: 'صوص إضافي',
            quantity: 1,
            unit_price: '10.00',
            subtotal: '10.00',
          },
        ],
      },
    ],
    ...(role === 'Delivery_Company'
      ? {
          pickup: {
            rest_title: 'مطعم بيت الشواية',
            rest_address: 'شارع السلطان حسين، الإسماعيلية',
            longitude: '32.2700000',
            latitude: '30.5900000',
          },
        }
      : {}),
  }));
  let socket: WebSocketRoute | undefined;
  await page.routeWebSocket(/\/socket\.io\//, (ws) => {
    socket = ws;
    ws.send(
      '0' +
        JSON.stringify({
          sid: 'fixture',
          upgrades: [],
          pingInterval: 25000,
          pingTimeout: 20000,
          maxPayload: 1024,
        }),
    );
    ws.onMessage((message) => {
      if (String(message).startsWith('40/orders,'))
        ws.send('40/orders,' + JSON.stringify({ sid: 'fixture-orders' }));
      if (message === '2') ws.send('3');
    });
  });
  const calls: Array<{ path: string; method: string; body: unknown }> = [];
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname.replace('/api/v1', ''),
      method = request.method(),
      body = request.postDataJSON();
    calls.push({ path, method, body });
    let data: unknown;
    let total: number | undefined;
    if (path === '/auth/login')
      data = {
        user,
        tokens: {
          access_token: 'fixture-only',
          refresh_token: 'fixture-only-refresh',
          expires_in: 900,
          refresh_expires_in: 2592000,
        },
      };
    else if (path === '/me') data = user;
    else if (path === '/auth/logout') data = null;
    else if (path.endsWith('/orders')) {
      const list = orders.filter(
        (order) =>
          !url.searchParams.get('status') ||
          order.status === url.searchParams.get('status'),
      );
      data = list;
      total = list.length;
    } else if (/\/orders\/\d+/.test(path)) {
      const order = orders.find((item) => item.order_id === path.split('/')[3]);
      if (!order) throw new Error('Unknown fixture order');
      if (method === 'POST')
        order.status = path.endsWith('/fail')
          ? 'Failed'
          : path.endsWith('/pickup')
            ? 'Picked_Up'
            : 'Delivered';
      if (method === 'PUT') order.driver_id = body.driver_id;
      data = order;
    } else if (path === '/admin/restaurants') {
      data = [
        {
          owner: user,
          profile: restaurantProfile,
        },
      ];
      total = 1;
    } else if (path.includes('/activation')) data = {};
    else if (path === '/admin/users') {
      if (method === 'POST')
        data = { ...user, user_id: '2', role: 'Delivery_Company' };
      else {
        data = [
          user,
          {
            ...user,
            user_id: '4',
            full_name: 'عميل أكيلة',
            role: 'Customer',
            email_verified_at: null,
          },
          {
            ...user,
            user_id: '5',
            full_name: 'مالك المطعم',
            role: 'Restaurant',
            profile: restaurantProfile,
          },
        ];
        total = 3;
      }
    } else if (path.startsWith('/admin/users/'))
      data = path.endsWith('/5')
        ? {
            ...user,
            user_id: '5',
            full_name: 'مالك المطعم',
            role: 'Restaurant',
            profile: restaurantProfile,
          }
        : {
            ...user,
            user_id: '4',
            full_name: 'عميل أكيلة',
            role: 'Customer',
            email_verified_at: null,
          };
    else if (path.startsWith('/delivery-company/drivers')) {
      if (method !== 'GET') {
        Object.assign(driver, body);
        data = driver;
      } else {
        data = [driver];
        total = 1;
      }
    } else if (path === '/delivery-company/profile') data = user.profile;
    else if (path.startsWith('/auth/')) data = null;
    else throw new Error('Unhandled fixture route ' + method + ' ' + path);
    await route.fulfill({
      json: {
        success: true,
        message: 'Records returned.',
        data,
        ...(total === undefined
          ? {}
          : { meta: { page: 1, per_page: 10, total, last_page: 1 } }),
      },
    });
  });
  return {
    calls,
    orders,
    notify: () =>
      socket?.send(
        '42/orders,' + JSON.stringify(['order.updated', { order_id: '1248' }]),
      ),
  };
}
export async function login(page: Page) {
  await page.goto('/');
  await page
    .getByLabel('البريد الإلكتروني', { exact: true })
    .fill('operator@example.com');
  await page.getByLabel('كلمة المرور', { exact: true }).fill('TestOnly123');
  await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  await page.getByRole('heading', { name: 'نظرة عامة', exact: true }).waitFor();
}
