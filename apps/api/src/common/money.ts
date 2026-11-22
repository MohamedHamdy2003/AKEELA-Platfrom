const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

export function moneyCents(value: string): bigint {
  if (!MONEY_PATTERN.test(value)) {
    throw new RangeError(`Invalid money amount: ${value}`);
  }
  const [whole = '0', fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

export function formatMoneyCents(cents: bigint): string {
  const sign = cents < 0n ? '-' : '';
  const abs = cents < 0n ? -cents : cents;
  return `${sign}${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`;
}

export function moneyAmount(value: string): string {
  return formatMoneyCents(moneyCents(value));
}
