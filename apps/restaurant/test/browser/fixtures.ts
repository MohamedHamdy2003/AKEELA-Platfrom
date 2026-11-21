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
    else if (path === '/restaurant/analytics') {
      const range = url.searchParams.get('range') || '30d';
      const scale =
        range === 'today'
          ? 1
          : range === '7d'
            ? 3
            : range === '90d'
              ? 18
              : range === 'all'
                ? 24
                : 10;
      const days =
        range === 'today' ? 1 : range === '7d' ? 7 : range === '90d' ? 30 : 14;
      const daily_series = Array.from({ length: days }, (_, idx) => {
        const day = String(5 + idx).padStart(2, '0');
        const delivered = Math.max(
          1,
          Math.round(((idx % 4) + 2) * (scale / 3)),
        );
        const ordersCount = delivered + (idx % 3 === 0 ? 1 : 0);
        return {
          date: `2026-11-${day}`,
          orders: ordersCount,
          delivered,
          food_revenue: (delivered * 215).toFixed(2),
        };
      });
      const deliveredOrders = daily_series.reduce((s, p) => s + p.delivered, 0);
      const pending = 2;
      const accepted = 1;
      const pickedUp = 1;
      const rejected = Math.max(1, Math.round(deliveredOrders * 0.04));
      const cancelled = Math.max(1, Math.round(deliveredOrders * 0.05));
      const failed = 0;
      const totalOrders =
        deliveredOrders +
        pending +
        accepted +
        pickedUp +
        rejected +
        cancelled +
        failed;
      const foodRevenue = daily_series
        .reduce((s, p) => s + Number(p.food_revenue), 0)
        .toFixed(2);
      const grossGmv = (Number(foodRevenue) + deliveredOrders * 30).toFixed(2);
      const addonsRevenue = (Number(foodRevenue) * 0.14).toFixed(2);
      const avgOrder = (Number(foodRevenue) / deliveredOrders).toFixed(2);
      const decided = deliveredOrders + accepted + pickedUp + rejected;
      data = {
        range,
        generated_at: '2026-11-18T20:00:00+02:00',
        kpis: {
          food_revenue: foodRevenue,
          gross_gmv: grossGmv,
          addons_revenue: addonsRevenue,
          avg_order_value: avgOrder,
          total_orders: totalOrders,
          delivered_orders: deliveredOrders,
          rejected_orders: rejected,
          cancelled_orders: cancelled,
          acceptance_rate:
            Math.round(((decided - rejected) / decided) * 1000) / 10,
          completion_rate:
            Math.round((deliveredOrders / totalOrders) * 1000) / 10,
          rejection_rate: Math.round((rejected / totalOrders) * 1000) / 10,
          cancellation_rate: Math.round((cancelled / totalOrders) * 1000) / 10,
          unique_customers: Math.max(4, Math.round(deliveredOrders * 0.62)),
          repeat_customers: Math.max(2, Math.round(deliveredOrders * 0.26)),
          repeat_customer_rate: 41.9,
          avg_fulfillment_minutes: 31.6,
        },
        previous_kpis:
          range === 'all'
            ? null
            : {
                food_revenue: (Number(foodRevenue) * 0.85).toFixed(2),
                addons_revenue: (Number(addonsRevenue) * 0.82).toFixed(2),
                avg_order_value: (Number(avgOrder) * 0.96).toFixed(2),
                total_orders: Math.max(1, Math.round(totalOrders * 0.86)),
                delivered_orders: Math.max(
                  1,
                  Math.round(deliveredOrders * 0.85),
                ),
                avg_fulfillment_minutes: 34.8,
              },
        live_alerts: {
          pending_orders: pending,
          stale_pending_orders: 1,
          active_in_progress: accepted + pickedUp,
          inactive_products: 1,
          expiring_offers: 1,
        },
        status_breakdown: {
          Pending: pending,
          Accepted: accepted,
          Picked_Up: pickedUp,
          Delivered: deliveredOrders,
          Rejected: rejected,
          Cancelled: cancelled,
          Failed: failed,
        },
        daily_series,
        peak_hours: Array.from({ length: 24 }, (_, hour) => ({
          hour,
          orders:
            hour === 20
              ? 17
              : hour === 21
                ? 14
                : hour >= 13 && hour <= 22
                  ? 3 + (hour % 6)
                  : hour >= 10
                    ? 2
                    : 0,
        })),
        menu_totals: {
          active_categories: 4,
          active_products: 12,
          inactive_products: 1,
          active_addons: 6,
          active_offers: 2,
        },
        top_items: [
          {
            item_name: 'برجر مشوي مخصوص',
            item_type: 'product',
            units_sold: 46,
            revenue: '6900.00',
            share_pct: 42.5,
          },
          {
            item_name: 'وجبة عائلية مشويات',
            item_type: 'offer',
            units_sold: 18,
            revenue: '4860.00',
            share_pct: 29.9,
          },
        ],
        slow_items: [
          {
            prod_id: '205',
            prod_name: 'عصير جوافة فريش',
            cat_title: 'المشروبات',
            price: '35.00',
            units_sold: 0,
          },
        ],
        top_addons: [
          {
            addon_name: 'صوص شيدر سايح',
            units_sold: 38,
            revenue: '1140.00',
          },
          {
            addon_name: 'هالابينو حار',
            units_sold: 22,
            revenue: '330.00',
          },
        ],
        category_breakdown: [
          {
            cat_title: 'السندويتشات',
            units_sold: 64,
            revenue: '8960.00',
            share_pct: 55.2,
          },
          {
            cat_title: 'العروض',
            units_sold: 18,
            revenue: '4860.00',
            share_pct: 29.9,
          },
        ],
      };
    } else if (path === '/restaurant/profile') {
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
