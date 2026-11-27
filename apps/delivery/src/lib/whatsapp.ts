import type { Driver, Order } from '@akeela/portal/models';

const ARABIC_INDIC_DIGITS = /[٠-٩]/g;

function normalizeDigits(value: string): string {
  return value.replace(ARABIC_INDIC_DIGITS, (digit) =>
    String(digit.charCodeAt(0) - 0x0660),
  );
}

function formatMoney(value: string): string {
  const [whole, fraction = '00'] = value.split('.');
  return (
    whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',') +
    '.' +
    fraction.padEnd(2, '0').slice(0, 2) +
    ' EGP'
  );
}

function googleMapsUrl(latitude: string, longitude: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
}

/**
 * Normalizes Egyptian and international phone numbers into wa.me digits-only format
 * (country code + national number, no leading `+` or `00`).
 */
export function normalizeWhatsAppPhone(phone: string): string | null {
  const cleaned = normalizeDigits(phone).replace(/[^\d+]/g, '');
  if (!cleaned) return null;

  let digits = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  // Local Egyptian mobile format: 010/011/012/015xxxxxxxx -> 201xxxxxxxxx
  if (/^01[0125]\d{8}$/.test(digits)) {
    digits = '2' + digits;
  }

  if (!/^\d{8,15}$/.test(digits)) {
    return null;
  }

  return digits;
}

export function buildDriverOrderWhatsAppMessage(
  order: Order,
  driver?: Pick<Driver, 'driver_name'>,
): string {
  const lines: string[] = [`*طلب توصيل جديد — رقم ${order.order_id}*`];

  if (driver?.driver_name?.trim()) {
    lines.push(`السائق: ${driver.driver_name.trim()}`);
  }

  if (order.pickup) {
    lines.push(
      '',
      `*المطعم (الاستلام):* ${order.pickup.rest_title}`,
      `العنوان: ${order.pickup.rest_address}`,
      `الموقع: ${googleMapsUrl(order.pickup.latitude, order.pickup.longitude)}`,
    );
  }

  lines.push(
    '',
    '*التوصيل (العميل):*',
    `العنوان: ${order.customer_address}`,
    `الموقع: ${googleMapsUrl(order.delivery_latitude, order.delivery_longitude)}`,
  );

  if (order.notes?.trim()) {
    lines.push('', '*ملاحظات العميل:*', order.notes.trim());
  }

  if (order.items.length > 0) {
    lines.push('', '*الأصناف:*');
    for (const item of order.items) {
      lines.push(`• ${item.item_name} × ${item.quantity}`);
      for (const addon of item.addons) {
        lines.push(`  + ${addon.addon_name} × ${addon.quantity}`);
      }
    }
  }

  lines.push(
    '',
    `*المبلغ المطلوب تحصيله:* ${formatMoney(order.total_price)} (شامل التوصيل ${formatMoney(order.delivery_fee)})`,
  );

  return lines.join('\n');
}

export function buildDriverOrderWhatsAppUrl(
  order: Order,
  driver?: Pick<Driver, 'driver_name' | 'driver_phone'>,
): string | null {
  if (!driver?.driver_phone) return null;
  const phone = normalizeWhatsAppPhone(driver.driver_phone);
  if (!phone) return null;
  const text = buildDriverOrderWhatsAppMessage(order, driver);
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
