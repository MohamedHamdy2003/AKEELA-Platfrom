import assert from 'node:assert/strict';
import test from 'node:test';

import type { Order } from '@akeela/portal/models';
import {
  buildDriverOrderWhatsAppMessage,
  buildDriverOrderWhatsAppUrl,
  normalizeWhatsAppPhone,
} from '../src/lib/whatsapp.ts';

const sampleOrder: Order = {
  order_id: '1248',
  rest_id: '7',
  customer_id: '9',
  company_id: '3',
  driver_id: '11',
  status: 'Picked_Up',
  total_price: '240.00',
  delivery_fee: '30.00',
  customer_address: 'شارع الجمهورية، الإسماعيلية',
  delivery_longitude: '32.2720000',
  delivery_latitude: '30.5960000',
  notes: 'الاتصال عند الوصول',
  created_at: '2026-11-18T12:30:00+02:00',
  updated_at: '2026-11-18T12:35:00+02:00',
  pickup: {
    rest_title: 'مطعم بيت الشواية',
    rest_address: 'شارع السلطان حسين، الإسماعيلية',
    longitude: '32.2700000',
    latitude: '30.5900000',
  },
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
};

test('normalizeWhatsAppPhone normalizes Egyptian, international, and Arabic-digit phone numbers', () => {
  assert.equal(normalizeWhatsAppPhone('+201000000011'), '201000000011');
  assert.equal(normalizeWhatsAppPhone('0020 100-000-0011'), '201000000011');
  assert.equal(normalizeWhatsAppPhone('01000000011'), '201000000011');
  assert.equal(normalizeWhatsAppPhone('٠١١٢٣٤٥٦٧٨٩'), '201123456789');
  assert.equal(normalizeWhatsAppPhone('+966501234567'), '966501234567');
  assert.equal(normalizeWhatsAppPhone('abc'), null);
  assert.equal(normalizeWhatsAppPhone('123'), null);
});

test('buildDriverOrderWhatsAppMessage includes all order details, maps links, addons, notes, and COD total', () => {
  const message = buildDriverOrderWhatsAppMessage(sampleOrder, {
    driver_name: 'أحمد محمود',
  });

  assert.match(message, /\*طلب توصيل جديد — رقم 1248\*/);
  assert.match(message, /السائق: أحمد محمود/);
  assert.match(message, /\*المطعم \(الاستلام\):\* مطعم بيت الشواية/);
  assert.match(message, /شارع السلطان حسين، الإسماعيلية/);
  assert.match(
    message,
    /https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=30\.5900000%2C32\.2700000/,
  );
  assert.match(message, /شارع الجمهورية، الإسماعيلية/);
  assert.match(
    message,
    /https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=30\.5960000%2C32\.2720000/,
  );
  assert.match(message, /الاتصال عند الوصول/);
  assert.match(message, /• وجبة دجاج مشوي × 2/);
  assert.match(message, /\+ صوص إضافي × 1/);
  assert.match(
    message,
    /\*المبلغ المطلوب تحصيله:\* 240\.00 EGP \(شامل التوصيل 30\.00 EGP\)/,
  );
});

test('buildDriverOrderWhatsAppMessage omits optional notes and pickup sections when absent', () => {
  const minimalOrder: Order = {
    ...sampleOrder,
    notes: null,
    pickup: undefined,
  };
  const message = buildDriverOrderWhatsAppMessage(minimalOrder);
  assert.doesNotMatch(message, /ملاحظات العميل/);
  assert.doesNotMatch(message, /المطعم \(الاستلام\)/);
  assert.doesNotMatch(message, /السائق:/);
});

test('buildDriverOrderWhatsAppUrl builds valid wa.me deep link and rejects invalid phones', () => {
  const url = buildDriverOrderWhatsAppUrl(sampleOrder, {
    driver_name: 'أحمد محمود',
    driver_phone: '+201000000011',
  });
  assert.ok(url);
  assert.ok(url.startsWith('https://wa.me/201000000011?text='));
  const decoded = decodeURIComponent(url.split('?text=')[1]!);
  assert.match(decoded, /مطعم بيت الشواية/);
  assert.match(decoded, /240\.00 EGP/);

  assert.equal(
    buildDriverOrderWhatsAppUrl(sampleOrder, {
      driver_name: 'أحمد محمود',
      driver_phone: 'invalid',
    }),
    null,
  );
});
