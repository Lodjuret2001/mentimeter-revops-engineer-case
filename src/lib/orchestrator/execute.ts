import { adminApp, ConnectorError, kleer, salesforce, stripe } from '@/lib/connectors';
import type { CreateKleerInvoiceInput } from '@/lib/connectors/kleer';
import type { DealContext } from './collect';
import { log } from './store';
import type { Action, Executed, Finding } from './types';

export interface ExecutionResult {
  executed: Executed;
  ran: Action[];
  failures: Finding[];
  stripePastDue: boolean;
}

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
const num = (v: unknown) => (typeof v === 'number' ? v : undefined);

export async function execute(
  ctx: DealContext,
  actions: Action[],
  previous: Executed,
): Promise<ExecutionResult> {
  const o = ctx.opportunity;
  const a = ctx.account;
  const executed: Executed = { ...previous };
  const ran: Action[] = [];
  const failures: Finding[] = [];
  let stripePastDue = false;
  let workspaceId =
    previous.workspaceId ?? ctx.linkedWorkspace?.id ?? ctx.workspacesByDomain[0]?.id;
  let kleerCustomerNumber = previous.kleerCustomerNumber ?? ctx.kleerCustomer?.customerNumber;
  let stripeCustomerId = previous.stripeCustomerId ?? ctx.stripeCustomers[0]?.id;
  const key = (suffix: string) => `opp:${o.Id}:${suffix}`;

  for (const action of actions) {
    const p = action.params;
    try {
      switch (action.type) {
        case 'link_workspace': {
          const id = str(p.workspaceId) as string;
          await adminApp.updateWorkspace(id, { salesforceAccountId: a.Id });
          await salesforce.updateAccount(a.Id, { Workspace_ID__c: id });
          workspaceId = id;
          break;
        }
        case 'create_workspace': {
          const w = await adminApp.createWorkspace({
            name: str(p.name) as string,
            salesforceAccountId: a.Id,
            domain: a.Website?.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] ?? null,
            region: p.region === 'US' ? 'US' : 'EU',
          });
          await salesforce.updateAccount(a.Id, { Workspace_ID__c: w.id });
          workspaceId = w.id;
          break;
        }
        case 'set_workspace_plan': {
          if (!workspaceId) throw new Error('No workspace to set the plan on');
          await adminApp.updateWorkspace(workspaceId, { plan: str(p.plan) });
          break;
        }
        case 'create_subscription': {
          if (!workspaceId) throw new Error('No workspace to create the subscription on');
          const s = await adminApp.createSubscription({
            workspaceId,
            salesforceAccountId: a.Id,
            plan: str(p.plan) as string,
            seats: num(p.seats) as number,
            startDate: str(p.startDate) as string,
            endDate: str(p.endDate) as string,
            billingSystem: p.billingSystem === 'Stripe' ? 'Stripe' : 'Kleer',
            status: p.status === 'Scheduled' ? 'Scheduled' : 'Active',
            autoRenew: p.autoRenew === true,
          });
          executed.subscriptionId = s.id;
          break;
        }
        case 'update_subscription': {
          const id = str(p.subscriptionId) as string;
          const changes: Record<string, unknown> = { ...p };
          delete changes.subscriptionId;
          delete changes.addedSeats;
          await adminApp.updateSubscription(id, changes);
          executed.subscriptionId = id;
          if (num(p.addedSeats) !== undefined) executed.addedSeats = num(p.addedSeats);
          break;
        }
        case 'end_old_subscription': {
          const id = str(p.subscriptionId) as string;
          const changes: Record<string, unknown> = { ...p };
          delete changes.subscriptionId;
          await adminApp.updateSubscription(id, changes);
          executed.oldSubscriptionId = id;
          break;
        }
        case 'stop_stripe_renewal':
          await stripe.updateSubscription(
            str(p.stripeSubscriptionId) as string,
            { cancel_at_period_end: true },
            { idempotencyKey: key('stop-renewal') },
          );
          break;
        case 'cancel_stripe_subscription':
          await stripe.cancelSubscription(str(p.stripeSubscriptionId) as string);
          break;
        case 'ensure_kleer_customer': {
          const c = await kleer.createCustomer({
            name: str(p.name) as string,
            email: str(p.email) as string,
            country: str(p.country) as string,
            currency: str(p.currency) as string,
            vatNumber: str(p.vatNumber) ?? null,
            address: str(p.address) || null,
          });
          kleerCustomerNumber = c.customerNumber;
          await salesforce.updateAccount(a.Id, { Kleer_Customer_Number__c: c.customerNumber });
          break;
        }
        case 'replace_kleer_draft':
        case 'create_kleer_draft': {
          if (!kleerCustomerNumber) throw new Error('No Kleer customer for the invoice');
          if (action.type === 'replace_kleer_draft') {
            await kleer.deleteDraft(str(p.invoiceNumber) as string);
          }
          const { invoiceNumber: _drop, ...input } = p as Record<string, unknown>;
          const invoice = await kleer.createInvoice({
            ...(input as Omit<CreateKleerInvoiceInput, 'customerNumber'>),
            customerNumber: kleerCustomerNumber,
          });
          executed.invoiceNumber = invoice.invoiceNumber;
          executed.billedAmount = invoice.netAmount;
          if (executed.subscriptionId && !executed.addedSeats) {
            await adminApp.updateSubscription(executed.subscriptionId, {
              billingReference: invoice.invoiceNumber,
            });
          }
          break;
        }
        case 'ensure_stripe_customer': {
          const c = await stripe.createCustomer(
            {
              name: str(p.name) as string,
              email: str(p.email) as string,
              currency: str(p.currency),
              metadata: {
                workspace_id: workspaceId ?? '',
                salesforce_account_id: a.Id,
              },
            },
            { idempotencyKey: key('customer') },
          );
          stripeCustomerId = c.id;
          break;
        }
        case 'create_stripe_subscription': {
          if (!stripeCustomerId) throw new Error('No Stripe customer to subscribe');
          const s = await stripe.createSubscription(
            {
              customer: stripeCustomerId,
              plan: str(p.plan) as string,
              quantity: num(p.quantity) as number,
              currency: str(p.currency) as string,
              amount: num(p.amount) as number,
              start_date: str(p.start_date),
              metadata: {
                salesforce_opportunity_id: o.Id,
                salesforce_account_id: a.Id,
                workspace_id: workspaceId ?? '',
              },
            },
            { idempotencyKey: key('subscription') },
          );
          executed.stripeSubscriptionId = s.id;
          executed.billedAmount = s.amount;
          stripePastDue = s.status === 'past_due';
          if (executed.subscriptionId) {
            await adminApp.updateSubscription(executed.subscriptionId, { billingReference: s.id });
          }
          break;
        }
        case 'update_stripe_subscription': {
          const s = await stripe.updateSubscription(str(p.stripeSubscriptionId) as string, {
            quantity: num(p.quantity),
            amount: num(p.amount),
          });
          executed.billedAmount = s.amount;
          break;
        }
      }
      executed.workspaceId = workspaceId;
      executed.kleerCustomerNumber = kleerCustomerNumber;
      executed.stripeCustomerId = stripeCustomerId;
      ran.push(action);
      log(o.Id, 'info', action.type, action.summary, { system: action.system, detail: p });
    } catch (error) {
      const message =
        error instanceof ConnectorError
          ? `${error.system} answered ${error.status} ${error.code}: ${error.message}`
          : error instanceof Error
            ? error.message
            : String(error);
      log(o.Id, 'error', action.type, `${action.summary} failed: ${message}`, {
        system: action.system,
        detail: p,
      });
      failures.push({
        rule: 'EXEC',
        severity: action.stage === 'setup' ? 'block' : 'hold',
        message: `${action.summary} failed. ${message}`,
        owner: 'revops',
      });
      if (action.stage === 'setup') break;
    }
  }
  return { executed, ran, failures, stripePastDue };
}

export async function writeBack(
  ctx: DealContext,
  executed: Executed,
  status: string,
  findings: Finding[],
) {
  const issues = findings
    .filter((f) => f.severity === 'hold' || f.severity === 'block')
    .map((f) => `${f.rule}: ${f.message}`)
    .join('\n');
  await salesforce.updateOpportunity(ctx.opportunity.Id, {
    Subscription_ID__c: executed.subscriptionId ?? ctx.opportunity.Subscription_ID__c ?? null,
    Invoice_Number__c: executed.invoiceNumber ?? ctx.opportunity.Invoice_Number__c ?? null,
    Billing_Reference__c: executed.stripeSubscriptionId ?? executed.invoiceNumber ?? null,
    Handoff_Status__c: status,
    Handoff_Issues__c: issues || null,
    Handoff_Updated__c: new Date().toISOString(),
  });
}
