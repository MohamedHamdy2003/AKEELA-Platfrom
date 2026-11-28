import { useEffect, useId, useRef, useState } from 'react';
import type { OrderDateFilters } from './screens';
import {
  arabicDigits,
  dateValue,
  latinDigits,
  monthDays,
} from './arabic-date-utils';
import './arabic-date-fields.css';

export { arabicDigits, dateValue, latinDigits, monthDays };

const months = Array.from({ length: 12 }, (_, index) =>
  new Intl.DateTimeFormat('ar-EG-u-ca-gregory', {
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(2024, index, 1))),
);
function parts(value: string) {
  const [year = '', month = '', day = ''] = value.split('-');
  return {
    year,
    month: month ? String(Number(month)) : '',
    day: day ? String(Number(day)) : '',
  };
}
function ArabicDate({
  label,
  value,
  min = '',
  change,
}: {
  label: string;
  value: string;
  min?: string;
  change: (value: string) => void;
}) {
  const [draft, setDraft] = useState(() => parts(value));
  const emitted = useRef(value);
  const hint = useId();
  useEffect(() => {
    if (value !== emitted.current) {
      setDraft(parts(value));
      emitted.current = value;
    }
  }, [value]);
  const year = latinDigits(draft.year);
  const days = draft.month
    ? monthDays(Number(draft.month), Number(year) || 2024)
    : 31;
  const complete = dateValue(draft.day, draft.month, year);
  const invalidDate =
    !!draft.day && !!draft.month && year.length === 4 && !complete;
  const rangeError = !!complete && !!min && complete < min;
  function update(key: keyof typeof draft, nextValue: string) {
    const next = { ...draft, [key]: nextValue };
    if (
      next.day &&
      next.month &&
      Number(next.day) >
        monthDays(Number(next.month), Number(latinDigits(next.year)) || 2024)
    )
      next.day = '';
    setDraft(next);
    const result = dateValue(next.day, next.month, next.year);
    const nextEmitted = result && (!min || result >= min) ? result : '';
    if (nextEmitted !== emitted.current) {
      emitted.current = nextEmitted;
      change(nextEmitted);
    }
  }
  return (
    <fieldset className="field arabic-date">
      <legend>{label}</legend>
      <div className="arabic-date-parts">
        <select
          aria-label={`${label} — اليوم`}
          aria-describedby={hint}
          value={draft.day}
          onChange={(event) => update('day', event.target.value)}
        >
          <option value="">اليوم</option>
          {Array.from({ length: days }, (_, index) => (
            <option key={index + 1} value={index + 1}>
              {arabicDigits(index + 1)}
            </option>
          ))}
        </select>
        <select
          aria-label={`${label} — الشهر`}
          aria-describedby={hint}
          value={draft.month}
          onChange={(event) => update('month', event.target.value)}
        >
          <option value="">الشهر</option>
          {months.map((month, index) => (
            <option key={month} value={index + 1}>
              {month}
            </option>
          ))}
        </select>
        <input
          aria-label={`${label} — السنة`}
          aria-describedby={hint}
          aria-invalid={
            year.length === 4 && Number(year) < 1 ? true : undefined
          }
          type="text"
          inputMode="numeric"
          maxLength={4}
          placeholder="السنة"
          autoComplete="off"
          value={arabicDigits(draft.year)}
          onChange={(event) =>
            update(
              'year',
              latinDigits(event.target.value).replace(/[^0-9]/g, ''),
            )
          }
        />
      </div>
      <div className="arabic-date-foot">
        <small id={hint} role={rangeError || invalidDate ? 'alert' : undefined}>
          {rangeError
            ? 'اختر تاريخًا مساويًا لتاريخ البداية أو بعده.'
            : invalidDate
              ? 'اختر تاريخًا ميلاديًا صحيحًا.'
              : complete
                ? `التاريخ: ${arabicDigits(draft.day)} ${months[Number(draft.month) - 1]} ${arabicDigits(year)}`
                : ''}
        </small>
        {(draft.day || draft.month || draft.year) && (
          <button
            type="button"
            className="text-button"
            aria-label={`مسح ${label}`}
            onClick={() => {
              setDraft(parts(''));
              emitted.current = '';
              change('');
            }}
          >
            مسح
          </button>
        )}
      </div>
    </fieldset>
  );
}
export function ArabicDateFields({
  value,
  change,
}: {
  value: OrderDateFilters;
  change: (value: OrderDateFilters) => void;
}) {
  return (
    <>
      <ArabicDate
        label="من تاريخ"
        value={value.date_from}
        change={(date_from) =>
          change({
            date_from,
            date_to:
              date_from && value.date_to && value.date_to < date_from
                ? ''
                : value.date_to,
          })
        }
      />
      <ArabicDate
        label="إلى تاريخ"
        value={value.date_to}
        min={value.date_from}
        change={(date_to) => change({ ...value, date_to })}
      />
    </>
  );
}
