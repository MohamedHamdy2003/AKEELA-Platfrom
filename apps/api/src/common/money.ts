// Inputs have already passed the numeric(12,2) DTO validation.
export function moneyCents(value: string): bigint {
  const [whole = '0', fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

export function moneyAmount(value: string): string {
  const cents = moneyCents(value);
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
}
