import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminBar } from '@/components/admin-app/admin-bar';
import {
  BillingChip,
  FilterChips,
  IdChip,
  type LinkFilter,
  MembersBar,
  PlanBadge,
  RegionChip,
  SubscriptionStatusBadge,
} from '@/components/admin-app/chips';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { adminApp, salesforce } from '@/lib/connectors';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Admin app' };

const HEAD =
  'h-8 bg-muted/60 font-medium text-[10px] text-muted-foreground uppercase tracking-wider';
const CELL = 'py-1.5 text-xs';
const ROW = 'hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30';

function hrefFor(tab: 'subscriptions' | 'workspaces', link: LinkFilter) {
  const params = new URLSearchParams();
  if (tab === 'workspaces') params.set('tab', 'workspaces');
  if (link !== 'all') params.set('link', link);
  const query = params.toString();
  return query ? `/admin-app?${query}` : '/admin-app';
}

export default async function AdminAppPage(props: PageProps<'/admin-app'>) {
  const { tab, link } = await props.searchParams;
  const active = tab === 'workspaces' ? 'workspaces' : 'subscriptions';
  const filter: LinkFilter = link === 'linked' || link === 'self' ? link : 'all';
  const [subscriptions, workspaces, accounts] = await Promise.all([
    adminApp.listSubscriptions(),
    adminApp.listWorkspaces(),
    salesforce.listAccounts(),
  ]);
  const account = (id: string | null) => accounts.find((a) => a.Id === id);
  const workspace = (id: string) => workspaces.find((w) => w.id === id);
  const accountCell = (id: string | null) => {
    const found = account(id);
    return found ? (
      <Link
        href={`/accounts/${found.Id}`}
        className="text-indigo-700 hover:underline dark:text-indigo-300"
      >
        {found.Name}
      </Link>
    ) : (
      <span className="rounded border border-dashed px-1.5 py-px text-[11px] text-muted-foreground">
        Not linked
      </span>
    );
  };

  const matches = (row: { salesforceAccountId: string | null }) =>
    filter === 'all' ||
    (filter === 'linked' && row.salesforceAccountId !== null) ||
    (filter === 'self' && row.salesforceAccountId === null);
  const rows = active === 'subscriptions' ? subscriptions : workspaces;
  const shown = rows.filter(matches);
  const linkedCount = rows.filter((r) => r.salesforceAccountId !== null).length;
  const maxMembers = Math.max(0, ...workspaces.map((w) => w.activeMembers));

  return (
    <div className="flex min-w-0 flex-col">
      <AdminBar
        active={active}
        tabs={[
          {
            id: 'subscriptions',
            label: 'Subscriptions',
            href: hrefFor('subscriptions', filter),
            count: subscriptions.length,
          },
          {
            id: 'workspaces',
            label: 'Workspaces',
            href: hrefFor('workspaces', filter),
            count: workspaces.length,
          },
        ]}
      />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-semibold text-base tracking-tight">
              {active === 'subscriptions' ? 'Subscriptions' : 'Workspaces'}
            </h1>
            <p className="text-muted-foreground text-xs">
              Mentimeter's internal app for workspaces and subscriptions.
            </p>
          </div>
          <FilterChips
            active={filter}
            options={[
              { id: 'all', label: 'All', href: hrefFor(active, 'all'), count: rows.length },
              {
                id: 'linked',
                label: 'Linked to Salesforce',
                href: hrefFor(active, 'linked'),
                count: linkedCount,
              },
              {
                id: 'self',
                label: 'Self-service',
                href: hrefFor(active, 'self'),
                count: rows.length - linkedCount,
              },
            ]}
          />
        </div>

        <div className="overflow-hidden rounded-md border bg-card">
          {active === 'subscriptions' ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={cn(HEAD, 'pl-3')}>Subscription</TableHead>
                  <TableHead className={HEAD}>Workspace</TableHead>
                  <TableHead className={HEAD}>Account</TableHead>
                  <TableHead className={HEAD}>Plan</TableHead>
                  <TableHead className={cn(HEAD, 'text-right')}>Seats</TableHead>
                  <TableHead className={HEAD}>Period</TableHead>
                  <TableHead className={HEAD}>Status</TableHead>
                  <TableHead className={HEAD}>Billing</TableHead>
                  <TableHead className={cn(HEAD, 'pr-3')}>Created by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.filter(matches).map((s) => (
                  <TableRow key={s.id} className={ROW}>
                    <TableCell className={cn(CELL, 'pl-3')}>
                      <IdChip>{s.id}</IdChip>
                    </TableCell>
                    <TableCell className={CELL}>
                      <span className="mr-1.5">{workspace(s.workspaceId)?.name}</span>
                      <IdChip className="text-muted-foreground">{s.workspaceId}</IdChip>
                    </TableCell>
                    <TableCell className={CELL}>{accountCell(s.salesforceAccountId)}</TableCell>
                    <TableCell className={CELL}>
                      <PlanBadge plan={s.plan} />
                    </TableCell>
                    <TableCell className={cn(CELL, 'text-right font-mono tabular-nums')}>
                      {s.seats}
                    </TableCell>
                    <TableCell className={cn(CELL, 'tabular-nums')}>
                      {formatDate(s.startDate)}
                      <span className="mx-1 text-muted-foreground">→</span>
                      {formatDate(s.endDate)}
                      {s.autoRenew ? (
                        <span className="ml-1.5 rounded bg-muted px-1 font-mono text-[10px] text-muted-foreground">
                          auto-renew
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className={CELL}>
                      <SubscriptionStatusBadge status={s.status} />
                    </TableCell>
                    <TableCell className={CELL}>
                      <BillingChip system={s.billingSystem} />
                      {s.billingReference ? (
                        <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">
                          {s.billingReference}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className={cn(CELL, 'pr-3 font-mono text-muted-foreground')}>
                      {s.createdBy}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={cn(HEAD, 'pl-3')}>Workspace</TableHead>
                  <TableHead className={HEAD}>Account</TableHead>
                  <TableHead className={HEAD}>Domain</TableHead>
                  <TableHead className={HEAD}>Plan</TableHead>
                  <TableHead className={cn(HEAD, 'text-right')}>Members</TableHead>
                  <TableHead className={HEAD}>Region</TableHead>
                  <TableHead className={cn(HEAD, 'pr-3')}>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspaces.filter(matches).map((w) => (
                  <TableRow key={w.id} className={ROW}>
                    <TableCell className={cn(CELL, 'pl-3')}>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{w.name}</span>
                        <IdChip className="text-muted-foreground">{w.id}</IdChip>
                      </div>
                      {w.ownerEmail ? (
                        <div className="text-[11px] text-muted-foreground">{w.ownerEmail}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className={CELL}>{accountCell(w.salesforceAccountId)}</TableCell>
                    <TableCell className={cn(CELL, 'font-mono text-[11px]')}>
                      {w.domain ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className={CELL}>
                      <PlanBadge plan={w.plan} />
                    </TableCell>
                    <TableCell className={cn(CELL, 'text-right')}>
                      <MembersBar value={w.activeMembers} max={maxMembers} />
                    </TableCell>
                    <TableCell className={CELL}>
                      <RegionChip region={w.region} />
                    </TableCell>
                    <TableCell className={cn(CELL, 'pr-3 tabular-nums')}>
                      {formatDate(w.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {shown.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-xs">
              No rows match this filter.
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground">
          <span>
            {shown.length} of {rows.length} rows
          </span>
          <span>{linkedCount} linked</span>
          <span>{rows.length - linkedCount} self-service</span>
          <span className="ml-auto">source: admin-app</span>
        </div>
      </div>
    </div>
  );
}
