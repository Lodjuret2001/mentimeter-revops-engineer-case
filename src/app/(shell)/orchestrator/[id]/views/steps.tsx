import type { ReactNode } from 'react';
import { Fields, Json } from '@/components/data/fields';
import { EmptyState, Section } from '@/components/shell/page';
import { formatDateTime } from '@/lib/format';
import type { Action, Finding, HandoffCase, LogEntry, Severity, Stage } from '@/lib/orchestrator';
import { cn } from '@/lib/utils';
import { CaseStatusBadge, Chip, LevelBadge, OWNER_LABEL, SeverityBadge } from '../../parts';

type Tone = 'good' | 'warn' | 'bad' | 'idle';

interface Step {
  title: string;
  tone: Tone;
  result: ReactNode;
  body?: ReactNode;
  open?: boolean;
}

interface ActionRun {
  action: Action;
  entry?: LogEntry;
  outcome: 'ran' | 'failed' | 'not run';
}

const CIRCLE: Record<Tone, string> = {
  good: 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  warn: 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  bad: 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-400',
  idle: 'border-border bg-muted text-muted-foreground',
};

const OUTCOME: Record<ActionRun['outcome'], string> = {
  ran: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  failed: 'bg-red-500/10 text-red-700 dark:text-red-400',
  'not run': 'bg-muted text-muted-foreground',
};

const SEVERITY_ORDER: Severity[] = ['block', 'hold', 'warn', 'info'];
const STEP_ONE = new Set(['event', 'start', 'skip', 'decision']);

function latestRun(entries: LogEntry[]): LogEntry[] {
  const startIndex = entries.findIndex((e) => e.step === 'start');
  const index = startIndex === -1 ? entries.findIndex((e) => e.step === 'skip') : startIndex;
  if (index === -1) return [];
  let end = index + 1;
  while (
    end < entries.length &&
    (entries[end].step === 'event' || entries[end].step === 'decision')
  ) {
    end += 1;
  }
  return entries.slice(0, end).reverse();
}

function triggerOf(start: LogEntry | undefined, record: HandoffCase) {
  const match = start?.message.match(/^Processing \((.*)\)$/);
  if (match) return match[1];
  const last = record.history.at(-1)?.summary;
  return last ? last.split(':')[0] : 'no run logged';
}

function matchActions(actions: Action[], run: LogEntry[]): ActionRun[] {
  const used = new Set<number>();
  return actions.map((action) => {
    const entry = run.find((e) => e.step === action.type && !used.has(e.id));
    if (entry) used.add(entry.id);
    const outcome = entry ? (entry.level === 'error' ? 'failed' : 'ran') : 'not run';
    return { action, entry, outcome };
  });
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function Rows({ children }: { children: ReactNode }) {
  return <div className="flex flex-col divide-y rounded-lg border text-sm">{children}</div>;
}

function Row({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-start gap-3 px-3 py-2', className)}>{children}</div>
  );
}

function Time({ at }: { at: string }) {
  return (
    <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
      {formatDateTime(at)}
    </span>
  );
}

function EntryRows({ entries }: { entries: LogEntry[] }) {
  return (
    <Rows>
      {entries.map((entry) => (
        <Row key={entry.id}>
          <Time at={entry.at} />
          <LevelBadge level={entry.level} />
          <code className="font-mono text-muted-foreground text-xs">{entry.step}</code>
          <div className="min-w-0 flex-1">
            <div>{entry.message}</div>
            {entry.detail !== undefined ? (
              <details className="mt-1">
                <summary className="cursor-pointer text-muted-foreground text-xs">Detail</summary>
                <div className="pt-2">
                  <Json value={entry.detail} />
                </div>
              </details>
            ) : null}
          </div>
        </Row>
      ))}
    </Rows>
  );
}

function FindingRows({ findings }: { findings: Finding[] }) {
  return (
    <div className="flex flex-col gap-3">
      {SEVERITY_ORDER.map((severity) => {
        const group = findings.filter((f) => f.severity === severity);
        if (group.length === 0) return null;
        return (
          <div key={severity} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <SeverityBadge severity={severity} />
              <span className="text-muted-foreground text-xs">
                {plural(group.length, 'finding')}
              </span>
            </div>
            <Rows>
              {group.map((f, index) => (
                <Row key={`${f.rule}-${index}`}>
                  <code className="w-10 shrink-0 pt-0.5 font-mono text-xs">{f.rule}</code>
                  <div className="min-w-0 flex-1">
                    {f.message}
                    {f.field ? (
                      <code className="ml-2 font-mono text-muted-foreground text-xs">
                        {f.field}
                      </code>
                    ) : null}
                  </div>
                  <Chip className="font-sans">{OWNER_LABEL[f.owner]}</Chip>
                </Row>
              ))}
            </Rows>
          </div>
        );
      })}
    </div>
  );
}

function PlanRows({ actions }: { actions: Action[] }) {
  return (
    <Rows>
      {actions.map((action, index) => (
        <Row key={`${action.type}-${index}`} className="items-center">
          <span className="w-20 shrink-0 text-xs capitalize">{action.system}</span>
          <code className="font-mono text-muted-foreground text-xs">{action.type}</code>
          <span className="min-w-0 flex-1">{action.summary}</span>
        </Row>
      ))}
    </Rows>
  );
}

function ActionRows({ runs }: { runs: ActionRun[] }) {
  return (
    <Rows>
      {runs.map(({ action, entry, outcome }, index) => (
        <Row key={`${action.type}-${index}`}>
          <span
            className={cn(
              'inline-flex h-5 w-16 shrink-0 items-center justify-center rounded-md text-[11px]',
              OUTCOME[outcome],
            )}
          >
            {outcome}
          </span>
          <span className="w-20 shrink-0 pt-0.5 text-xs capitalize">{action.system}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <span>{action.summary}</span>
              <code className="font-mono text-muted-foreground text-xs">{action.type}</code>
            </div>
            {outcome === 'failed' && entry ? (
              <div className="mt-1 text-red-700 text-xs dark:text-red-400">{entry.message}</div>
            ) : null}
            <details className="mt-1">
              <summary className="cursor-pointer text-muted-foreground text-xs">Params</summary>
              <div className="pt-2">
                <Json value={action.params} />
              </div>
            </details>
          </div>
          {entry ? <Time at={entry.at} /> : null}
        </Row>
      ))}
    </Rows>
  );
}

function stageStep(
  title: string,
  stage: Stage,
  runs: ActionRun[],
  extra: { reached: boolean; held: boolean; sent: LogEntry[] },
): Step {
  const total = runs.length;
  const ran = runs.filter((r) => r.outcome === 'ran').length;
  const failed = runs.find((r) => r.outcome === 'failed');
  const notRun = runs.filter((r) => r.outcome === 'not run').length;
  const sent = extra.sent.length > 0 ? <EntryRows entries={extra.sent} /> : null;

  if (total === 0) {
    if (stage === 'billing' && extra.held) {
      return {
        title,
        tone: 'warn',
        result: 'Held: money waits until the findings above are fixed',
        body: sent,
      };
    }
    return {
      title,
      tone: 'idle',
      result: stage === 'setup' ? 'Nothing to set up' : 'Nothing to bill',
      body: sent,
    };
  }
  const body = (
    <div className="flex flex-col gap-3">
      <ActionRows runs={runs} />
      {sent}
    </div>
  );
  if (failed) {
    return {
      title,
      tone: 'bad',
      result: `${failed.action.type} failed after ${ran} of ${total} ran`,
      body,
      open: true,
    };
  }
  if (!extra.reached || notRun === total) {
    return {
      title,
      tone: 'idle',
      result: `${plural(total, `${stage} action`)} planned, none ran`,
      body,
    };
  }
  if (notRun > 0) {
    return { title, tone: 'warn', result: `${ran} of ${total} ${stage} actions ran`, body };
  }
  return {
    title,
    tone: 'good',
    result: total === 1 ? `The ${stage} action ran` : `All ${total} ${stage} actions ran`,
    body,
  };
}

function buildSteps(record: HandoffCase, run: LogEntry[]): Step[] {
  const started = run.some((e) => e.step === 'start');
  const ended = run.some((e) => e.step === 'end');
  const event = run.find((e) => e.step === 'event');
  const skip = run.find((e) => e.step === 'skip');
  const held = record.findings.some((f) => f.severity === 'hold' || f.severity === 'block');
  const executed = record.executed;
  const mono = (value: string | undefined) => (value ? <Chip>{value}</Chip> : null);

  const stepOne = run.filter((e) => STEP_ONE.has(e.step));
  const receive: Step = {
    title: 'Receive the event',
    tone: started ? 'good' : 'idle',
    result: started
      ? event
        ? `${event.message} from Salesforce`
        : `Started by ${triggerOf(
            run.find((e) => e.step === 'start'),
            record,
          )}`
      : skip
        ? skip.message
        : 'No run logged for this deal',
    body: stepOne.length > 0 ? <EntryRows entries={stepOne} /> : null,
  };

  const collect: Step = {
    title: 'Collect the deal and what exists',
    tone: started ? 'good' : 'idle',
    result: (
      <span className="flex flex-wrap items-center gap-2">
        Read opportunity, account, line items, existing records
        <Chip className="font-sans">{record.recordType}</Chip>
      </span>
    ),
    body: (
      <div className="rounded-lg border p-3">
        <Fields
          items={[
            ['Opportunity', <Chip key="o">{record.opportunityId}</Chip>],
            ['Account', `${record.accountName}`],
            ['Account id', <Chip key="a">{record.accountId}</Chip>],
            ['Owner', <Chip key="u">{record.ownerId}</Chip>],
            ['Record type', record.recordType],
            ['Assessed at', formatDateTime(record.assessedAt)],
          ]}
        />
      </div>
    ),
  };

  const counts = SEVERITY_ORDER.map(
    (s) => [s, record.findings.filter((f) => f.severity === s).length] as const,
  ).filter(([, n]) => n > 0);
  const assess: Step = {
    title: 'Assess against finance rules',
    tone: !started
      ? 'idle'
      : counts.some(([s]) => s === 'block')
        ? 'bad'
        : counts.some(([s]) => s === 'hold' || s === 'warn')
          ? 'warn'
          : 'good',
    result:
      record.findings.length === 0
        ? 'No findings, everything checked out'
        : `${plural(record.findings.length, 'finding')}: ${counts.map(([s, n]) => `${n} ${s}`).join(', ')}`,
    body: record.findings.length > 0 ? <FindingRows findings={record.findings} /> : null,
    open: held,
  };

  const setup = record.plan.filter((a) => a.stage === 'setup');
  const billing = record.plan.filter((a) => a.stage === 'billing');
  const plan: Step = {
    title: 'Plan actions',
    tone: !started ? 'idle' : record.plan.length > 0 ? 'good' : 'idle',
    result:
      record.plan.length === 0
        ? 'Nothing to do, everything is already in place'
        : [
            setup.length > 0 ? plural(setup.length, 'setup action') : null,
            billing.length > 0 ? plural(billing.length, 'billing action') : null,
          ]
            .filter(Boolean)
            .join(' and ')
            .concat(' planned'),
    body:
      record.plan.length === 0 ? null : (
        <div className="flex flex-col gap-3">
          {setup.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <div className="text-muted-foreground text-xs">
                Setup, runs even when billing is held
              </div>
              <PlanRows actions={setup} />
            </div>
          ) : null}
          {billing.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <div className="text-muted-foreground text-xs">
                Billing, runs only when every finding is info or warn
              </div>
              <PlanRows actions={billing} />
            </div>
          ) : null}
        </div>
      ),
  };

  const runSetup = stageStep('Run setup actions', 'setup', matchActions(setup, run), {
    reached: started,
    held,
    sent: [],
  });
  const runBilling = stageStep('Run billing actions', 'billing', matchActions(billing, run), {
    reached: started,
    held,
    sent: run.filter((e) => e.step === 'send_invoice'),
  });

  const writebacks = run.filter((e) => e.step === 'writeback');
  const writebackFailed = writebacks.some((e) => e.level === 'error');
  const writeback: Step = {
    title: 'Write back to Salesforce',
    tone: writebacks.length === 0 ? 'idle' : writebackFailed ? 'bad' : 'good',
    result:
      writebacks.length === 0
        ? 'Not reached'
        : writebackFailed
          ? 'Salesforce write-back failed'
          : `Salesforce updated with status ${record.status}`,
    body: (
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border p-3">
          <Fields
            items={[
              ['Handoff_Status__c', <CaseStatusBadge key="s" status={record.status} />],
              ['Subscription_ID__c', mono(executed.subscriptionId)],
              ['Invoice_Number__c', mono(executed.invoiceNumber)],
              [
                'Billing_Reference__c',
                mono(executed.stripeSubscriptionId ?? executed.invoiceNumber),
              ],
              ['Workspace', mono(executed.workspaceId)],
              [
                'Handoff_Issues__c',
                held
                  ? plural(
                      record.findings.filter((f) => f.severity === 'hold' || f.severity === 'block')
                        .length,
                      'issue',
                    )
                  : null,
              ],
            ]}
          />
        </div>
        {writebacks.length > 0 ? <EntryRows entries={writebacks} /> : null}
      </div>
    ),
    open: writebackFailed,
  };

  const notices = run.filter((e) => e.step === 'notify');
  const delivered = notices.filter((e) => e.level === 'info');
  const undelivered = notices.filter((e) => e.level !== 'info');
  const targets = delivered.map((e) => e.message.replace(/^Slack to /, ''));
  const notify: Step = {
    title: 'Notify in Slack',
    tone: notices.length === 0 ? 'idle' : undelivered.length > 0 ? 'warn' : 'good',
    result:
      notices.length === 0
        ? ended
          ? 'Nothing new to tell anyone'
          : 'Not reached'
        : [
            delivered.length > 0 ? `Slack to ${targets.join(', ')}` : null,
            undelivered.length > 0
              ? `${plural(undelivered.length, 'message')} not delivered`
              : null,
          ]
            .filter(Boolean)
            .join(', '),
    body:
      notices.length === 0 ? null : (
        <Rows>
          {notices.map((entry) => (
            <Row key={entry.id}>
              <Time at={entry.at} />
              <LevelBadge level={entry.level} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {entry.level === 'info' ? (
                    <Chip>{entry.message.replace(/^Slack to /, '')}</Chip>
                  ) : (
                    <span>{entry.message}</span>
                  )}
                </div>
                {typeof entry.detail === 'string' ? (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-muted-foreground text-xs">
                      Message
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap rounded-md border bg-muted/50 p-3 font-sans text-xs">
                      {entry.detail}
                    </pre>
                  </details>
                ) : null}
              </div>
            </Row>
          ))}
        </Rows>
      ),
  };

  const end = run.find((e) => e.step === 'end');
  const save: Step = {
    title: 'Save case and log',
    tone: !end
      ? started
        ? 'bad'
        : 'idle'
      : record.status === 'done'
        ? 'good'
        : record.status === 'held'
          ? 'warn'
          : record.status === 'blocked'
            ? 'bad'
            : 'idle',
    result: end ? (
      <span className="flex flex-wrap items-center gap-2">
        Case saved as <CaseStatusBadge status={record.status} />
      </span>
    ) : started ? (
      'Run did not reach the end'
    ) : (
      'Nothing saved'
    ),
    body: (
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border p-3">
          <Fields
            items={[
              ['Status', <CaseStatusBadge key="s" status={record.status} />],
              ['Last replay id', String(record.lastReplayId)],
              ['Notified hash', mono(record.notifiedHash)],
            ]}
          />
        </div>
        {end ? <EntryRows entries={[end]} /> : null}
        {record.history.length > 0 ? <HistoryRows history={record.history} /> : null}
      </div>
    ),
  };

  return [receive, collect, assess, plan, runSetup, runBilling, writeback, notify, save];
}

function HistoryRows({ history }: { history: HandoffCase['history'] }) {
  const newestFirst = [...history].reverse();
  return (
    <Rows>
      {newestFirst.map((entry, index) => (
        <Row key={`${entry.at}-${index}`} className="items-baseline">
          <Time at={entry.at} />
          <span className="min-w-0 flex-1">{entry.summary}</span>
          {index === 0 ? <Chip className="font-sans">latest</Chip> : null}
        </Row>
      ))}
    </Rows>
  );
}

export async function StepsView({ record, entries }: { record: HandoffCase; entries: LogEntry[] }) {
  const run = latestRun(entries);
  const start = run.find((e) => e.step === 'start') ?? run.find((e) => e.step === 'skip');
  const steps = buildSteps(record, run);
  const earlier = record.history.length - 1;

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-muted/40 px-4 py-2 text-sm">
        <span>
          <span className="text-muted-foreground">Latest run:</span>{' '}
          <span className="font-medium">{triggerOf(start, record)}</span>
          {start ? (
            <span className="text-muted-foreground"> at {formatDateTime(start.at)}</span>
          ) : null}
        </span>
        {earlier > 0 ? (
          <span className="text-muted-foreground text-xs">{plural(earlier, 'earlier run')}</span>
        ) : null}
        <span className="ml-auto text-muted-foreground text-xs">
          {run.length} log {run.length === 1 ? 'entry' : 'entries'} in this run
        </span>
      </div>

      <ol className="flex flex-col">
        {steps.map((step, index) => (
          <li key={step.title} className="relative flex gap-4 pb-6 last:pb-0">
            {index < steps.length - 1 ? (
              <div aria-hidden className="absolute top-8 bottom-0 left-[15px] w-px bg-border" />
            ) : null}
            <div
              className={cn(
                'z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 font-medium text-xs tabular-nums',
                CIRCLE[step.tone],
              )}
            >
              {index + 1}
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-medium text-sm">{step.title}</span>
                <span className="text-muted-foreground text-sm">{step.result}</span>
              </div>
              {step.body ? (
                <details className="mt-2" open={step.open}>
                  <summary className="w-fit cursor-pointer select-none text-muted-foreground text-xs hover:text-foreground">
                    Details
                  </summary>
                  <div className="pt-3">{step.body}</div>
                </details>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <Section title="All runs" count={record.history.length}>
        {record.history.length === 0 ? (
          <EmptyState>No runs yet.</EmptyState>
        ) : (
          <HistoryRows history={record.history} />
        )}
      </Section>
    </>
  );
}
