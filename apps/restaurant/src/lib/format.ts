export const cairo = 'Africa/Cairo';

const dateTimeFormatter = new Intl.DateTimeFormat('ar-EG', {
  timeZone: cairo,
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const dateFormatter = new Intl.DateTimeFormat('ar-EG', {
  timeZone: cairo,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const cairoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: cairo,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const todayFormatter = new Intl.DateTimeFormat('ar-EG', {
  timeZone: cairo,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const cairoLocalFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: cairo,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function dateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return dateTimeFormatter.format(parsed);
}
export function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return dateFormatter.format(parsed);
}
export function cairoDate(value: string | Date = new Date()): string {
  const parsed = typeof value === 'string' ? new Date(value) : value;
  const parts = cairoDateFormatter.formatToParts(parsed);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function today() {
  return todayFormatter.format(new Date());
}
export function parseMoneyCents(value: string): bigint | null {
  const trimmed = value.trim();
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match) return null;
  const sign = match[1] === '-' ? -1n : 1n;
  const whole = BigInt(match[2]!);
  const frac = BigInt((match[3] ?? '').padEnd(2, '0'));
  return sign * (whole * 100n + frac);
}
export function money(value: string | null | undefined) {
  if (!value) return '0.00 ج.م';
  const [whole = '0', fraction = ''] = String(value).split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction.slice(0, 2).padEnd(2, '0')} ج.م`;
}
export function sumMoney(values: string[]) {
  const cents = values.reduce((sum, value) => {
    const parsed = parseMoneyCents(value);
    return sum + (parsed ?? 0n);
  }, 0n);
  const sign = cents < 0n ? '-' : '';
  const abs = cents < 0n ? -cents : cents;
  return `${sign}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
}
export function cairoLocal(value: string) {
  const parts = cairoLocalFormatter.formatToParts(new Date(value));
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
