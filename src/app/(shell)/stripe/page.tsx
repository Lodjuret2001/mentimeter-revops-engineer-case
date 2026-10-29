import { CreditCard, Home, Repeat, Search, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  cardBrand,
  cardExpiry,
  StripeBadge,
  StripeField,
  StripeId,
  StripeLink,
  StripeSectionHeader,
  stripeMoney,
} from '@/components/stripe/ui';
import { stripe } from '@/lib/connectors';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Stripe' };

export default async function StripePage(props: PageProps<'/stripe'>) {
  const { tab } = await props.searchParams;
  const active = tab === 'customers' ? 'customers' : 'subscriptions';
  const [subscriptions, customers] = await Promise.all([
    stripe.listSubscriptions(),
    stripe.findCustomers(),
  ]);

  const nav = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    {
      id: 'customers',
      label: 'Customers',
      icon: Users,
      href: '/stripe?tab=customers',
      count: customers.length,
    },
    {
      id: 'subscriptions',
      label: 'Subscriptions',
      icon: Repeat,
      href: '/stripe',
      count: subscriptions.length,
    },
  ] as const;

  const navItem =
    'flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] text-[#425466] dark:text-muted-foreground';

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col bg-white text-[#30313d] dark:bg-background dark:text-foreground">
      {/* Top bar: Stripe wordmark, search and the "Test mode" marker the sandbox shows. */}
      <div className="flex h-12 items-center gap-4 border-[#e3e8ee] border-b px-5 dark:border-border">
        <span className="font-bold text-[#635bff] text-[19px] tracking-tight">stripe</span>
        <div className="hidden h-7 flex-1 items-center gap-2 rounded-md border border-[#e3e8ee] bg-[#f6f8fa] px-2.5 text-[#687385] text-[13px] md:flex md:max-w-md dark:border-border dark:bg-muted dark:text-muted-foreground">
          <Search className="size-3.5" />
          Search
        </div>
        <span className="ml-auto inline-flex h-6 items-center rounded-full bg-[#ff8f0e]/15 px-2.5 font-semibold text-[#c84801] text-[11px] uppercase tracking-wide dark:text-orange-300">
          Test mode
        </span>
      </div>

      <div className="grid flex-1 md:grid-cols-[200px_1fr]">
        {/* Stripe's left sidebar. Home and Payments are decoration; the other two switch tabs. */}
        <nav className="flex flex-col gap-0.5 border-[#e3e8ee] border-b p-3 md:border-r md:border-b-0 dark:border-border">
          {nav.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === active;
            const inner = (
              <>
                <Icon className={cn('size-4', isActive ? 'text-[#635bff]' : 'text-[#687385]')} />
                <span className="flex-1">{item.label}</span>
                {'count' in item ? (
                  <span className="text-[#8792a2] text-[12px] tabular-nums">{item.count}</span>
                ) : null}
              </>
            );
            return 'href' in item ? (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  navItem,
                  'hover:bg-[#f6f8fa] dark:hover:bg-muted',
                  isActive &&
                    'bg-[#635bff]/8 font-medium text-[#635bff] hover:bg-[#635bff]/10 dark:bg-[#635bff]/15 dark:text-[#a5a0ff]',
                )}
              >
                {inner}
              </Link>
            ) : (
              <span key={item.id} className={cn(navItem, 'cursor-default')}>
                {inner}
              </span>
            );
          })}
        </nav>

        <main className="flex min-w-0 flex-col gap-5 p-6">
          {active === 'subscriptions' ? (
            <>
              <StripeSectionHeader
                title="Subscriptions"
                count={subscriptions.length}
                description="Card payments."
              />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-[13px]">
                  <thead>
                    <tr className="border-[#e3e8ee] border-b text-left text-[#687385] text-[12px] dark:border-border dark:text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Subscription</th>
                      <th className="py-2 pr-4 font-medium">Customer</th>
                      <th className="py-2 pr-4 text-right font-medium">Quantity</th>
                      <th className="py-2 pr-4 text-right font-medium">Per year</th>
                      <th className="py-2 pr-4 font-medium">Current period</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((s) => {
                      const customer = customers.find((c) => c.id === s.customer);
                      return (
                        <tr
                          key={s.id}
                          className="border-[#e3e8ee] border-b align-top last:border-b-0 hover:bg-[#f6f8fa] dark:border-border dark:hover:bg-muted/40"
                        >
                          <td className="py-3 pr-4">
                            <StripeId value={s.id} />
                          </td>
                          <td className="py-3 pr-4">
                            <StripeLink>{customer?.name}</StripeLink>
                            <div>
                              <StripeId value={s.customer} className="text-[11px]" />
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums">
                            {s.quantity} <span className="text-[#687385]">{s.plan}</span>
                          </td>
                          <td className="py-3 pr-4 text-right font-medium tabular-nums">
                            {stripeMoney(s.amount, s.currency)}
                          </td>
                          <td className="py-3 pr-4">
                            {formatDate(s.current_period_start)} to{' '}
                            {formatDate(s.current_period_end)}
                            <div className="text-[#687385] text-[12px] dark:text-muted-foreground">
                              {s.status === 'canceled'
                                ? `Canceled ${formatDate(s.canceled_at)}`
                                : s.cancel_at_period_end
                                  ? 'Ends at period end'
                                  : 'Renews automatically'}
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="flex flex-wrap gap-1">
                              <StripeBadge value={s.status} />
                              {s.latest_invoice_status !== 'paid' ? (
                                <StripeBadge value={s.latest_invoice_status} />
                              ) : null}
                            </div>
                            {s.last_payment_error ? (
                              <div className="mt-1 max-w-56 text-[#687385] text-[12px] dark:text-muted-foreground">
                                {s.last_payment_error}
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <StripeSectionHeader
                title="Customers"
                count={customers.length}
                description="Card payments."
              />
              <div className="grid gap-4 xl:grid-cols-2">
                {customers.map((c) => {
                  const pm = c.default_payment_method;
                  const expiry = pm ? cardExpiry(pm.exp_month, pm.exp_year) : null;
                  const subs = subscriptions.filter((s) => s.customer === c.id);
                  return (
                    <article
                      key={c.id}
                      className="flex flex-col rounded-lg border border-[#e3e8ee] bg-white shadow-[0_1px_2px_rgba(0,0,0,.04)] dark:border-border dark:bg-card"
                    >
                      <header className="flex flex-wrap items-start justify-between gap-2 border-[#e3e8ee] border-b px-4 py-3 dark:border-border">
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold text-[15px]">{c.name}</h3>
                          <StripeLink className="block truncate text-[13px]">{c.email}</StripeLink>
                        </div>
                        <StripeId value={c.id} />
                      </header>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3 sm:grid-cols-3">
                        <StripeField label="Currency">
                          <span className="uppercase">{c.currency}</span>
                        </StripeField>
                        <StripeField label="Default payment method">
                          {pm && expiry ? (
                            <span className="inline-flex flex-wrap items-center gap-1.5">
                              <CreditCard className="size-3.5 text-[#687385]" />
                              {cardBrand(pm.brand)} •••• {pm.last4}
                              <span
                                className={cn(
                                  'text-[12px]',
                                  expiry.expired
                                    ? 'font-medium text-[#b3093c] dark:text-rose-400'
                                    : 'text-[#687385] dark:text-muted-foreground',
                                )}
                              >
                                {expiry.expired
                                  ? `Expired ${expiry.label}`
                                  : `Expires ${expiry.label}`}
                              </span>
                            </span>
                          ) : (
                            'None'
                          )}
                        </StripeField>
                        <StripeField label="Metadata">
                          {Object.entries(c.metadata).length === 0 ? (
                            <span className="text-[#687385]">None</span>
                          ) : (
                            <span className="flex flex-col gap-0.5 font-mono text-[12px]">
                              {Object.entries(c.metadata).map(([k, v]) => (
                                <span key={k}>
                                  <span className="text-[#687385]">{k}=</span>
                                  {v}
                                </span>
                              ))}
                            </span>
                          )}
                        </StripeField>
                      </dl>
                      <div className="border-[#e3e8ee] border-t px-4 py-3 dark:border-border">
                        <div className="mb-2 flex items-baseline gap-2 font-medium text-[13px]">
                          Subscriptions
                          <span className="font-normal text-[#687385] text-[12px]">
                            {subs.length}
                          </span>
                        </div>
                        {subs.length === 0 ? (
                          <p className="text-[#687385] text-[13px]">No subscriptions.</p>
                        ) : (
                          <ul className="divide-y divide-[#e3e8ee] dark:divide-border">
                            {subs.map((s) => (
                              <li
                                key={s.id}
                                className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2 text-[13px] first:pt-0 last:pb-0"
                              >
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium">
                                      {s.quantity} × {s.plan}
                                    </span>
                                    <StripeBadge value={s.status} />
                                    {s.latest_invoice_status !== 'paid' ? (
                                      <StripeBadge value={s.latest_invoice_status} />
                                    ) : null}
                                  </div>
                                  <StripeId value={s.id} className="text-[11px]" />
                                  <div className="text-[#687385] text-[12px] dark:text-muted-foreground">
                                    {formatDate(s.current_period_start)} to{' '}
                                    {formatDate(s.current_period_end)} ·{' '}
                                    {s.status === 'canceled'
                                      ? `Canceled ${formatDate(s.canceled_at)}`
                                      : s.cancel_at_period_end
                                        ? 'Ends at period end'
                                        : 'Renews automatically'}
                                  </div>
                                  {s.last_payment_error ? (
                                    <div className="text-[#b3093c] text-[12px] dark:text-rose-400">
                                      {s.last_payment_error}
                                    </div>
                                  ) : null}
                                </div>
                                <div className="text-right font-medium tabular-nums">
                                  {stripeMoney(s.amount, s.currency)}
                                  <div className="font-normal text-[#687385] text-[12px]">
                                    per {s.interval}
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
