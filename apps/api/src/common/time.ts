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
export function cairoTimestamp(date: Date): string {
  const p = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  const offset = Math.round(
    (Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour),
      Number(p.minute),
      Number(p.second),
    ) -
      Math.floor(date.getTime() / 1000) * 1000) /
      60000,
  );
  const sign = offset >= 0 ? '+' : '-';
  const n = Math.abs(offset);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}.${date.getUTCMilliseconds().toString().padStart(3, '0')}${sign}${Math.floor(
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
    /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  )
    return cairoTimestamp(new Date(value));
  if (Array.isArray(value)) return value.map((item) => localize(item));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([name, item]) => [name, localize(item, name)]),
    );
  return value;
}
@Injectable()
export class CairoTimeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(map((value) => localize(value)));
  }
}
