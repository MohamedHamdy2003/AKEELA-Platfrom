export const cairo = 'Africa/Cairo';
export function dateTime(value: string) {
  return new Intl.DateTimeFormat('ar-EG', {
    timeZone: cairo,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
export function formatDate(value: string) {
  return new Intl.DateTimeFormat('ar-EG', {
    timeZone: cairo,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}
export function cairoDate(value: string | Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: cairo,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(typeof value === 'string' ? new Date(value) : value);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function today() {
  return new Intl.DateTimeFormat('ar-EG', {
    timeZone: cairo,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}
export function cairoGreeting(now = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: cairo,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(now),
  );
  return hour >= 4 && hour < 12 ? 'صباح الخير' : 'مساء الخير';
}
export function money(value: string) {
  const [whole, fraction = ''] = value.split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction.padEnd(2, '0')} ج.م`;
}
export function sumMoney(values: string[]) {
  const cents = values.reduce((sum, value) => {
    const [whole, fraction = ''] = value.split('.');
    return sum + BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  }, 0n);
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}
export function cairoLocal(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: cairo,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
// Match Cairo wall time, including DST gaps/overlaps, independently of browser TZ.
export function cairoISO(local: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    throw new Error('أدخل تاريخًا ووقتًا صالحين بتوقيت القاهرة.');
  const naive = Date.parse(local + ':00Z');
  const candidates = [120, 180].map(
    (offset) => new Date(naive - offset * 60000),
  );
  const matches = candidates.filter(
    (date) =>
      Number.isFinite(date.getTime()) &&
      cairoLocal(date.toISOString()) === local,
  );
  if (matches.length !== 1)
    throw new Error(
      'هذا الوقت غير موجود أو مكرر بسبب تغيير التوقيت. اختر وقتًا آخر.',
    );
  return matches[0].toISOString();
}
export function cairoStartOfDayISO(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr))
    throw new Error('أدخل تاريخًا صالحًا بتوقيت القاهرة.');
  try {
    return cairoISO(dateStr + 'T00:00');
  } catch {
    // Handle Egypt DST spring-forward gap at 00:00 -> 01:00.
    return cairoISO(dateStr + 'T01:00');
  }
}
export function cairoEndOfDayISO(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr))
    throw new Error('أدخل تاريخًا صالحًا بتوقيت القاهرة.');
  const naive = Date.parse(dateStr + 'T23:59:59Z');
  const candidates = [120, 180].map(
    (offset) => new Date(naive - offset * 60000),
  );
  const match = candidates.find(
    (date) =>
      Number.isFinite(date.getTime()) &&
      cairoLocal(date.toISOString()) === dateStr + 'T23:59',
  );
  if (!match) throw new Error('أدخل تاريخًا صالحًا بتوقيت القاهرة.');
  return match.toISOString();
}
