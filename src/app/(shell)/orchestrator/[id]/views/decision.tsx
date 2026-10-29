import { Section } from '@/components/shell/page';
import { salesforce } from '@/lib/connectors';
import type { Finding, HandoffCase, OwnerRole } from '@/lib/orchestrator';
import type { SalesforceUser } from '@/lib/systems/types';
import { CaseStatusBadge, Chip } from '../../parts';

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

function FieldChip({ field }: { field?: string }) {
  if (!field) return null;
  return <Chip className="ml-2 align-middle">{field}</Chip>;
}

async function assignees(record: HandoffCase): Promise<Record<OwnerRole, string>> {
  const users = await salesforce.listUsers().catch(() => []);
  const name = (user: SalesforceUser | undefined, fallback: string) =>
    user ? `${user.Name} (${fallback})` : fallback;
  return {
    rep: name(
      users.find((u) => u.Id === record.ownerId),
      'deal owner',
    ),
    finance: name(
      users.find((u) => /billing/i.test(u.Title)),
      'finance',
    ),
    credit: name(
      users.find((u) => /credit/i.test(u.Title)),
      'credit control',
    ),
    revops: name(
      users.find((u) => u.UserRole.Name === 'RevOps'),
      'RevOps',
    ),
    deal_desk: 'Deal Desk (#deal-desk)',
  };
}

export async function DecisionCard({ record }: { record: HandoffCase }) {
  const billing = billingSystem(record);
  const open = record.findings.filter((f) => f.severity === 'hold' || f.severity === 'block');
  const sentence = decisionSentence(record, billing, open);
  const owners = OWNER_ORDER.filter((owner) => open.some((f) => f.owner === owner));
  const who = await assignees(record);
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
                  <div className="w-56 shrink-0 pt-0.5">
                    <Chip className="font-sans">{who[owner]}</Chip>
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
