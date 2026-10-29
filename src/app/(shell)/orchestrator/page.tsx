import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState, Page, PageHeader, Section } from '@/components/shell/page';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader } from '@/components/ui/card';
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

export default async function OrchestratorPage() {
  const users = await salesforce.listUsers();
  const cases = listCases();
  const state = getState();
  const owners = new Map(users.map((u) => [u.Id, u.Name]));
  const sorted = [...cases].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name),
  );
  const counts = Object.fromEntries(
    STATUSES.map((s) => [s, cases.filter((c) => c.status === s).length]),
  ) as Record<CaseStatus, number>;

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
          <Card key={status} size="sm">
            <CardHeader>
              <CardDescription className="capitalize">{status}</CardDescription>
              <div className={`font-semibold text-3xl tabular-nums ${STAT_TEXT[status]}`}>
                {counts[status]}
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Section title="Cases" count={cases.length}>
        {cases.length === 0 ? (
          <EmptyState>
            No deals handled yet. Press Sync Salesforce events, or send events from Dev tools to the
            webhook.
          </EmptyState>
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
