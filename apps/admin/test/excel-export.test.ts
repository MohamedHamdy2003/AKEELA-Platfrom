import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRestaurantEarningsWorkbook } from '../src/lib/excel-export.ts';

test('buildRestaurantEarningsWorkbook generates a valid RTL OOXML .xlsx archive', () => {
  const bytes = buildRestaurantEarningsWorkbook({
    restId: '7',
    restTitle: 'مطعم بيت الشواية',
    ownerName: 'أحمد علي',
    periodLabel: 'من 2026-11-01 إلى 2026-11-02',
    analytics: {
      range: 'custom',
      date_from: '2026-11-01',
      date_to: '2026-11-02',
      generated_at: '2026-11-02T18:00:00.000Z',
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
      previous_kpis: null,
      live_alerts: {
        pending_orders: 0,
        stale_pending_orders: 0,
        active_in_progress: 0,
        inactive_products: 0,
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
      daily_series: [
        {
          date: '2026-11-01',
          orders: 6,
          delivered: 5,
          food_revenue: '1250.00',
          delivery_fees: '150.00',
          gross_gmv: '1400.00',
        },
        {
          date: '2026-11-02',
          orders: 8,
          delivered: 7,
          food_revenue: '1750.00',
          delivery_fees: '210.00',
          gross_gmv: '1960.00',
        },
      ],
      peak_hours: [],
      menu_totals: {
        active_categories: 3,
        active_products: 12,
        inactive_products: 1,
        active_addons: 4,
        active_offers: 1,
      },
      top_items: [
        {
          item_name: 'وجبة دجاج مشوي',
          item_type: 'product',
          units_sold: 10,
          revenue: '1500.00',
          share_pct: 50,
        },
      ],
      slow_items: [],
      top_addons: [],
      category_breakdown: [],
    },
  });

  // PKZIP local header signature "PK\x03\x04"
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  assert.equal(bytes[2], 0x03);
  assert.equal(bytes[3], 0x04);

  const decoded = new TextDecoder().decode(bytes);
  assert.ok(decoded.includes('[Content_Types].xml'));
  assert.ok(decoded.includes('xl/workbook.xml'));
  assert.ok(decoded.includes('xl/worksheets/sheet1.xml'));
  assert.ok(decoded.includes('xl/worksheets/sheet2.xml'));
  assert.ok(decoded.includes('rightToLeft="1"'));
  assert.ok(decoded.includes('مطعم بيت الشواية'));
  assert.ok(decoded.includes('التفصيل اليومي'));
  assert.ok(decoded.includes('<v>3360</v>'));
});
