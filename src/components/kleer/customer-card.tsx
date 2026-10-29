import type { KleerCustomer } from '@/lib/systems/types';

const FLAGS: Record<string, string> = {
  Austria: '🇦🇹',
  Denmark: '🇩🇰',
  Finland: '🇫🇮',
  France: '🇫🇷',
  Germany: '🇩🇪',
  Netherlands: '🇳🇱',
  Norway: '🇳🇴',
  Sweden: '🇸🇪',
  'United Kingdom': '🇬🇧',
  'United States': '🇺🇸',
};

export function CustomerCard({
  customer,
  invoiceCount,
  open,
}: {
  customer: KleerCustomer;
  invoiceCount: number;
  /** Open amount per currency, already formatted. */
  open: string[];
}) {
  const c = customer;
  return (
    <article className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-medium">{c.name}</h3>
          <div className="text-muted-foreground text-xs">
            <span aria-hidden className="mr-1">
              {FLAGS[c.country] ?? ''}
            </span>
            {c.country}
          </div>
        </div>
        <span className="shrink-0 rounded-md bg-emerald-50 px-1.5 py-0.5 font-mono text-emerald-700 text-xs ring-1 ring-emerald-200 ring-inset dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900">
          #{c.customerNumber}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <dt className="text-muted-foreground">
            VAT number <span className="opacity-60">Momsnr</span>
          </dt>
          <dd className="font-mono">
            {c.vatNumber ?? <span className="font-sans text-muted-foreground">None</span>}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">
            Currency <span className="opacity-60">Valuta</span>
          </dt>
          <dd className="font-mono">{c.currency}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-foreground">
            Invoice email <span className="opacity-60">E-post</span>
          </dt>
          <dd className="truncate">{c.email}</dd>
        </div>
        {c.address ? (
          <div className="col-span-2">
            <dt className="text-muted-foreground">
              Address <span className="opacity-60">Adress</span>
            </dt>
            <dd className="truncate">{c.address}</dd>
          </div>
        ) : null}
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs">
        <span className="text-muted-foreground">
          {invoiceCount} {invoiceCount === 1 ? 'invoice' : 'invoices'}
        </span>
        {open.length ? (
          <span className="font-medium tabular-nums">
            <span className="mr-1 font-normal text-muted-foreground">Open</span>
            {open.join(' · ')}
          </span>
        ) : (
          <span className="text-muted-foreground">Nothing open</span>
        )}
      </div>
    </article>
  );
}
