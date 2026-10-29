import type { Metadata } from 'next';
import { CustomerCard } from '@/components/kleer/customer-card';
import { kleerMoney, sumByCurrency } from '@/components/kleer/money';
import { InvoiceStatusPill } from '@/components/kleer/status-pill';
import { KleerTopBar } from '@/components/kleer/top-bar';
import { Page } from '@/components/shell/page';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { today as clockToday } from '@/lib/clock';
import { kleer } from '@/lib/connectors';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Kleer' };

/** Column header with the Swedish word in grey next to the English one. */
function Head({ en, sv, className }: { en: string; sv?: string; className?: string }) {
  return (
    <TableHead
      className={cn(
        'h-9 bg-muted/40 font-medium text-[11px] text-muted-foreground uppercase tracking-wide',
        className,
      )}
    >
      {en}
      {sv ? <span className="ml-1 normal-case tracking-normal opacity-60">{sv}</span> : null}
    </TableHead>
  );
}

function Stat({
  en,
  sv,
  lines,
  hint,
  tone = 'default',
}: {
  en: string;
  sv: string;
  lines: string[];
  hint: string;
  tone?: 'default' | 'good' | 'bad';
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border bg-card p-4 shadow-xs">
      <div className="text-muted-foreground text-xs">
        {en} <span className="opacity-60">{sv}</span>
      </div>
      <div
        className={cn(
          'font-semibold text-lg tabular-nums leading-tight',
          tone === 'good' && 'text-emerald-700 dark:text-emerald-400',
          tone === 'bad' && 'text-rose-700 dark:text-rose-400',
        )}
      >
        {lines.length ? lines.map((l) => <div key={l}>{l}</div>) : <div>0,00</div>}
      </div>
      <div className="text-muted-foreground text-xs">{hint}</div>
    </div>
  );
}

export default async function KleerPage(props: PageProps<'/kleer'>) {
  const { tab } = await props.searchParams;
  const active = tab === 'customers' ? 'customers' : 'invoices';
  const [invoices, customers] = await Promise.all([kleer.findInvoices(), kleer.findCustomers()]);
  const today = clockToday();
  const status = (i: (typeof invoices)[number]) =>
    i.status === 'sent' && i.dueDate < today ? 'overdue' : i.status;

  const open = invoices.filter((i) => i.status === 'sent');
  const overdue = open.filter((i) => i.dueDate < today);
  const paid = invoices.filter((i) => i.status === 'paid');
  const money = (list: typeof invoices, pick: (i: (typeof invoices)[number]) => number) =>
    sumByCurrency(list, pick).map(([currency, total]) => kleerMoney(total, currency));

  return (
    <Page className="gap-5">
      <KleerTopBar active={active} invoices={invoices.length} customers={customers.length} />

      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">
            {active === 'invoices' ? 'Invoices' : 'Customers'}{' '}
            <span className="font-normal text-base text-muted-foreground">
              {active === 'invoices' ? 'Kundfakturor' : 'Kunder'}
            </span>
          </h1>
          <p className="text-muted-foreground text-sm">
            Invoicing, for customers who pay by invoice.
          </p>
        </div>
        <div className="text-muted-foreground text-xs">
          Today <span className="font-mono">{today}</span>
        </div>
      </div>

      {active === 'invoices' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              en="Open"
              sv="Att betala"
              lines={money(open, (i) => i.totalAmount)}
              hint={`${open.length} sent, not yet paid`}
            />
            <Stat
              en="Overdue"
              sv="Förfallet"
              tone={overdue.length ? 'bad' : 'default'}
              lines={money(overdue, (i) => i.totalAmount)}
              hint={`${overdue.length} past due date`}
            />
            <Stat
              en="Paid"
              sv="Betalt"
              tone="good"
              lines={money(paid, (i) => i.totalAmount)}
              hint={`${paid.length} paid`}
            />
          </div>

          <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Head en="Invoice" sv="Fakturanr" className="pl-4" />
                  <Head en="Customer" sv="Kund" />
                  <Head en="Lines" sv="Rader" />
                  <Head en="Net" sv="Netto" className="text-right" />
                  <Head en="VAT" sv="Moms" className="text-right" />
                  <Head en="Total" sv="Att betala" className="text-right" />
                  <Head en="Dates" sv="Datum" />
                  <Head en="References" sv="Referenser" />
                  <Head en="Status" className="pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...invoices].reverse().map((i) => (
                  <TableRow
                    key={i.invoiceNumber}
                    className="hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20"
                  >
                    <TableCell className="py-3 pl-4 align-top">
                      <div className="font-medium font-mono text-sm">{i.invoiceNumber}</div>
                      {i.type === 'credit_note' ? (
                        <div className="text-muted-foreground text-xs">
                          Credit note for <span className="font-mono">{i.creditsInvoice}</span>
                        </div>
                      ) : null}
                      {i.creditedBy ? (
                        <div className="text-muted-foreground text-xs">
                          Credited by <span className="font-mono">{i.creditedBy}</span>
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="py-3 align-top text-sm">
                      {customers.find((c) => c.customerNumber === i.customerNumber)?.name}
                      <div className="font-mono text-muted-foreground text-xs">
                        #{i.customerNumber}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-72 py-3 align-top text-xs">
                      {i.lines.map((l) => (
                        <div key={`${l.articleNumber}-${l.description}`} className="tabular-nums">
                          {l.quantity} × <span className="font-mono">{l.articleNumber}</span> à{' '}
                          {l.unitPrice}
                          {l.discountPercent ? (
                            <span className="text-muted-foreground">
                              , {l.discountPercent}% off
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell className="py-3 text-right align-top tabular-nums">
                      {kleerMoney(i.netAmount, i.currency)}
                    </TableCell>
                    <TableCell className="py-3 text-right align-top text-sm tabular-nums">
                      {kleerMoney(i.vatAmount, i.currency)}
                      <div className="text-muted-foreground text-xs">{i.vatRate} %</div>
                    </TableCell>
                    <TableCell className="py-3 text-right align-top font-medium tabular-nums">
                      {kleerMoney(i.totalAmount, i.currency)}
                    </TableCell>
                    <TableCell className="py-3 align-top text-xs">
                      <div>
                        <span className="text-muted-foreground">Invoiced</span>{' '}
                        {formatDate(i.invoiceDate)}
                      </div>
                      <div
                        className={cn(
                          status(i) === 'overdue' && 'font-medium text-rose-700 dark:text-rose-400',
                        )}
                      >
                        <span className="text-muted-foreground">
                          Due <span className="opacity-60">Förfallodatum</span>
                        </span>{' '}
                        {formatDate(i.dueDate)}
                      </div>
                      <div className="text-muted-foreground">
                        Service {formatDate(i.servicePeriod.start)} to{' '}
                        {formatDate(i.servicePeriod.end)}
                      </div>
                    </TableCell>
                    <TableCell className="py-3 align-top text-xs">
                      {i.poNumber ? (
                        <div>
                          <span className="text-muted-foreground">PO</span> {i.poNumber}
                        </div>
                      ) : null}
                      {i.yourReference ? (
                        <div className="text-muted-foreground">Your ref: {i.yourReference}</div>
                      ) : null}
                      {i.foreignId ? (
                        <div className="font-mono text-muted-foreground">{i.foreignId}</div>
                      ) : null}
                      {!i.poNumber && !i.yourReference && !i.foreignId ? (
                        <span className="text-muted-foreground">None</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="py-3 pr-4 align-top">
                      <InvoiceStatusPill status={status(i)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter className="bg-emerald-50/40 dark:bg-emerald-950/20">
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={3} className="py-3 pl-4 text-sm">
                    Open <span className="font-normal text-muted-foreground">Att betala</span>
                    <span className="ml-2 font-normal text-muted-foreground text-xs">
                      {open.length} sent {open.length === 1 ? 'invoice' : 'invoices'}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 text-right tabular-nums">
                    {money(open, (i) => i.netAmount).map((l) => (
                      <div key={l}>{l}</div>
                    ))}
                  </TableCell>
                  <TableCell className="py-3 text-right tabular-nums">
                    {money(open, (i) => i.vatAmount).map((l) => (
                      <div key={l}>{l}</div>
                    ))}
                  </TableCell>
                  <TableCell className="py-3 text-right font-semibold tabular-nums">
                    {money(open, (i) => i.totalAmount).map((l) => (
                      <div key={l}>{l}</div>
                    ))}
                  </TableCell>
                  <TableCell colSpan={3} />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {customers.map((c) => {
            const mine = invoices.filter((i) => i.customerNumber === c.customerNumber);
            return (
              <CustomerCard
                key={c.customerNumber}
                customer={c}
                invoiceCount={mine.length}
                open={money(
                  mine.filter((i) => i.status === 'sent'),
                  (i) => i.totalAmount,
                )}
              />
            );
          })}
        </div>
      )}
    </Page>
  );
}
