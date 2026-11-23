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
      is_active: true,
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
    else if (path === '/admin/analytics') {
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
        const o = Math.max(1, Math.round(((idx % 5) + 2) * (scale / 3)));
        const d = Math.max(1, o - 1);
        return {
          date: `2026-11-${day}`,
          orders: o,
          delivered: d,
          gmv: (d * 245).toFixed(2),
        };
      });
      const totalOrders = daily_series.reduce((acc, p) => acc + p.orders, 0);
      const deliveredOrders = daily_series.reduce(
        (acc, p) => acc + p.delivered,
        0,
      );
      const deliveredGmv = daily_series
        .reduce((acc, p) => acc + Number(p.gmv), 0)
        .toFixed(2);
      const deliveryFees = (deliveredOrders * 30).toFixed(2);
      const avgOrder = (Number(deliveredGmv) / deliveredOrders).toFixed(2);
      const rejected = Math.max(
        1,
        Math.floor((totalOrders - deliveredOrders) * 0.45),
      );
      const cancelled = Math.max(
        1,
        Math.floor((totalOrders - deliveredOrders) * 0.3),
      );
      const failed = 1;
      const accepted = 1;
      const pickedUp = 1;
      const activePending = Math.max(
        0,
        totalOrders -
          deliveredOrders -
          rejected -
          cancelled -
          failed -
          accepted -
          pickedUp,
      );
      const exactTotal =
        deliveredOrders +
        rejected +
        cancelled +
        failed +
        accepted +
        pickedUp +
        activePending;
      data = {
        range,
        generated_at: now,
        kpis: {
          delivered_gmv: deliveredGmv,
          delivery_fees_total: deliveryFees,
          avg_order_value: avgOrder,
          total_orders: exactTotal,
          delivered_orders: deliveredOrders,
          completion_rate:
            Math.round((deliveredOrders / exactTotal) * 1000) / 10,
          rejection_rate: Math.round((rejected / exactTotal) * 1000) / 10,
          cancellation_rate: Math.round((cancelled / exactTotal) * 1000) / 10,
          failure_rate: Math.round((failed / exactTotal) * 1000) / 10,
          new_customers: 4 * scale,
          new_restaurants: Math.max(1, Math.round(scale / 3)),
        },
        previous_kpis:
          range === 'all'
            ? null
            : {
                delivered_gmv: (Number(deliveredGmv) * 0.84).toFixed(2),
                delivery_fees_total: (Number(deliveryFees) * 0.85).toFixed(2),
                avg_order_value: (Number(avgOrder) * 0.96).toFixed(2),
                total_orders: Math.max(1, Math.round(exactTotal * 0.85)),
                delivered_orders: Math.max(
                  1,
                  Math.round(deliveredOrders * 0.84),
                ),
                new_customers: Math.max(1, Math.round(3 * scale)),
                new_restaurants: 1,
              },
        status_breakdown: {
          Pending: activePending,
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
              ? 18
              : hour === 21
                ? 15
                : hour >= 13 && hour <= 22
                  ? 4 + (hour % 6)
                  : hour >= 10
                    ? 2
                    : 0,
        })),
        top_restaurants: [
          {
            rest_id: '7',
            rest_title: 'مطعم بيت الشواية',
            total_orders: Math.max(5, Math.round(totalOrders * 0.45)),
            delivered_orders: Math.max(4, Math.round(deliveredOrders * 0.48)),
            rejected_orders: 1,
            rejection_rate: 4.5,
            gmv: (Number(deliveredGmv) * 0.5).toFixed(2),
          },
          {
            rest_id: '8',
            rest_title: 'كشري الأصيل',
            total_orders: Math.max(3, Math.round(totalOrders * 0.3)),
            delivered_orders: Math.max(2, Math.round(deliveredOrders * 0.32)),
            rejected_orders: 0,
            rejection_rate: 0,
            gmv: (Number(deliveredGmv) * 0.32).toFixed(2),
          },
        ],
        attention_restaurants: [
          {
            rest_id: '9',
            rest_title: 'برجر السريع',
            total_orders: 12,
            delivered_orders: 8,
            rejected_orders: 4,
            rejection_rate: 33.3,
            gmv: '1920.00',
          },
        ],
        top_items: [
          {
            rest_id: '7',
            rest_title: 'مطعم بيت الشواية',
            item_name: 'وجبة دجاج مشوي',
            units_sold: 28,
            revenue: '4200.00',
          },
          {
            rest_id: '8',
            rest_title: 'كشري الأصيل',
            item_name: 'طبق كشري مخصوص',
            units_sold: 41,
            revenue: '2460.00',
          },
        ],
        alerts: {
          stale_pending_orders: 1,
          stale_accepted_orders: 0,
          pending_restaurants: 1,
          unverified_companies: 0,
        },
        platform_totals: {
          total_users: 148,
          customers: 132,
          restaurants_total: 14,
          restaurants_active: 11,
          restaurants_pending: 1,
          restaurants_suspended: 2,
          delivery_companies: 1,
          active_drivers: 8,
          inactive_drivers: 2,
        },
      };
    } else if (path === '/delivery-company/analytics') {
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
        const failed = idx % 7 === 0 ? 1 : 0;
        const assigned = delivered + failed + (idx === days - 1 ? 3 : 0);
        return {
          date: `2026-11-${day}`,
          assigned,
          delivered,
          failed,
          delivery_fees: (delivered * 30).toFixed(2),
        };
      });
      const deliveredOrders = daily_series.reduce((s, p) => s + p.delivered, 0);
      const failedOrders = daily_series.reduce((s, p) => s + p.failed, 0);
      const acceptedCount = 2;
      const pickedUpCount = 1;
      const assignedOrders =
        deliveredOrders + failedOrders + acceptedCount + pickedUpCount;
      const closed = deliveredOrders + failedOrders;
      const feesEarned = (deliveredOrders * 30).toFixed(2);
      const codValue = (deliveredOrders * 235).toFixed(2);
      data = {
        range,
        generated_at: now,
        kpis: {
          delivery_fees_earned: feesEarned,
          avg_delivery_fee: '30.00',
          cod_collected_value: codValue,
          assigned_orders: assignedOrders,
          delivered_orders: deliveredOrders,
          failed_orders: failedOrders,
          delivery_success_rate:
            Math.round((deliveredOrders / closed) * 1000) / 10,
          failure_rate: Math.round((failedOrders / closed) * 1000) / 10,
          avg_fulfillment_minutes: range === '7d' ? 31.4 : 33.8,
        },
        previous_kpis:
          range === 'all'
            ? null
            : {
                delivery_fees_earned: (Number(feesEarned) * 0.86).toFixed(2),
                cod_collected_value: (Number(codValue) * 0.85).toFixed(2),
                assigned_orders: Math.max(1, Math.round(assignedOrders * 0.86)),
                delivered_orders: Math.max(
                  1,
                  Math.round(deliveredOrders * 0.86),
                ),
                failed_orders: Math.max(1, failedOrders + 1),
                avg_fulfillment_minutes: 37.9,
              },
        live_queue: {
          unassigned_accepted: acceptedCount,
          in_transit: pickedUpCount,
          stale_unassigned: 1,
          long_in_transit: 0,
          inactive_driver_orders: 0,
        },
        status_breakdown: {
          Accepted: acceptedCount,
          Picked_Up: pickedUpCount,
          Delivered: deliveredOrders,
          Failed: failedOrders,
        },
        daily_series,
        peak_hours: Array.from({ length: 24 }, (_, hour) => ({
          hour,
          orders:
            hour === 20
              ? 19
              : hour === 21
                ? 16
                : hour >= 13 && hour <= 22
                  ? 3 + (hour % 6)
                  : hour >= 10
                    ? 2
                    : 0,
        })),
        fleet: {
          total_drivers: 8,
          active_drivers: 7,
          inactive_drivers: 1,
          busy_drivers: 3,
          idle_active_drivers: 4,
        },
        driver_leaderboard: [
          {
            driver_id: '11',
            driver_name: 'أحمد محمود',
            driver_phone: '+201000000011',
            is_active: true,
            current_load: 1,
            delivered_orders: Math.max(4, Math.round(deliveredOrders * 0.45)),
            failed_orders: 0,
            delivery_fees: (
              Math.max(4, Math.round(deliveredOrders * 0.45)) * 30
            ).toFixed(2),
            avg_fulfillment_minutes: 29.5,
            success_rate: 100,
          },
          {
            driver_id: '12',
            driver_name: 'كريم عبد الله',
            driver_phone: '+201000000012',
            is_active: true,
            current_load: 2,
            delivered_orders: Math.max(3, Math.round(deliveredOrders * 0.35)),
            failed_orders: 1,
            delivery_fees: (
              Math.max(3, Math.round(deliveredOrders * 0.35)) * 30
            ).toFixed(2),
            avg_fulfillment_minutes: 34.2,
            success_rate: 96.4,
          },
          {
            driver_id: '13',
            driver_name: 'مصطفى سامي',
            driver_phone: '+201000000013',
            is_active: true,
            current_load: 0,
            delivered_orders: Math.max(2, Math.round(deliveredOrders * 0.2)),
            failed_orders: 0,
            delivery_fees: (
              Math.max(2, Math.round(deliveredOrders * 0.2)) * 30
            ).toFixed(2),
            avg_fulfillment_minutes: 36.1,
            success_rate: 100,
          },
        ],
        top_pickup_restaurants: [
          {
            rest_id: '7',
            rest_title: 'مطعم بيت الشواية',
            assigned_orders: Math.max(4, Math.round(assignedOrders * 0.48)),
            delivered_orders: Math.max(3, Math.round(deliveredOrders * 0.5)),
            failed_orders: 0,
            delivery_fees: (
              Math.max(3, Math.round(deliveredOrders * 0.5)) * 30
            ).toFixed(2),
          },
          {
            rest_id: '8',
            rest_title: 'كشري الأصيل',
            assigned_orders: Math.max(3, Math.round(assignedOrders * 0.32)),
            delivered_orders: Math.max(2, Math.round(deliveredOrders * 0.32)),
            failed_orders: 1,
            delivery_fees: (
              Math.max(2, Math.round(deliveredOrders * 0.32)) * 30
            ).toFixed(2),
          },
        ],
      };
    } else if (path.endsWith('/orders/counts')) {
      const counts = {
        Pending: 0,
        Accepted: 0,
        Picked_Up: 0,
        Delivered: 0,
        Rejected: 0,
        Cancelled: 0,
        Failed: 0,
      };
      for (const order of orders) {
        if (order.status in counts) {
          counts[order.status as keyof typeof counts] += 1;
        }
      }
      data = counts;
    } else if (path.endsWith('/orders')) {
      const restIdFilter = url.searchParams.get('rest_id');
      const list = orders.filter(
        (order) =>
          (!url.searchParams.get('status') ||
            order.status === url.searchParams.get('status')) &&
          (!restIdFilter || order.rest_id === restIdFilter),
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
      if (method === 'PUT') {
        order.driver_id = body.driver_id;
        order.status = 'Picked_Up';
      }
      data = order;
    } else if (/^\/admin\/restaurants\/\d+\/analytics$/.test(path)) {
      const dateFrom = url.searchParams.get('date_from');
      const dateTo = url.searchParams.get('date_to');
      const range =
        dateFrom && dateTo ? 'custom' : url.searchParams.get('range') || '30d';
      const daily_series = [
        {
          date: dateFrom || '2026-11-10',
          orders: 6,
          delivered: 5,
          food_revenue: '1250.00',
          delivery_fees: '150.00',
          gross_gmv: '1400.00',
        },
        {
          date: dateTo || '2026-11-11',
          orders: 8,
          delivered: 7,
          food_revenue: '1750.00',
          delivery_fees: '210.00',
          gross_gmv: '1960.00',
        },
      ];
      data = {
        range,
        ...(dateFrom && dateTo ? { date_from: dateFrom, date_to: dateTo } : {}),
        generated_at: now,
        kpis: {
          food_revenue: '3000.00',
          delivery_fees_total: '360.00',
          gross_gmv: '3360.00',
          addons_revenue: '240.00',
          avg_order_value: '250.00',
          total_orders: 14,
          delivered_orders: 12,
          rejected_orders: 1,
          cancelled_orders: 1,
          acceptance_rate: 92.3,
          completion_rate: 85.7,
          rejection_rate: 7.1,
          cancellation_rate: 7.1,
          unique_customers: 9,
          repeat_customers: 3,
          repeat_customer_rate: 33.3,
          avg_fulfillment_minutes: 31.5,
        },
        previous_kpis:
          range === 'all'
            ? null
            : {
                food_revenue: '2600.00',
                addons_revenue: '200.00',
                avg_order_value: '240.00',
                total_orders: 12,
                delivered_orders: 10,
                avg_fulfillment_minutes: 34.0,
              },
        live_alerts: {
          pending_orders: 1,
          stale_pending_orders: 0,
          active_in_progress: 2,
          inactive_products: 1,
          expiring_offers: 0,
        },
        status_breakdown: {
          Pending: 0,
          Accepted: 0,
          Picked_Up: 0,
          Delivered: 12,
          Rejected: 1,
          Cancelled: 1,
          Failed: 0,
        },
        daily_series,
        peak_hours: Array.from({ length: 24 }, (_, hour) => ({
          hour,
          orders: hour === 20 ? 5 : hour === 21 ? 4 : 0,
        })),
        menu_totals: {
          active_categories: 4,
          active_products: 18,
          inactive_products: 1,
          active_addons: 6,
          active_offers: 2,
        },
        top_items: [
          {
            item_name: 'وجبة دجاج مشوي',
            item_type: 'product',
            units_sold: 14,
            revenue: '2100.00',
            share_pct: 70,
          },
        ],
        slow_items: [],
        top_addons: [
          {
            addon_name: 'صوص ثومية',
            units_sold: 12,
            revenue: '240.00',
          },
        ],
        category_breakdown: [
          {
            cat_title: 'المشويات',
            units_sold: 14,
            revenue: '2100.00',
            share_pct: 70,
          },
        ],
      };
    } else if (path === '/admin/restaurants') {
      const allRows = [
        {
          owner: user,
          profile: restaurantProfile,
        },
      ];
      const search = (url.searchParams.get('search') || '')
        .trim()
        .toLowerCase();
      const filtered = search
        ? allRows.filter(
            (row) =>
              row.profile.rest_title.toLowerCase().includes(search) ||
              row.owner.full_name.toLowerCase().includes(search),
          )
        : allRows;
      data = filtered;
      total = filtered.length;
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
    } else if (path === '/delivery-company/profile') {
      if (method === 'PATCH' && body && typeof body === 'object') {
        Object.assign(user.profile, body);
      }
      data = user.profile;
    } else if (path.startsWith('/auth/')) data = null;
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
