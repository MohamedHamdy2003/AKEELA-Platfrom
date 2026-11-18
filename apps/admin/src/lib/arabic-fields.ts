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
export function arabicFieldMessages(name: string, messages: string[]) {
  if (messages.every((message) => /\p{Script=Arabic}/u.test(message)))
    return messages;
  if (name === 'current_password') return ['راجع كلمة المرور الحالية.'];
  if (name.includes('password'))
    return ['استخدم كلمة مرور من ٨ إلى ١٢٨ حرفًا، تتضمن حرفًا ورقمًا.'];
  if (name.includes('email'))
    return ['أدخل بريدًا إلكترونيًا صحيحًا لا يزيد عن ٢٥٤ حرفًا.'];
  if (name.includes('phone') || name === 'tel')
    return [
      'أدخل رقم هاتف يبدأ بعلامة + ورمز الدولة، ويتكون من ٨ إلى ١٥ رقمًا.',
    ];
  if (name.includes('name')) return ['أدخل اسمًا من حرف واحد إلى ١٥٠ حرفًا.'];
  if (name.includes('address'))
    return ['أدخل عنوانًا من حرف واحد إلى ٢٠٠٠ حرف.'];
  return ['راجع البيانات وحاول مرة أخرى.'];
}
