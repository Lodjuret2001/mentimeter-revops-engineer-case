import { ArrowRight, BookOpen, Workflow, Wrench } from 'lucide-react';
import Link from 'next/link';
import { DealsTable } from '@/components/data/deals-table';
import { Page, PageHeader, Section } from '@/components/shell/page';
import { SlackMessageText } from '@/components/slack/ui';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { salesforce, slack } from '@/lib/connectors';
import { CASE_WEEK_START, formatDateTime } from '@/lib/format';
import { type CaseStatus, getState, listCases } from '@/lib/orchestrator';
import { syncAction } from './orchestrator/actions';
import { CaseStatusBadge } from './orchestrator/parts';

const STEPS = [
  ['Receive', 'A Closed Won event arrives from Salesforce, or is pulled from the feed.'],
  ['Collect', 'The deal as it is now, the account, and what already exists in every system.'],
  ['Assess', 'Finance rules R1 to R8 plus data checks. Every finding gets an owner and a field.'],
  ['Set up', 'Workspace and subscription in the admin app, old subscriptions ended.'],
  ['Bill', 'Kleer draft or Stripe charge, only when nothing is on hold.'],
  ['Write back', 'IDs and status onto the opportunity and account in Salesforce.'],
  ['Notify', 'The one person who can fix it, in Slack. CSM, finance and RevOps as needed.'],
  ['Remember', 'A case and a log per deal. The same event twice changes nothing.'],
] as const;

const STATUSES: CaseStatus[] = ['done', 'held', 'blocked', 'reopened'];

const STATUS_HINT: Record<CaseStatus, string> = {
  done: 'set up and billed',
  held: 'set up, money waits',
  blocked: 'nothing set up',
  reopened: 'left Closed Won',
};

export default async function HomePage() {
  const [opportunities, accounts, users, channels, slackUsers] = await Promise.all([
    salesforce.listOpportunities({ closedAfter: CASE_WEEK_START }),
    salesforce.listAccounts(),
    salesforce.listUsers(),
    slack.listChannels(),
    slack.listUsers(),
  ]);
  const won = opportunities
    .filter((o) => o.StageName === 'Closed Won')
    .sort((a, b) => a.CloseDate.localeCompare(b.CloseDate));
  const cases = listCases();
  const state = getState();
  const counts = Object.fromEntries(
    STATUSES.map((s) => [s, cases.filter((c) => c.status === s).length]),
  ) as Record<CaseStatus, number>;
  const finance = channels.find((c) => c.name === 'finance-billing');
  const recent = finance ? (await slack.history(finance.id)).slice(0, 4) : [];
  const needsAction = cases
    .filter((c) => c.status === 'held' || c.status === 'blocked')
    .slice(0, 5);

  return (
    <Page>
      <PageHeader
        eyebrow="RevOps Engineer case"
        title="Menti Orchestrator"
        description="Every Closed Won deal used to be copied by hand into the admin app, Kleer and Stripe. Menti Orchestrator listens to Salesforce, checks each deal against the finance rules, sets the customer up, drafts the invoice, writes the IDs back and tells the one person who can fix what is missing."
        actions={
          <div className="flex items-center gap-2">
            <form action={syncAction}>
              <Button variant="outline" type="submit">
                Sync Salesforce events
              </Button>
            </form>
            <Button render={<Link href="/orchestrator" />}>
              Open Menti Orchestrator
              <ArrowRight className="size-4" />
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STATUSES.map((status) => (
          <Link key={status} href={`/orchestrator?status=${status}`}>
            <Card size="sm" className="transition-colors hover:border-foreground/30">
              <CardHeader>
                <CardDescription className="flex items-center gap-2">
                  <CaseStatusBadge status={status} />
                  <span>{STATUS_HINT[status]}</span>
                </CardDescription>
                <div className="font-semibold text-3xl tabular-nums">{counts[status]}</div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Workflow className="size-4 text-primary" />
              How a deal moves through it
            </CardTitle>
            <CardDescription>
              {cases.length === 0
                ? 'Nothing has run yet. Press Sync Salesforce events, or send this week’s events from Dev tools to the webhook.'
                : `${cases.length} deals handled, event cursor at ${state.cursor} of this week’s 21 events.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {STEPS.map(([title, text], index) => (
                <li key={title} className="flex gap-3 text-sm">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border font-medium text-xs tabular-nums">
                    {index + 1}
                  </span>
                  <span>
                    <span className="font-medium">{title}.</span>{' '}
                    <span className="text-muted-foreground">{text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Try it in three clicks</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p>
              <span className="font-medium">1.</span> Open{' '}
              <Link href="/deals?view=open" className="text-primary hover:underline">
                an open deal
              </Link>{' '}
              such as Orbital Freight and press <span className="font-medium">Mark Closed Won</span>
              . It lands on its case: set up, invoice held, Jordan asked for a PO number.
            </p>
            <p>
              <span className="font-medium">2.</span> Press{' '}
              <span className="font-medium">Open in Salesforce</span>, fill in the PO number under
              Edit and save. The orchestrator runs again.
            </p>
            <p>
              <span className="font-medium">3.</span> Back on the case it is done. The draft is in{' '}
              <Link href="/kleer" className="text-primary hover:underline">
                Kleer
              </Link>{' '}
              and Maja has the link in{' '}
              <Link
                href={`/slack?channel=${finance?.id ?? ''}`}
                className="text-primary hover:underline"
              >
                #finance-billing
              </Link>
              .
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                {
                  href: '/orchestrator?status=held,blocked',
                  icon: Workflow,
                  label: 'Needs action',
                },
                { href: '/deals', icon: BookOpen, label: 'This week’s deals' },
                { href: '/dev', icon: Wrench, label: 'Dev tools' },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs hover:bg-muted"
                >
                  <item.icon className="size-3.5 text-primary" />
                  {item.label}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {needsAction.length > 0 ? (
        <Section title="Waiting on someone" count={needsAction.length}>
          <div className="flex flex-col divide-y rounded-lg border text-sm">
            {needsAction.map((c) => {
              const first = c.findings.find((f) => f.severity === 'hold' || f.severity === 'block');
              return (
                <Link
                  key={c.opportunityId}
                  href={`/orchestrator/${c.opportunityId}`}
                  className="flex flex-wrap items-center gap-3 px-4 py-2 hover:bg-muted/50"
                >
                  <CaseStatusBadge status={c.status} />
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground">
                    {users.find((u) => u.Id === c.ownerId)?.Name ?? c.ownerId}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {first ? `${first.rule}: ${first.message}` : ''}
                  </span>
                </Link>
              );
            })}
          </div>
        </Section>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Section title="Closed Won this week" count={won.length} className="lg:col-span-2">
          <DealsTable opportunities={won} accounts={accounts} users={users} />
        </Section>
        <Section title="#finance-billing">
          <Card>
            <CardContent className="flex flex-col gap-3">
              {recent.map((m) => (
                <div key={m.ts} className="text-sm">
                  <div className="text-muted-foreground text-xs">
                    <span className="font-medium text-foreground">
                      {slackUsers.find((u) => u.id === m.user)?.real_name ?? 'Menti Orchestrator'}
                    </span>{' '}
                    {formatDateTime(m.postedAt)}
                  </div>
                  <p className="line-clamp-3 whitespace-pre-line">
                    {slackText(m.text, slackUsers)}
                  </p>
                </div>
              ))}
              <Link
                href={`/slack?channel=${finance?.id ?? ''}`}
                className="text-primary text-sm hover:underline"
              >
                Open in Slack
              </Link>
            </CardContent>
          </Card>
        </Section>
      </div>
    </Page>
  );
}
