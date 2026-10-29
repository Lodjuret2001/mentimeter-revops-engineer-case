import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Fields } from '@/components/data/fields';
import { EmptyState, Page, PageHeader, Section } from '@/components/shell/page';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/format';
import { getCase, queryLog } from '@/lib/orchestrator';
import { chooseWorkspaceAction, runAction, sendInvoiceAction } from '../actions';
import { CaseStatusBadge, Chip, LogTable, OWNER_LABEL, SeverityBadge } from '../parts';

export async function generateMetadata(props: PageProps<'/orchestrator/[id]'>): Promise<Metadata> {
  const { id } = await props.params;
  const record = getCase(id);
  return { title: record ? `${record.name} · Orchestrator` : 'Orchestrator' };
}

export default async function OrchestratorCasePage(props: PageProps<'/orchestrator/[id]'>) {
  const { id } = await props.params;
  const record = getCase(id);
  if (!record) notFound();
  const entries = queryLog({ opportunityId: id, limit: 500 });

  const ambiguous = record.findings.find((f) => f.rule === 'WS' && f.severity === 'block');
  const candidates = ambiguous ? [...new Set(ambiguous.message.match(/WS-\d+/g) ?? [])] : [];
  const executed = record.executed;
  const mono = (value: string | undefined) =>
    value ? <span className="font-mono text-xs">{value}</span> : null;
  const billed =
    executed.billedAmount === undefined ? null : (
      <span className="tabular-nums">{executed.billedAmount.toLocaleString('en-GB')}</span>
    );

  return (
    <Page>
      <PageHeader
        eyebrow={
          <div className="flex items-center gap-3">
            <Link href="/orchestrator" className="hover:underline">
              Menti Orchestrator
            </Link>
            <span>·</span>
            <Link href={`/deals/${record.opportunityId}`} className="text-primary hover:underline">
              Open in Salesforce
            </Link>
          </div>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {record.name}
            <CaseStatusBadge status={record.status} />
          </span>
        }
        description={
          <span>
            {record.accountName} · {record.recordType} ·{' '}
            <span className="font-mono text-xs">{record.opportunityId}</span>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {candidates.map((workspaceId) => (
              <form key={workspaceId} action={chooseWorkspaceAction}>
                <input type="hidden" name="opportunityId" value={record.opportunityId} />
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <Button variant="secondary" size="sm" type="submit">
                  Use {workspaceId}
                </Button>
              </form>
            ))}
            {executed.invoiceNumber ? (
              <form action={sendInvoiceAction}>
                <input type="hidden" name="opportunityId" value={record.opportunityId} />
                <Button variant="outline" type="submit">
                  Send invoice {executed.invoiceNumber}
                </Button>
              </form>
            ) : null}
            <form action={runAction}>
              <input type="hidden" name="opportunityId" value={record.opportunityId} />
              <Button type="submit">Run again</Button>
            </form>
          </div>
        }
      />

      <Section title="Findings" count={record.findings.length}>
        {record.findings.length === 0 ? (
          <EmptyState>No findings. Everything checked out.</EmptyState>
        ) : (
          <div className="flex flex-col divide-y rounded-lg border">
            {record.findings.map((f, index) => (
              <div
                key={`${f.rule}-${index}`}
                className="flex flex-wrap items-start gap-3 px-4 py-2.5 text-sm"
              >
                <SeverityBadge severity={f.severity} />
                <code className="w-10 shrink-0 pt-0.5 font-mono text-xs">{f.rule}</code>
                <div className="min-w-0 flex-1">
                  {f.message}
                  {f.field ? (
                    <code className="ml-2 font-mono text-muted-foreground text-xs">{f.field}</code>
                  ) : null}
                </div>
                <Chip className="font-sans">{OWNER_LABEL[f.owner]}</Chip>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Plan" count={record.plan.length}>
        <p className="text-muted-foreground text-xs">
          Setup actions run even when billing is held. Billing actions run only when every finding
          is info or warn.
        </p>
        {record.plan.length === 0 ? (
          <EmptyState>Nothing to do for this deal.</EmptyState>
        ) : (
          <div className="flex flex-col divide-y rounded-lg border">
            {record.plan.map((action, index) => (
              <div
                key={`${action.type}-${index}`}
                className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm"
              >
                <Chip
                  className={
                    action.stage === 'billing'
                      ? 'font-sans text-amber-700 dark:text-amber-400'
                      : 'font-sans'
                  }
                >
                  {action.stage}
                </Chip>
                <span className="w-20 text-xs capitalize">{action.system}</span>
                <code className="font-mono text-muted-foreground text-xs">{action.type}</code>
                <span className="min-w-0 flex-1">{action.summary}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Executed">
        <div className="rounded-lg border p-4">
          <Fields
            items={[
              ['Workspace', mono(executed.workspaceId)],
              ['Subscription', mono(executed.subscriptionId)],
              ['Old subscription', mono(executed.oldSubscriptionId)],
              ['Kleer customer', mono(executed.kleerCustomerNumber)],
              ['Invoice', mono(executed.invoiceNumber)],
              ['Stripe customer', mono(executed.stripeCustomerId)],
              ['Stripe subscription', mono(executed.stripeSubscriptionId)],
              ['Billed amount', billed],
            ]}
          />
        </div>
      </Section>

      <Section title="History" count={record.history.length}>
        {record.history.length === 0 ? (
          <EmptyState>No runs yet.</EmptyState>
        ) : (
          <div className="flex flex-col divide-y rounded-lg border">
            {[...record.history].reverse().map((entry, index) => (
              <div
                key={`${entry.at}-${index}`}
                className="flex flex-wrap items-baseline gap-3 px-4 py-2 text-sm"
              >
                <span className="w-28 shrink-0 text-muted-foreground text-xs tabular-nums">
                  {formatDateTime(entry.at)}
                </span>
                <span>{entry.summary}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Log"
        count={entries.length}
        actions={
          <Link
            href={`/orchestrator/log?opportunity=${encodeURIComponent(record.opportunityId)}`}
            className="text-primary text-sm hover:underline"
          >
            Search log
          </Link>
        }
      >
        <LogTable entries={entries} empty="Nothing logged for this deal yet." />
      </Section>
    </Page>
  );
}
