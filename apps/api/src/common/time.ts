import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map } from 'rxjs';
export const APP_TIME_ZONE = 'Africa/Cairo';
const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
const cairoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export function cairoDateString(date: Date = new Date()): string {
  return cairoDateFormatter.format(date);
}
export function msUntilNextCairoMidnight(now: Date = new Date()): number {
  const today = cairoDateString(now);
  const [y, m, d] = today.split('-').map(Number);
  const nextDay = new Date(Date.UTC(y!, m! - 1, d! + 1));
  const nextDate = nextDay.toISOString().slice(0, 10);
  // Check both Cairo winter (+02:00) and summer (+03:00) offsets for 00:00:05.
  const naive = Date.parse(`${nextDate}T00:00:05Z`);
  for (const offsetMinutes of [180, 120]) {
    const candidate = new Date(naive - offsetMinutes * 60_000);
    if (cairoDateString(candidate) === nextDate) {
      const diff = candidate.getTime() - now.getTime();
      if (diff > 0) {
        return Math.min(Math.max(diff, 1_000), 26 * 3_600_000);
      }
    }
  }
  return 60 * 60 * 1_000;
}
const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/;
export function cairoTimestamp(date: Date): string {
  let year = '';
  let month = '';
  let day = '';
  let hour = '';
  let minute = '';
  let second = '';
  for (const part of formatter.formatToParts(date)) {
    switch (part.type) {
      case 'year':
        year = part.value;
        break;
      case 'month':
        month = part.value;
        break;
      case 'day':
        day = part.value;
        break;
      case 'hour':
        hour = part.value;
        break;
      case 'minute':
        minute = part.value;
        break;
      case 'second':
        second = part.value;
        break;
    }
  }
  const offset = Math.round(
    (Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ) -
      Math.floor(date.getTime() / 1000) * 1000) /
      60000,
  );
  const sign = offset >= 0 ? '+' : '-';
  const n = Math.abs(offset);
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.${date.getUTCMilliseconds().toString().padStart(3, '0')}${sign}${Math.floor(
    n / 60,
  )
    .toString()
    .padStart(2, '0')}:${(n % 60).toString().padStart(2, '0')}`;
}
function localize(value: unknown, key = ''): unknown {
  if (value instanceof Date) return cairoTimestamp(value);
  if (
    typeof value === 'string' &&
    key.endsWith('_at') &&
    ISO_TIMESTAMP_RE.test(value)
  )
    return cairoTimestamp(new Date(value));
  if (Array.isArray(value)) {
    let changed = false;
    let out: unknown[] | undefined;
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      const next = localize(item);
      if (next !== item) {
        if (!changed) {
          changed = true;
          out = value.slice(0, i);
        }
      }
      if (out) out.push(next);
    }
    return out ?? value;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    let changed = false;
    let out: Record<string, unknown> | undefined;
    for (const name of Object.keys(record)) {
      const item = record[name];
      const next = localize(item, name);
      if (next !== item && !changed) {
        changed = true;
        out = { ...record };
      }
      if (out) out[name] = next;
    }
    return out ?? value;
  }
  return value;
}
@Injectable()
export class CairoTimeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(map((value) => localize(value)));
  }
}
