export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function lastDayAfterYears(start: string, years: number): string {
  const d = new Date(`${start}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return addDays(d.toISOString().slice(0, 10), -1);
}
export function daysInclusive(start: string, end: string): number {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000) + 1;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
export const EUR_PER_UNIT: Record<string, number> = { EUR: 1, USD: 0.92, GBP: 1.17, SEK: 0.088 };

export function toEur(amount: number, currency: string): number | null {
  const rate = EUR_PER_UNIT[currency.toUpperCase()];
  return rate === undefined ? null : amount * rate;
}

export function formatDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
