import Link from 'next/link';
import type { ReactNode } from 'react';
import { Json } from '@/components/data/fields';
import { Status } from '@/components/data/status';
import { adminApp, kleer, salesforce, slack, stripe } from '@/lib/connectors';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';
import type {
  Finding,
  HandoffCase,
  LogEntry,
  LogLevel,
  OwnerRole,
  SystemName,
} from '@/lib/orchestrator';
import type {
  KleerInvoice,
  SalesforceOpportunity,
  SlackMessage,
  StripeCustomer,
  StripeSubscription,
  Subscription,
} from '@/lib/systems/types';
import { cn } from '@/lib/utils';
import { Chip, OWNER_LABEL, SeverityBadge } from '../../parts';

const APP_USER = 'U04HANDOFF';

const SYSTEMS: { key: SystemName; label: string; href: string; tint: string; dot: string }[] = [
  {
    key: 'salesforce',
    label: 'Salesforce',
    href: '/deals',
    tint: 'border-t-[#0176d3] bg-sky-500/10 text-sky-900 dark:text-sky-200',
    dot: 'bg-[#0176d3]',
  },
  {
    key: 'admin',
    label: 'Admin app',
    href: '/admin-app',
    tint: 'border-t-indigo-500 bg-indigo-500/10 text-indigo-900 dark:text-indigo-200',
    dot: 'bg-indigo-500',
  },
  {
    key: 'kleer',
    label: 'Kleer',
    href: '/kleer',
    tint: 'border-t-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200',
    dot: 'bg-emerald-500',
  },
  {
    key: 'stripe',
    label: 'Stripe',
    href: '/stripe',
    tint: 'border-t-violet-500 bg-violet-500/10 text-violet-900 dark:text-violet-200',
    dot: 'bg-violet-500',
  },
  {
    key: 'slack',
    label: 'Slack',
    href: '/slack',
    tint: 'border-t-[#4a154b] bg-[#4a154b]/10 text-[#4a154b] dark:text-fuchsia-200',
    dot: 'bg-[#4a154b]',
  },
];

const LEVEL_DOT: Record<LogLevel, string> = {
  info: 'bg-muted-foreground/50',
  warn: 'bg-amber-500',
  error: 'bg-red-500',
};

const OWNER_ORDER: OwnerRole[] = ['rep', 'finance', 'credit', 'revops', 'deal_desk'];

const quiet = <T,>(promise: Promise<T>): Promise<T | null> => promise.catch(() => null);

const text = (value: unknown) =>
  value === null || value === undefined || value === '' ? null : String(value);

const yesNo = (value: unknown) => (value ? 'Yes' : 'No');

function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[11px]">{children}</span>;
}

function Rows({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="whitespace-nowrap text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words text-right">
            {value === null || value === undefined || value === '' ? (
              <span className="text-muted-foreground/60">—</span>
            ) : (
              value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Card({
  title,
  badge,
  tag,
  className,
  children,
}: {
  title: ReactNode;
  badge?: ReactNode;
  tag?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-2 rounded-md border bg-card p-2.5', className)}>
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span className="min-w-0 truncate font-medium text-xs">{title}</span>
        {badge}
      </div>
      {tag}
      {children}
    </div>
  );
}

function Block({ label, count, children }: { label: string; count?: number; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center gap-2 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
        {label}
        {count === undefined ? null : (
          <span className="rounded-full border px-1.5 font-normal tabular-nums">{count}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function Nothing({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed px-2 py-3 text-center text-muted-foreground text-xs">
      {children}
    </div>
  );
}

function Wrote({ entries }: { entries: LogEntry[] }) {
  if (entries.length === 0) return <Nothing>Nothing written here.</Nothing>;
  return (
    <ol className="flex flex-col divide-y rounded-md border bg-card">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-2 px-2 py-1.5 text-xs">
          <span
            aria-hidden
            className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', LEVEL_DOT[entry.level])}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <code className="truncate font-mono text-[11px]">{entry.step}</code>
              <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                {formatDateTime(entry.at)}
              </span>
            </div>
            <div className="break-words leading-snug">{entry.message}</div>
            {entry.detail !== undefined ? (
              <details className="mt-1">
                <summary className="cursor-pointer text-[11px] text-muted-foreground">
                  Detail
                </summary>
                <div className="pt-1.5">
                  <Json value={entry.detail} />
                </div>
              </details>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Column({
  system,
  read,
  wrote,
  extra,
}: {
  system: (typeof SYSTEMS)[number];
  read: ReactNode;
  wrote: LogEntry[];
  extra?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col divide-y rounded-lg border bg-muted/20">
      <div
        className={cn(
          'flex items-center justify-between gap-2 rounded-t-lg border-t-2 px-3 py-2',
          system.tint,
        )}
      >
        <span className="flex items-center gap-2 font-semibold text-sm">
          <span aria-hidden className={cn('size-2 rounded-full', system.dot)} />
          {system.label}
        </span>
        <Link href={system.href} className="text-[11px] opacity-70 hover:underline">
          Open
        </Link>
      </div>
      <Block label="Read">{read}</Block>
      {extra}
      <Block label="Wrote" count={wrote.length}>
        <Wrote entries={wrote} />
      </Block>
    </div>
  );
}

function slackTargets(entries: LogEntry[]) {
  const targets = new Set<string>();
  for (const entry of entries) {
    if (entry.step !== 'notify') continue;
    const match = /^Slack to (\S+)/.exec(entry.message);
    if (match) targets.add(match[1]);
  }
  return [...targets];
}

export async function SystemsView({
  record,
  entries,
}: {
  record: HandoffCase;
  entries: LogEntry[];
}) {
  const executed = record.executed;
  const log = (key: SystemName) =>
    [...entries].filter((e) => e.system === key).sort((a, b) => b.id - a.id);
  const written = new Set(
    entries.filter((e) => e.system && e.step !== 'event').map((e) => e.system as SystemName),
  );
  const grouped = OWNER_ORDER.map(
    (owner) => [owner, record.findings.filter((f) => f.owner === owner)] as [OwnerRole, Finding[]],
  ).filter(([, list]) => list.length > 0);

  const [opportunity, channels, users] = await Promise.all([
    quiet(salesforce.getOpportunity(record.opportunityId)),
    quiet(slack.listChannels()),
    quiet(slack.listUsers()),
  ]);
  const accountId = opportunity?.AccountId ?? record.accountId;

  const [
    account,
    workspace,
    bySubAccount,
    byWorkspace,
    kleerCustomer,
    invoices,
    stripeCustomers,
    stripeFallback,
  ] = await Promise.all([
    quiet(salesforce.getAccount(accountId)),
    executed.workspaceId ? quiet(adminApp.getWorkspace(executed.workspaceId)) : null,
    quiet(adminApp.listSubscriptions({ salesforceAccountId: accountId })),
    executed.workspaceId
      ? quiet(adminApp.listSubscriptions({ workspaceId: executed.workspaceId }))
      : null,
    executed.kleerCustomerNumber ? quiet(kleer.getCustomer(executed.kleerCustomerNumber)) : null,
    quiet(kleer.findInvoices({ foreignId: record.opportunityId })),
    executed.workspaceId
      ? quiet(stripe.findCustomers({ metadata: { workspace_id: executed.workspaceId } }))
      : null,
    executed.stripeCustomerId ? quiet(stripe.getCustomer(executed.stripeCustomerId)) : null,
  ]);

  const subscriptions = new Map<string, Subscription>();
  for (const s of [...(bySubAccount ?? []), ...(byWorkspace ?? [])]) subscriptions.set(s.id, s);

  const customers = new Map<string, StripeCustomer>();
  for (const c of stripeCustomers ?? []) customers.set(c.id, c);
  if (stripeFallback) customers.set(stripeFallback.id, stripeFallback);
  const stripeSubs = (
    await Promise.all(
      [...customers.keys()].map((customer) => quiet(stripe.listSubscriptions({ customer }))),
    )
  ).flatMap((list) => list ?? []);

  const channelId = (target: string) =>
    target.startsWith('#')
      ? (channels?.find((c) => c.name === target.slice(1))?.id ?? null)
      : target;
  const targets = slackTargets(entries)
    .map((target) => ({ target, id: channelId(target) }))
    .filter((t): t is { target: string; id: string } => t.id !== null);
  const histories = await Promise.all(targets.map((t) => quiet(slack.history(t.id))));
  const messages = targets.flatMap((t, i) =>
    (histories[i] ?? [])
      .filter((m) => m.user === APP_USER && m.text.includes(record.name))
      .map((m) => ({ ...m, target: t.target, id: t.id })),
  );
  const targetName = (m: SlackMessage & { target: string; id: string }) =>
    m.target.startsWith('#')
      ? m.target
      : (users?.find((u) => u.id === m.id)?.real_name ?? m.target);

  const money = (amount: number | null | undefined, currency: string | null | undefined) =>
    amount === null || amount === undefined ? null : (
      <span className="tabular-nums">{formatMoney(amount, currency)}</span>
    );

  const salesforceRead = opportunity ? (
    <div className="flex flex-col gap-2">
      <Card
        title={
          <Link href={`/deals/${opportunity.Id}`} className="hover:underline">
            {opportunity.Name}
          </Link>
        }
        badge={<Status value={opportunity.StageName} />}
      >
        <Rows
          items={[
            ['Record type', opportunity.RecordType.Name],
            ['Plan', opportunity.Plan__c],
            ['Licenses', text(opportunity.Number_of_Licenses__c)],
            ['Amount', money(opportunity.Amount, opportunity.CurrencyIsoCode)],
            ['Payment', opportunity.Payment_Method__c],
            ['PO number', opportunity.PO_Number__c],
            ['Start', formatDate(opportunity.Start_Date__c)],
            ['End', formatDate(opportunity.End_Date__c)],
          ]}
        />
      </Card>
      {account ? (
        <Card
          title={
            <Link href={`/accounts/${account.Id}`} className="hover:underline">
              {account.Name}
            </Link>
          }
          badge={<Chip className="font-sans">Account</Chip>}
        >
          <Rows
            items={[
              ['Legal entity', account.Legal_Entity_Name__c],
              ['VAT', <Mono key="vat">{account.VAT_Number__c}</Mono>],
              ['Invoice email', account.Invoice_Email__c],
              ['PO required', yesNo(account.PO_Required__c)],
              ['Country', account.BillingCountry],
            ]}
          />
        </Card>
      ) : (
        <Nothing>Account {record.accountId} not found.</Nothing>
      )}
    </div>
  ) : (
    <Nothing>Opportunity {record.opportunityId} not found.</Nothing>
  );

  const writeback = (o: SalesforceOpportunity) => (
    <Rows
      items={[
        ['Handoff_Status__c', text(o.Handoff_Status__c)],
        ['Handoff_Issues__c', text(o.Handoff_Issues__c)],
        ['Subscription_ID__c', <Mono key="sub">{text(o.Subscription_ID__c)}</Mono>],
        ['Invoice_Number__c', <Mono key="inv">{text(o.Invoice_Number__c)}</Mono>],
        ['Billing_Reference__c', <Mono key="ref">{text(o.Billing_Reference__c)}</Mono>],
      ]}
    />
  );

  const subscriptionTag = (s: Subscription) =>
    s.id === executed.subscriptionId ? (
      <Chip className="w-fit font-sans text-indigo-700 dark:text-indigo-300">
        created/updated by orchestrator
      </Chip>
    ) : s.id === executed.oldSubscriptionId ? (
      <Chip className="w-fit font-sans text-muted-foreground">ended by orchestrator</Chip>
    ) : undefined;

  const adminRead = (
    <div className="flex flex-col gap-2">
      {workspace ? (
        <Card title={workspace.name} badge={<Status value={workspace.plan} />}>
          <Rows
            items={[
              ['Workspace', <Mono key="id">{workspace.id}</Mono>],
              ['Plan', workspace.plan],
              ['Members', text(workspace.activeMembers)],
              ['Region', workspace.region],
            ]}
          />
        </Card>
      ) : (
        <Nothing>
          {executed.workspaceId ? `Workspace ${executed.workspaceId} not found.` : 'No workspace.'}
        </Nothing>
      )}
      {[...subscriptions.values()]
        .sort((a, b) => b.startDate.localeCompare(a.startDate))
        .map((s) => (
          <Card
            key={s.id}
            title={<Mono>{s.id}</Mono>}
            badge={<Status value={s.status} />}
            tag={subscriptionTag(s)}
            className={cn(
              s.id === executed.subscriptionId && 'border-indigo-500/50',
              s.id === executed.oldSubscriptionId && 'opacity-70',
            )}
          >
            <Rows
              items={[
                ['Plan', `${s.plan} × ${s.seats}`],
                ['Period', `${formatDate(s.startDate)} → ${formatDate(s.endDate)}`],
                [
                  'Billing',
                  <span key="b">
                    {s.billingSystem}
                    {s.billingReference ? (
                      <>
                        {' '}
                        <Mono>{s.billingReference}</Mono>
                      </>
                    ) : null}
                  </span>,
                ],
              ]}
            />
          </Card>
        ))}
      {subscriptions.size === 0 ? <Nothing>No subscriptions on this account.</Nothing> : null}
    </div>
  );

  const kleerRead = (
    <div className="flex flex-col gap-2">
      {kleerCustomer ? (
        <Card title={kleerCustomer.name} badge={<Mono>{kleerCustomer.customerNumber}</Mono>}>
          <Rows
            items={[
              ['VAT', <Mono key="vat">{kleerCustomer.vatNumber}</Mono>],
              ['Country', kleerCustomer.country],
              ['Currency', kleerCustomer.currency],
            ]}
          />
        </Card>
      ) : (
        <Nothing>
          {executed.kleerCustomerNumber
            ? `Customer ${executed.kleerCustomerNumber} not found.`
            : 'No Kleer customer for this deal.'}
        </Nothing>
      )}
      {(invoices ?? []).map((i: KleerInvoice) => (
        <Card
          key={i.invoiceNumber}
          title={<Mono>{i.invoiceNumber}</Mono>}
          badge={<Status value={i.status} />}
          className={cn(i.invoiceNumber === executed.invoiceNumber && 'border-emerald-500/50')}
        >
          <Rows
            items={[
              ['Net', money(i.netAmount, i.currency)],
              ['VAT rate', `${i.vatRate}%`],
              ['Total', money(i.totalAmount, i.currency)],
              ['PO', i.poNumber],
            ]}
          />
        </Card>
      ))}
      {invoices && invoices.length === 0 ? <Nothing>No invoice for this deal.</Nothing> : null}
    </div>
  );

  const stripeRead = (
    <div className="flex flex-col gap-2">
      {[...customers.values()].map((c) => (
        <Card key={c.id} title={c.name} badge={<Mono>{c.id}</Mono>}>
          <Rows
            items={[
              ['Email', c.email],
              [
                'Card',
                c.default_payment_method
                  ? `${c.default_payment_method.brand} •••• ${c.default_payment_method.last4}`
                  : null,
              ],
              [
                'Expires',
                c.default_payment_method
                  ? `${c.default_payment_method.exp_month}/${c.default_payment_method.exp_year}`
                  : null,
              ],
            ]}
          />
        </Card>
      ))}
      {stripeSubs.map((s: StripeSubscription) => (
        <Card
          key={s.id}
          title={<Mono>{s.id}</Mono>}
          badge={<Status value={s.status} />}
          tag={
            s.id === executed.stripeSubscriptionId ? (
              <Chip className="w-fit font-sans text-violet-700 dark:text-violet-300">
                created by orchestrator
              </Chip>
            ) : undefined
          }
          className={cn(s.id === executed.stripeSubscriptionId && 'border-violet-500/50')}
        >
          <Rows
            items={[
              ['Plan', `${s.plan} × ${s.quantity}`],
              ['Amount', money(s.amount, s.currency)],
              [
                'Period',
                `${formatDate(s.current_period_start)} → ${formatDate(s.current_period_end)}`,
              ],
              ['Latest invoice', <Status key="li" value={s.latest_invoice_status} />],
              ['Renews', s.cancel_at_period_end ? 'No, stops at period end' : 'Yes'],
            ]}
          />
        </Card>
      ))}
      {customers.size === 0 ? <Nothing>No Stripe customer for this workspace.</Nothing> : null}
    </div>
  );

  const slackRead = (
    <div className="flex flex-col gap-2">
      {messages
        .sort((a, b) => b.postedAt.localeCompare(a.postedAt))
        .map((m) => (
          <Card
            key={`${m.id}-${m.ts}`}
            title={
              <Link href={`/slack?channel=${m.id}`} className="hover:underline">
                {targetName(m)}
              </Link>
            }
            badge={
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {formatDateTime(m.postedAt)}
              </span>
            }
          >
            <p className="line-clamp-2 whitespace-pre-line text-muted-foreground text-xs">
              {m.text}
            </p>
          </Card>
        ))}
      {messages.length === 0 ? <Nothing>No Slack message for this deal.</Nothing> : null}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-muted/30 px-4 py-2.5 text-sm">
        <span>
          Read from 5 systems · wrote to {written.size} {written.size === 1 ? 'system' : 'systems'}{' '}
          · {record.findings.length} {record.findings.length === 1 ? 'finding' : 'findings'}
        </span>
        {grouped.map(([owner, list]) => (
          <span key={owner} className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground text-xs">{OWNER_LABEL[owner]}</span>
            {list.map((f, index) => (
              <span
                key={`${f.rule}-${index}`}
                className="inline-flex items-center gap-1 rounded-md border bg-background px-1.5 py-0.5"
                title={f.message}
              >
                <SeverityBadge severity={f.severity} />
                <code className="font-mono text-[11px]">{f.rule}</code>
              </span>
            ))}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[1200px] grid-cols-5 items-start gap-3">
          <Column
            system={SYSTEMS[0]}
            read={salesforceRead}
            wrote={log('salesforce')}
            extra={
              opportunity ? (
                <Block label="Written back">
                  <div className="rounded-md border bg-card p-2.5">{writeback(opportunity)}</div>
                </Block>
              ) : undefined
            }
          />
          <Column system={SYSTEMS[1]} read={adminRead} wrote={log('admin')} />
          <Column system={SYSTEMS[2]} read={kleerRead} wrote={log('kleer')} />
          <Column system={SYSTEMS[3]} read={stripeRead} wrote={log('stripe')} />
          <Column system={SYSTEMS[4]} read={slackRead} wrote={log('slack')} />
        </div>
      </div>
    </div>
  );
}
