import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Page, PageHeader } from '@/components/shell/page';
import { Button } from '@/components/ui/button';
import { getCase, queryLog } from '@/lib/orchestrator';
import { chooseWorkspaceAction, runAction, sendInvoiceAction } from '../actions';
import { CaseStatusBadge } from '../parts';
import { StepsView } from './views/steps';

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
  const _mono = (value: string | undefined) =>
    value ? <span className="font-mono text-xs">{value}</span> : null;
  const _billed =
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

      <StepsView record={record} entries={entries} />
    </Page>
  );
}
