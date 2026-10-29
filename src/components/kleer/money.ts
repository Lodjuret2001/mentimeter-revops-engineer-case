/**
 * Swedish accounting style: space-grouped thousands, comma decimals and the
 * currency after the number, e.g. "22 680,00 EUR".
 */
const svNumber = new Intl.NumberFormat('sv-SE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function kleerMoney(amount: number | null | undefined, currency: string) {
  if (amount === null || amount === undefined) return '';
  return `${svNumber.format(amount)} ${currency.toUpperCase()}`;
}

/** Sums `pick(item)` per currency, so mixed-currency lists stay honest. */
export function sumByCurrency<T extends { currency: string }>(
  items: T[],
  pick: (item: T) => number,
): [currency: string, total: number][] {
  const totals = new Map<string, number>();
  for (const item of items) {
    totals.set(item.currency, (totals.get(item.currency) ?? 0) + pick(item));
  }
  return [...totals.entries()];
}
