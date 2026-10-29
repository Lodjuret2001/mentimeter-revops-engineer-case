import type { Metadata } from 'next';
import Link from 'next/link';
import { Page, PageHeader, Section } from '@/components/shell/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { queryLog } from '@/lib/orchestrator';
import { LogTable } from '../parts';

export const metadata: Metadata = { title: 'Orchestrator log' };

const SYSTEMS = ['salesforce', 'admin', 'kleer', 'stripe', 'slack'];
const LEVELS = ['info', 'warn', 'error'];

function one(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

export default async function OrchestratorLogPage(props: PageProps<'/orchestrator/log'>) {
  const params = await props.searchParams;
  const q = one(params.q);
  const system = one(params.system);
  const level = one(params.level);
  const step = one(params.step);
  const opportunity = one(params.opportunity);
  const entries = queryLog({
    q: q || undefined,
    system: system || undefined,
    level: level || undefined,
    step: step || undefined,
    opportunityId: opportunity || undefined,
    limit: 500,
  });

  const selectClass =
    'h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30';

  return (
    <Page>
      <PageHeader
        eyebrow={
          <Link href="/orchestrator" className="hover:underline">
            Menti Orchestrator
          </Link>
        }
        title="Log"
        description="Every step the orchestrator took, across all deals. Newest first."
      />

      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-64 flex-1 flex-col gap-1">
          <label htmlFor="q" className="text-muted-foreground text-xs">
            Search
          </label>
          <Input id="q" name="q" defaultValue={q} placeholder="Message, step or detail" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="system" className="text-muted-foreground text-xs">
            System
          </label>
          <select id="system" name="system" defaultValue={system} className={selectClass}>
            <option value="">All systems</option>
            {SYSTEMS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="level" className="text-muted-foreground text-xs">
            Level
          </label>
          <select id="level" name="level" defaultValue={level} className={selectClass}>
            <option value="">All levels</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="flex w-40 flex-col gap-1">
          <label htmlFor="step" className="text-muted-foreground text-xs">
            Step
          </label>
          <Input id="step" name="step" defaultValue={step} placeholder="e.g. execute" />
        </div>
        {opportunity ? <input type="hidden" name="opportunity" value={opportunity} /> : null}
        <Button type="submit">Search</Button>
        {q || system || level || step || opportunity ? (
          <Link
            href="/orchestrator/log"
            className="px-2 text-muted-foreground text-sm hover:underline"
          >
            Clear
          </Link>
        ) : null}
      </form>

      <Section
        title={opportunity ? `Entries for ${opportunity}` : 'Entries'}
        count={entries.length}
        actions={
          opportunity ? (
            <Link
              href={`/orchestrator/${opportunity}`}
              className="text-primary text-sm hover:underline"
            >
              Open case
            </Link>
          ) : null
        }
      >
        <LogTable entries={entries} showDeal empty="No log entries match." />
      </Section>
    </Page>
  );
}
