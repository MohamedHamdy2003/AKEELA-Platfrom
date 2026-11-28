const western = '0123456789';
const eastern = '٠١٢٣٤٥٦٧٨٩';
const persian = '۰۱۲۳۴۵۶۷۸۹';

export function latinDigits(value: string) {
  return value.replace(
    /[٠-٩۰-۹]/g,
    (digit) =>
      western[
        eastern.indexOf(digit) >= 0
          ? eastern.indexOf(digit)
          : persian.indexOf(digit)
      ]!,
  );
}

export function arabicDigits(value: string | number) {
  return String(value).replace(/[0-9]/g, (digit) => eastern[Number(digit)]!);
}

export function monthDays(month: number, year: number) {
  if (month === 2)
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function dateValue(day: string, month: string, year: string) {
  const normalized = latinDigits(year);
  if (
    !/^[0-9]{4}$/.test(normalized) ||
    Number(normalized) < 1 ||
    !/^[0-9]{1,2}$/.test(day) ||
    !/^[0-9]{1,2}$/.test(month) ||
    Number(day) < 1 ||
    Number(month) < 1 ||
    Number(month) > 12 ||
    !day ||
    !month
  )
    return '';
  if (Number(day) > monthDays(Number(month), Number(normalized))) return '';
  return `${normalized}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}
