export {
  latinDigits,
  arabicDigits,
  monthDays,
  dateValue,
} from '@akeela/portal/arabic-date-utils';
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
