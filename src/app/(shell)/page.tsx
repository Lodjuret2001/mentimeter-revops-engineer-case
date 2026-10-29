import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Page } from '@/components/shell/page';
import { Button } from '@/components/ui/button';
import { type CaseStatus, listCases } from '@/lib/orchestrator';
import { syncAction } from './orchestrator/actions';
import { CaseStatusBadge } from './orchestrator/parts';

const STATUSES: CaseStatus[] = ['done', 'held', 'blocked', 'reopened'];

const STEPS = [
  'Salesforce says a deal is Closed Won.',
  'The deal is checked against the finance rules.',
  'Workspace and subscription are set up. The invoice waits if something is missing.',
  'IDs go back to Salesforce. The person who can fix it hears in Slack.',
];

export default async function HomePage() {
  const cases = listCases();
  const counts = Object.fromEntries(
    STATUSES.map((s) => [s, cases.filter((c) => c.status === s).length]),
  ) as Record<CaseStatus, number>;

  return (
    <Page className="max-w-3xl justify-center py-16">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <span className="text-muted-foreground text-sm">RevOps Engineer case</span>
          <h1 className="font-semibold text-4xl tracking-tight">Menti Orchestrator</h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            The Closed Won hand-off, without the copying. One service listens to Salesforce, sets
            the customer up, drafts the bill and tells the right person what is missing.
          </p>
        </div>

        <ol className="flex flex-col gap-2">
          {STEPS.map((text, index) => (
            <li key={text} className="flex items-baseline gap-3 text-sm">
              <span className="w-4 shrink-0 text-right text-muted-foreground tabular-nums">
                {index + 1}
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ol>

        {cases.length > 0 ? (
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {STATUSES.map((status) => (
              <Link
                key={status}
                href={`/orchestrator?status=${status}`}
                className="flex items-center gap-2 hover:underline"
              >
                <CaseStatusBadge status={status} />
                <span className="font-medium tabular-nums">{counts[status]}</span>
              </Link>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button render={<Link href="/orchestrator" />}>
            Open Menti Orchestrator
            <ArrowRight className="size-4" />
          </Button>
          {cases.length === 0 ? (
            <form action={syncAction}>
              <Button variant="outline" type="submit">
                Run this week’s events
              </Button>
            </form>
          ) : null}
          <Link href="/deals?view=open" className="text-primary text-sm hover:underline">
            Or mark an open deal Closed Won and watch it run
          </Link>
        </div>
      </div>
    </Page>
  );
}
