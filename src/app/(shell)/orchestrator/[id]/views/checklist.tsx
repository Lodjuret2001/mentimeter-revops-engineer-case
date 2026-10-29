import { Check, Minus } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Section } from '@/components/shell/page';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime, formatMoney } from '@/lib/format';
import type { Finding, HandoffCase, LogEntry, OwnerRole } from '@/lib/orchestrator';
import { cn } from '@/lib/utils';
import { CaseStatusBadge, Chip, OWNER_LABEL, SeverityBadge } from '../../parts';

const CORE_RULES = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8'] as const;
const EXTRA_RULES = ['DD', 'D1', 'D2', 'MY', 'CC', 'WS', 'SF', 'EXEC'] as const;

const RULE_NAME: Record<string, string> = {
  R1: 'Payment method routing',
  R2: 'Card limit 10,000 EUR',
  R3: 'PO number present',
  R4: 'Legal entity, invoice email, VAT',
  R5: 'One subscription, one invoice',
  R6: 'Add-on co-termed and prorated',
  R7: 'Old subscription ended',
  R8: 'Amount and currency',
  DD: 'Discount approval',
  D1: 'Plan and licenses',
  D2: 'Dates',
  MY: 'Multi-year invoicing',
  CC: 'Card on file',
  WS: 'Workspace match',
  SF: 'Deal is Closed Won',
  EXEC: 'Actions ran',
};

const WAITS_FOR: Record<string, string> = {
  R1: 'a payment method',
  R2: 'a change of payment method',
  R3: 'PO number',
  R4: 'billing details',
  R5: 'a duplicate check',
  R6: 'the existing subscription',
  R7: 'a check of the old subscription',
  R8: 'a confirmed amount',
  DD: 'Deal Desk approval',
  D1: 'plan and licenses',
  D2: 'dates',
  MY: 'multi-year terms',
  CC: 'a new card',
  WS: 'a workspace choice',
  SF: 'the deal stage',
  EXEC: 'a failed action',
};

const WAITS_FOR_FIELD: Record<string, string> = {
  VAT_Number__c: 'VAT number',
  Invoice_Email__c: 'invoice email',
  Legal_Entity_Name__c: 'legal entity name',
  PO_Number__c: 'PO number',
  CurrencyIsoCode: 'currency confirmation',
  Discount_Approval__c: 'Deal Desk approval',
  Payment_Method__c: 'a change of payment method',
};

const BLOCKED_BY: Record<string, string> = {
  R6: 'no subscription to add to',
  R8: 'amount does not add up',
  D1: 'plan or licenses are invalid',
  D2: 'dates are invalid',
  WS: 'more than one workspace matches',
  SF: 'deal is not Closed Won',
  EXEC: 'a setup action failed',
};

const BLOCKED_BY_FIELD: Record<string, string> = {
  Number_of_Licenses__c: 'licenses disagree',
  Plan__c: 'plan is empty',
  Start_Date__c: 'start date is invalid',
  End_Date__c: 'end date is invalid',
};

const OWNER_ORDER: OwnerRole[] = ['rep', 'finance', 'credit', 'deal_desk', 'revops'];

type Billing = 'Kleer' | 'Stripe' | null;

function billingSystem(record: HandoffCase): Billing {
  for (const action of record.plan) {
    const system = action.params.billingSystem;
    if (system === 'Kleer' || system === 'Stripe') return system;
  }
  if (record.plan.some((a) => a.stage === 'billing' && a.system === 'kleer')) return 'Kleer';
  if (record.plan.some((a) => a.stage === 'billing' && a.system === 'stripe')) return 'Stripe';
  if (record.executed.invoiceNumber) return 'Kleer';
  if (record.executed.stripeSubscriptionId) return 'Stripe';
  return null;
}

function currencyOf(record: HandoffCase) {
  for (const action of record.plan) {
    const currency = action.params.currency;
    if (typeof currency === 'string') return currency;
  }
  return null;
}

function money(amount: number | undefined, currency: string | null) {
  if (amount === undefined) return null;
  if (currency) return formatMoney(amount, currency);
  return amount.toLocaleString('en-GB', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function listOf(values: string[]) {
  if (values.length <= 1) return values.join('');
  return `${values.slice(0, -1).join(', ')} and ${values[values.length - 1]}`;
}

function decisionSentence(record: HandoffCase, billing: Billing, open: Finding[]) {
  const holds = open.filter((f) => f.severity === 'hold');
  const blocks = open.filter((f) => f.severity === 'block');
  if (record.status === 'reopened') {
    return record.executed.subscriptionId
      ? 'Deal left Closed Won. It was already set up, review what to roll back.'
      : 'Deal left Closed Won. Nothing was changed.';
  }
  if (record.status === 'blocked' || blocks.length > 0) {
    const reasons = unique(
      blocks.map(
        (f) =>
          (f.field && BLOCKED_BY_FIELD[f.field]) ??
          BLOCKED_BY[f.rule] ??
          RULE_NAME[f.rule] ??
          f.rule,
      ),
    );
    return `Nothing was set up: ${listOf(reasons) || 'see the findings below'}.`;
  }
  if (record.status === 'held' || holds.length > 0) {
    const money = billing === 'Stripe' ? 'charge' : billing === 'Kleer' ? 'invoice' : 'billing';
    const needs = unique(
      holds.map(
        (f) =>
          (f.field && WAITS_FOR_FIELD[f.field]) ?? WAITS_FOR[f.rule] ?? RULE_NAME[f.rule] ?? f.rule,
      ),
    );
    const setUp = record.executed.subscriptionId
      ? 'Customer is set up.'
      : 'Customer is not set up.';
    return `${setUp} The ${money} waits for: ${listOf(needs) || 'review'}.`;
  }
  if (billing === 'Kleer' && record.executed.invoiceNumber) {
    return 'Set up and invoiced, nothing to do.';
  }
  if (billing === 'Stripe' && record.executed.stripeSubscriptionId) {
    return 'Set up and charged, nothing to do.';
  }
  return 'Set up and billed, nothing to do.';
}

type Result = 'pass' | 'na' | 'finding';

interface Row {
  rule: string;
  result: Result;
  findings: Finding[];
  evidence: ReactNode;
}

function passEvidence(
  rule: string,
  record: HandoffCase,
  billing: Billing,
  currency: string | null,
) {
  const x = record.executed;
  const amount = money(x.billedAmount, currency);
  switch (rule) {
    case 'R1':
      if (billing === 'Kleer') return 'Invoice → Kleer';
      if (billing === 'Stripe') return 'Card → Stripe';
      return 'Payment method not resolved';
    case 'R2':
      return amount ? `${amount} a year, within the card limit` : 'Within the card limit';
    case 'R3':
      return 'No PO required, or PO on the deal';
    case 'R4':
      if (billing === 'Stripe') return 'Customer name and billing email on the card customer';
      return 'Legal entity, invoice email and VAT on the account';
    case 'R5':
      if (x.invoiceNumber) return `One subscription (${x.subscriptionId}), one invoice`;
      if (x.stripeSubscriptionId) return `One subscription (${x.subscriptionId}), one charge`;
      if (x.subscriptionId) return `One subscription (${x.subscriptionId}), nothing billed yet`;
      return 'Nothing created yet';
    case 'R6':
      return x.addedSeats
        ? `Added ${x.addedSeats} licenses to ${x.subscriptionId ?? 'the subscription'}`
        : 'Existing subscription updated';
    case 'R7':
      return x.oldSubscriptionId ? `${x.oldSubscriptionId} ended` : 'No overlap';
    case 'R8':
      return amount
        ? `${amount}, licenses × list price × (1 − discount)`
        : 'Licenses × list price × (1 − discount)';
    default:
      return '';
  }
}

function naEvidence(rule: string, billing: Billing) {
  switch (rule) {
    case 'R2':
      return billing === 'Kleer' ? 'Invoice deal, no card limit' : 'No card payment';
    case 'R3':
      return 'Card deal, no PO on an invoice';
    case 'R6':
      return 'Not an add-on';
    case 'R7':
      return 'No earlier subscription';
    default:
      return 'Does not apply';
  }
}

function applies(rule: string, record: HandoffCase, billing: Billing) {
  const x = record.executed;
  switch (rule) {
    case 'R2':
      return billing === 'Stripe' || Boolean(x.stripeSubscriptionId);
    case 'R3':
      return billing !== 'Stripe';
    case 'R6':
      return record.recordType === 'Add_on';
    case 'R7':
      return Boolean(x.oldSubscriptionId);
    default:
      return true;
  }
}

function buildRows(record: HandoffCase, billing: Billing, currency: string | null): Row[] {
  const byRule = new Map<string, Finding[]>();
  for (const finding of record.findings) {
    byRule.set(finding.rule, [...(byRule.get(finding.rule) ?? []), finding]);
  }
  const rows: Row[] = [];
  for (const rule of CORE_RULES) {
    const findings = byRule.get(rule) ?? [];
    if (findings.length > 0) {
      rows.push({ rule, result: 'finding', findings, evidence: null });
    } else if (applies(rule, record, billing)) {
      rows.push({
        rule,
        result: 'pass',
        findings,
        evidence: passEvidence(rule, record, billing, currency),
      });
    } else {
      rows.push({ rule, result: 'na', findings, evidence: naEvidence(rule, billing) });
    }
  }
  for (const rule of EXTRA_RULES) {
    const findings = byRule.get(rule) ?? [];
    if (findings.length > 0) rows.push({ rule, result: 'finding', findings, evidence: null });
  }
  return rows;
}

function ResultCell({ row }: { row: Row }) {
  if (row.result === 'pass') {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-emerald-700 text-xs dark:text-emerald-400">
        <Check className="size-3.5" aria-hidden />
        Pass
      </span>
    );
  }
  if (row.result === 'na') {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
        <Minus className="size-3.5" aria-hidden />
        n/a
      </span>
    );
  }
  const worst = [...row.findings].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  )[0];
  return <SeverityBadge severity={worst.severity} />;
}

const SEVERITY_RANK = { block: 0, hold: 1, warn: 2, info: 3 } as const;

function FieldChip({ field }: { field?: string }) {
  if (!field) return null;
  return <Chip className="ml-2 align-middle">{field}</Chip>;
}

function Line({ label, children, muted }: { label: string; children: ReactNode; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground text-xs">{label}</span>
      <span className={cn('text-right', muted && 'text-muted-foreground')}>{children}</span>
    </div>
  );
}

function AdminLink({ id, tab }: { id: string; tab?: 'workspaces' }) {
  const href = tab ? `/admin-app?tab=${tab}` : '/admin-app';
  return (
    <Link href={href} className="font-mono text-xs hover:underline">
      {id}
    </Link>
  );
}

export function DecisionCard({ record }: { record: HandoffCase }) {
  const billing = billingSystem(record);
  const open = record.findings.filter((f) => f.severity === 'hold' || f.severity === 'block');
  const sentence = decisionSentence(record, billing, open);
  const owners = OWNER_ORDER.filter((owner) => open.some((f) => f.owner === owner));
  return (
    <Section title="Decision">
      <div className="rounded-lg border">
        <div className="flex flex-wrap items-center gap-3 px-4 py-4">
          <CaseStatusBadge status={record.status} />
          <p className="font-medium text-base">{sentence}</p>
        </div>
        <div className="border-t px-4 py-3">
          <div className="mb-2 text-muted-foreground text-xs uppercase tracking-wider">
            Next step
          </div>
          {owners.length === 0 ? (
            <p className="text-muted-foreground text-sm">No action needed.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {owners.map((owner) => (
                <div key={owner} className="flex flex-col gap-1 sm:flex-row sm:gap-4">
                  <div className="w-32 shrink-0 pt-0.5">
                    <Chip className="font-sans">{OWNER_LABEL[owner]}</Chip>
                  </div>
                  <ul className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                    {open
                      .filter((f) => f.owner === owner)
                      .map((f, index) => (
                        <li key={`${f.rule}-${index}`}>
                          {f.message}
                          <FieldChip field={f.field} />
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

export async function ChecklistView({
  record,
  entries,
}: {
  record: HandoffCase;
  entries: LogEntry[];
}) {
  const billing = billingSystem(record);
  const currency = currencyOf(record);
  const open = record.findings.filter((f) => f.severity === 'hold' || f.severity === 'block');
  const rows = buildRows(record, billing, currency);
  const x = record.executed;
  const amount = money(x.billedAmount, currency);
  const history = [...record.history].reverse();
  const logHref = `/orchestrator/log?opportunity=${encodeURIComponent(record.opportunityId)}`;

  return (
    <>
      <DecisionCard record={record} />

      <Section title="Checklist" count={rows.length}>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-64">Rule</TableHead>
                <TableHead className="w-20">Result</TableHead>
                <TableHead>Evidence</TableHead>
                <TableHead className="w-32">Owner</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.rule}
                  className={cn('align-top', row.result === 'na' && 'text-muted-foreground')}
                >
                  <TableCell>
                    <div className="flex items-baseline gap-2">
                      <code className="w-9 shrink-0 font-mono text-xs">{row.rule}</code>
                      <span className="text-sm">{RULE_NAME[row.rule] ?? row.rule}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <ResultCell row={row} />
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.result === 'finding' ? (
                      <ul className="flex flex-col gap-1">
                        {row.findings.map((f, index) => (
                          <li key={`${f.rule}-${index}`}>
                            {f.message}
                            <FieldChip field={f.field} />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className={cn(row.result === 'pass' && 'text-muted-foreground')}>
                        {row.evidence}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.result === 'finding' ? (
                      <div className="flex flex-wrap gap-1">
                        {unique(row.findings.map((f) => f.owner)).map((owner) => (
                          <Chip key={owner} className="font-sans">
                            {OWNER_LABEL[owner as OwnerRole]}
                          </Chip>
                        ))}
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Section>

      <Section title="What was done">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border px-4 py-3">
            <div className="mb-1 text-muted-foreground text-xs uppercase tracking-wider">
              Access
            </div>
            <div className="divide-y">
              <Line label="Workspace" muted={!x.workspaceId}>
                {x.workspaceId ? <AdminLink id={x.workspaceId} tab="workspaces" /> : 'Not created'}
              </Line>
              <Line label="Subscription" muted={!x.subscriptionId}>
                {x.subscriptionId ? <AdminLink id={x.subscriptionId} /> : 'Not created'}
              </Line>
              {x.addedSeats ? (
                <Line label="Licenses added">
                  <span className="tabular-nums">{x.addedSeats}</span>
                </Line>
              ) : null}
              <Line label="Old subscription" muted={!x.oldSubscriptionId}>
                {x.oldSubscriptionId ? (
                  <>
                    <AdminLink id={x.oldSubscriptionId} /> ended
                  </>
                ) : (
                  'None'
                )}
              </Line>
            </div>
          </div>
          <div className="rounded-lg border px-4 py-3">
            <div className="mb-1 text-muted-foreground text-xs uppercase tracking-wider">Money</div>
            <div className="divide-y">
              {x.invoiceNumber ? (
                <>
                  <Line label="Kleer invoice">
                    <span className="font-mono text-xs">{x.invoiceNumber}</span>
                  </Line>
                  {x.kleerCustomerNumber ? (
                    <Line label="Kleer customer">
                      <span className="font-mono text-xs">{x.kleerCustomerNumber}</span>
                    </Line>
                  ) : null}
                  <Line label="Amount">
                    <span className="tabular-nums">{amount}</span>
                  </Line>
                </>
              ) : x.stripeSubscriptionId ? (
                <>
                  <Line label="Stripe subscription">
                    <span className="font-mono text-xs">{x.stripeSubscriptionId}</span>
                  </Line>
                  {x.stripeCustomerId ? (
                    <Line label="Stripe customer">
                      <span className="font-mono text-xs">{x.stripeCustomerId}</span>
                    </Line>
                  ) : null}
                  <Line label="Amount">
                    <span className="tabular-nums">{amount}</span>
                  </Line>
                </>
              ) : (
                <>
                  <Line label={billing === 'Stripe' ? 'Charge' : 'Invoice'}>
                    <span className="font-medium">
                      {record.status === 'held' ? 'Held' : 'Not created'}
                    </span>
                  </Line>
                  <Line label="Reason" muted>
                    {open.length > 0
                      ? listOf(unique(open.map((f) => RULE_NAME[f.rule] ?? f.rule)))
                      : record.status === 'reopened'
                        ? 'Deal left Closed Won'
                        : 'Nothing to bill'}
                  </Line>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-1 text-xs">
          <span className="text-muted-foreground uppercase tracking-wider">Audit</span>
          {history.length === 0 ? (
            <span className="text-muted-foreground">No runs yet.</span>
          ) : (
            <ol className="flex min-w-0 flex-1 flex-col gap-0.5">
              {history.map((entry, index) => (
                <li key={`${entry.at}-${index}`} className="flex flex-wrap gap-x-3">
                  <span className="w-24 shrink-0 text-muted-foreground tabular-nums">
                    {formatDateTime(entry.at)}
                  </span>
                  <span>{entry.summary}</span>
                </li>
              ))}
            </ol>
          )}
          <Link href={logHref} className="ml-auto text-primary hover:underline">
            Full log ({entries.length})
          </Link>
        </div>
      </Section>
    </>
  );
}
