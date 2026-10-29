import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState, Page, PageHeader, Section } from '@/components/shell/page';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { salesforce } from '@/lib/connectors';
import { formatDateTime } from '@/lib/format';
import { type CaseStatus, getState, type HandoffCase, listCases } from '@/lib/orchestrator';
import { cn } from '@/lib/utils';
import { resetAction, syncAction } from './actions';
import { CaseStatusBadge, Chip, STATUS_ORDER } from './parts';

export const metadata: Metadata = { title: 'Menti Orchestrator' };

const STATUSES: CaseStatus[] = ['done', 'held', 'blocked', 'reopened'];

const STAT_TEXT: Record<CaseStatus, string> = {
  done: 'text-emerald-700 dark:text-emerald-400',
  held: 'text-amber-700 dark:text-amber-400',
  blocked: 'text-red-700 dark:text-red-400',
  reopened: 'text-muted-foreground',
};

function billingOf(record: HandoffCase) {
  if (record.executed.invoiceNumber) return record.executed.invoiceNumber;
  if (record.executed.stripeSubscriptionId) return record.executed.stripeSubscriptionId;
  if (record.status === 'held' || record.status === 'blocked') return 'held';
  return null;
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function matches(record: HandoffCase, q: string) {
  const haystack = [
    record.name,
    record.accountName,
    record.opportunityId,
    record.recordType,
    ...Object.values(record.executed).map(String),
    ...record.findings.map((f) => `${f.rule} ${f.message} ${f.field ?? ''}`),
  ]
    .join(' ')
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

function filterHref(params: { q?: string; status?: string; owner?: string }) {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.status) search.set('status', params.status);
  if (params.owner) search.set('owner', params.owner);
  const query = search.toString();
  return query ? `/orchestrator?${query}` : '/orchestrator';
}

export default async function OrchestratorPage(props: PageProps<'/orchestrator'>) {
  const params = await props.searchParams;
  const q = first(params.q)?.trim() ?? '';
  const statusParam = first(params.status) ?? '';
  const owner = first(params.owner) ?? '';
  const statusFilter = new Set(
    statusParam.split(',').filter((s): s is CaseStatus => STATUSES.includes(s as CaseStatus)),
  );
  const users = await salesforce.listUsers();
  const cases = listCases();
  const state = getState();
  const owners = new Map(users.map((u) => [u.Id, u.Name]));
  const counts = Object.fromEntries(
    STATUSES.map((s) => [s, cases.filter((c) => c.status === s).length]),
  ) as Record<CaseStatus, number>;
  const filtered = cases.filter(
    (c) =>
      (statusFilter.size === 0 || statusFilter.has(c.status)) &&
      (!owner || c.ownerId === owner) &&
      (!q || matches(c, q)),
  );
  const sorted = [...filtered].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name),
  );
  const filtering = q !== '' || statusFilter.size > 0 || owner !== '';
  const ownerOptions = [...new Set(cases.map((c) => c.ownerId))]
    .map((id) => ({ id, name: owners.get(id) ?? id }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const toggleStatus = (status: CaseStatus) => {
    const next = new Set(statusFilter);
    if (next.has(status)) next.delete(status);
    else next.add(status);
    return filterHref({ q, owner, status: [...next].join(',') });
  };

  return (
    <Page>
      <PageHeader
        title="Menti Orchestrator"
        description="Takes every Closed Won deal from Salesforce, checks it against the billing rules, sets the customer up and holds the money when something is missing."
        actions={
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <Link href="/orchestrator/log" className="text-primary text-sm hover:underline">
                Search log
              </Link>
              <form action={resetAction}>
                <Button variant="outline" type="submit">
                  Reset orchestrator
                </Button>
              </form>
              <form action={syncAction}>
                <Button type="submit">Sync Salesforce events</Button>
              </form>
            </div>
            <span className="text-muted-foreground text-xs tabular-nums">
              Event cursor: {state.cursor}
            </span>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STATUSES.map((status) => (
          <Link key={status} href={toggleStatus(status)} className="group">
            <Card
              size="sm"
              className={cn(
                'transition-colors group-hover:border-foreground/30',
                statusFilter.has(status) && 'border-foreground/60 bg-muted/40',
              )}
            >
              <CardHeader>
                <CardDescription className="flex items-center justify-between capitalize">
                  {status}
                  {statusFilter.has(status) ? (
                    <span className="text-[10px] uppercase tracking-wider">filtered</span>
                  ) : null}
                </CardDescription>
                <div className={`font-semibold text-3xl tabular-nums ${STAT_TEXT[status]}`}>
                  {counts[status]}
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <Section
        title="Cases"
        count={filtering ? sorted.length : cases.length}
        actions={
          <form method="get" action="/orchestrator" className="flex flex-wrap items-center gap-2">
            {statusParam ? <input type="hidden" name="status" value={statusParam} /> : null}
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search deal, account, finding, ID…"
              className="h-8 w-64 text-sm"
            />
            <select
              name="owner"
              defaultValue={owner}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm dark:bg-input/30"
            >
              <option value="">All owners</option>
              {ownerOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <Button size="sm" variant="outline" type="submit">
              Filter
            </Button>
            <Link
              href={filterHref({ q, owner, status: 'held,blocked' })}
              className={cn(
                'rounded-md border px-2.5 py-1 text-sm hover:bg-muted',
                statusParam === 'held,blocked' && 'bg-muted font-medium',
              )}
            >
              Needs action
            </Link>
            {filtering ? (
              <Link href="/orchestrator" className="text-primary text-sm hover:underline">
                Clear
              </Link>
            ) : null}
          </form>
        }
      >
        {cases.length === 0 ? (
          <EmptyState>
            No deals handled yet. Press Sync Salesforce events, or send events from Dev tools to the
            webhook.
          </EmptyState>
        ) : sorted.length === 0 ? (
          <EmptyState>No cases match this filter.</EmptyState>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Findings</TableHead>
                  <TableHead>Set up</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead>Last run</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((record) => {
                  const open = record.findings.filter(
                    (f) => f.severity === 'hold' || f.severity === 'block',
                  );
                  const billing = billingOf(record);
                  return (
                    <TableRow key={record.opportunityId} className="align-top">
                      <TableCell>
                        <Link
                          href={`/orchestrator/${record.opportunityId}`}
                          className="font-medium text-sm hover:underline"
                        >
                          {record.name}
                        </Link>
                        <div className="text-muted-foreground text-xs">
                          {record.accountName} · {record.recordType}
                        </div>
                      </TableCell>
                      <TableCell>
                        <CaseStatusBadge status={record.status} />
                      </TableCell>
                      <TableCell className="text-sm">
                        {owners.get(record.ownerId) ?? (
                          <span className="font-mono text-xs">{record.ownerId}</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-md whitespace-normal">
                        {open.length === 0 ? (
                          <span className="text-muted-foreground text-xs">—</span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {open.slice(0, 2).map((f) => (
                              <div key={`${f.rule}-${f.message}`} className="text-xs">
                                <span className="font-mono text-muted-foreground">{f.rule}</span>{' '}
                                {f.message}
                              </div>
                            ))}
                            {open.length > 2 ? (
                              <div className="text-muted-foreground text-xs">
                                +{open.length - 2} more
                              </div>
                            ) : null}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {record.executed.workspaceId ? (
                            <Chip>{record.executed.workspaceId}</Chip>
                          ) : null}
                          {record.executed.subscriptionId ? (
                            <Chip>{record.executed.subscriptionId}</Chip>
                          ) : null}
                          {!record.executed.workspaceId && !record.executed.subscriptionId ? (
                            <span className="text-muted-foreground text-xs">—</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        {billing === null ? (
                          <span className="text-muted-foreground text-xs">—</span>
                        ) : billing === 'held' ? (
                          <span
                            className={`text-xs ${record.status === 'blocked' ? STAT_TEXT.blocked : STAT_TEXT.held}`}
                          >
                            held
                          </span>
                        ) : (
                          <Chip>{billing}</Chip>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground text-xs tabular-nums">
                        {formatDateTime(record.assessedAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>
    </Page>
  );
}
