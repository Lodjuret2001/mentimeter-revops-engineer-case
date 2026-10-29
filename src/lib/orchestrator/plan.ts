import type { DealContext } from './collect';
import { addDays } from './dates';
import type { Assessment } from './rules';
import { PAYMENT_TERMS_DAYS } from './rules';
import type { Action, HandoffCase } from './types';

export function buildPlan(
  ctx: DealContext,
  { findings, derived: d }: Assessment,
  existing: HandoffCase | null,
): Action[] {
  const o = ctx.opportunity;
  const a = ctx.account;
  const done = existing?.executed ?? {};
  const actions: Action[] = [];
  const blocked = findings.some((f) => f.severity === 'block');
  const held = blocked || findings.some((f) => f.severity === 'hold');
  if (!d.won || blocked || !d.plan || !d.seats || !d.startDate || !d.endDate || !d.billingSystem) {
    return actions;
  }

  if (d.workspace.kind === 'link') {
    actions.push({
      type: 'link_workspace',
      system: 'admin',
      stage: 'setup',
      summary: `Link workspace ${d.workspace.workspaceId} to ${a.Name}`,
      params: { workspaceId: d.workspace.workspaceId },
    });
  } else if (d.workspace.kind === 'create' && !done.workspaceId) {
    actions.push({
      type: 'create_workspace',
      system: 'admin',
      stage: 'setup',
      summary: `Create workspace for ${a.Name} (${d.region})`,
      params: { name: a.Name, region: d.region },
    });
  }
  const currentPlan =
    d.workspace.kind === 'create'
      ? 'Free'
      : (ctx.linkedWorkspace ?? ctx.workspacesByDomain[0])?.plan;
  if (currentPlan !== d.planLabel) {
    actions.push({
      type: 'set_workspace_plan',
      system: 'admin',
      stage: 'setup',
      summary: `Set workspace plan to ${d.planLabel}`,
      params: { plan: d.planLabel },
    });
  }

  const status = d.startDate > ctx.today ? 'Scheduled' : 'Active';
  if (d.mode === 'addon' && d.oldSubscription) {
    const target = d.oldSubscription.seats - (done.addedSeats ?? 0) + d.seats;
    if (d.oldSubscription.seats !== target) {
      actions.push({
        type: 'update_subscription',
        system: 'admin',
        stage: 'setup',
        summary: `Update ${d.oldSubscription.id} from ${d.oldSubscription.seats} to ${target} seats`,
        params: { subscriptionId: d.oldSubscription.id, seats: target, addedSeats: d.seats },
      });
    }
  } else if (done.subscriptionId) {
    const current = ctx.accountSubscriptions.find((s) => s.id === done.subscriptionId);
    if (
      current &&
      (current.seats !== d.seats ||
        current.startDate !== d.startDate ||
        current.endDate !== d.endDate ||
        current.plan !== d.plan ||
        current.billingSystem !== d.billingSystem)
    ) {
      actions.push({
        type: 'update_subscription',
        system: 'admin',
        stage: 'setup',
        summary: `Update ${current.id} to ${d.seats} ${d.plan}, ${d.startDate} to ${d.endDate}, billed via ${d.billingSystem}`,
        params: {
          subscriptionId: current.id,
          seats: d.seats,
          plan: d.plan,
          startDate: d.startDate,
          endDate: d.endDate,
          billingSystem: d.billingSystem,
        },
      });
    }
  } else {
    actions.push({
      type: 'create_subscription',
      system: 'admin',
      stage: 'setup',
      summary: `Create ${status.toLowerCase()} subscription: ${d.seats} ${d.plan}, ${d.startDate} to ${d.endDate}, billed via ${d.billingSystem}`,
      params: {
        plan: d.plan,
        seats: d.seats,
        startDate: d.startDate,
        endDate: d.endDate,
        billingSystem: d.billingSystem,
        status,
        autoRenew: d.billingSystem === 'Stripe',
      },
    });
  }

  const old = d.oldSubscription;
  if ((d.mode === 'replace' || d.mode === 'renewal') && old && !done.oldSubscriptionId) {
    const overlaps = d.startDate <= old.endDate;
    actions.push({
      type: 'end_old_subscription',
      system: 'admin',
      stage: 'setup',
      summary: overlaps
        ? `End ${old.id} on ${addDays(d.startDate, -1)}, the day before the new one starts`
        : `Stop ${old.id} from renewing after ${old.endDate}`,
      params: {
        subscriptionId: old.id,
        ...(overlaps ? { status: 'Ended', endDate: addDays(d.startDate, -1) } : {}),
        autoRenew: false,
      },
    });
    const stripeSub = old.billingReference
      ? ctx.stripeSubscriptions.find((s) => s.id === old.billingReference)
      : undefined;
    if (stripeSub && stripeSub.status !== 'canceled') {
      actions.push(
        overlaps
          ? {
              type: 'cancel_stripe_subscription',
              system: 'stripe',
              stage: 'setup',
              summary: `Cancel card subscription ${stripeSub.id} now, it overlaps the new contract`,
              params: { stripeSubscriptionId: stripeSub.id },
            }
          : {
              type: 'stop_stripe_renewal',
              system: 'stripe',
              stage: 'setup',
              summary: `Stop card subscription ${stripeSub.id} from renewing on ${stripeSub.current_period_end}`,
              params: { stripeSubscriptionId: stripeSub.id },
            },
      );
    }
  }

  if (held || !d.servicePeriod || d.lines.length === 0) return actions;

  if (d.billingSystem === 'Kleer') {
    if (!ctx.kleerCustomer) {
      actions.push({
        type: 'ensure_kleer_customer',
        system: 'kleer',
        stage: 'billing',
        summary: `Create Kleer customer ${a.Legal_Entity_Name__c}`,
        params: {
          name: a.Legal_Entity_Name__c,
          email: d.invoiceEmail,
          country: a.BillingCountry,
          currency: d.currency,
          vatNumber: a.VAT_Number__c,
          address: [a.BillingStreet, a.BillingPostalCode, a.BillingCity].filter(Boolean).join(', '),
        },
      });
    }
    const invoice = ctx.kleerInvoices.find((i) => i.type === 'invoice' && i.status !== 'credited');
    const payload = {
      currency: d.currency,
      lines: d.lines,
      servicePeriod: d.servicePeriod,
      poNumber: o.PO_Number__c,
      yourReference: ctx.billingContact?.Name ?? null,
      ourReference: 'Menti Orchestrator',
      foreignId: o.Id,
      paymentTermsDays: PAYMENT_TERMS_DAYS,
    };
    if (!invoice) {
      actions.push({
        type: 'create_kleer_draft',
        system: 'kleer',
        stage: 'billing',
        summary: `Draft invoice: ${d.firstYearAmount} ${d.currency} net, ${d.lines.length} line${d.lines.length > 1 ? 's' : ''}`,
        params: payload,
      });
    } else if (
      invoice.status === 'draft' &&
      Math.abs(invoice.netAmount - d.firstYearAmount) > 0.5
    ) {
      actions.push({
        type: 'replace_kleer_draft',
        system: 'kleer',
        stage: 'billing',
        summary: `Replace draft ${invoice.invoiceNumber} (${invoice.netAmount}) with ${d.firstYearAmount} ${d.currency}`,
        params: { ...payload, invoiceNumber: invoice.invoiceNumber },
      });
    }
  }

  if (d.billingSystem === 'Stripe') {
    const customer = ctx.stripeCustomers[0];
    if (!customer) {
      actions.push({
        type: 'ensure_stripe_customer',
        system: 'stripe',
        stage: 'billing',
        summary: `Create Stripe customer ${a.Legal_Entity_Name__c ?? a.Name}`,
        params: {
          name: a.Legal_Entity_Name__c ?? a.Name,
          email: d.invoiceEmail,
          currency: d.currency.toLowerCase(),
        },
      });
    }
    const existingSub = done.stripeSubscriptionId
      ? ctx.stripeSubscriptions.find((s) => s.id === done.stripeSubscriptionId)
      : undefined;
    if (!existingSub) {
      actions.push({
        type: 'create_stripe_subscription',
        system: 'stripe',
        stage: 'billing',
        summary: `Charge card and start subscription: ${d.seats} ${d.plan}, ${d.firstYearAmount} ${d.currency} a year`,
        params: {
          plan: d.plan,
          quantity: d.seats,
          currency: d.currency.toLowerCase(),
          amount: d.firstYearAmount,
          start_date: d.startDate,
        },
      });
    } else if (existingSub.quantity !== d.seats || existingSub.amount !== d.firstYearAmount) {
      actions.push({
        type: 'update_stripe_subscription',
        system: 'stripe',
        stage: 'billing',
        summary: `Update ${existingSub.id} to ${d.seats} seats, ${d.firstYearAmount} ${d.currency}`,
        params: {
          stripeSubscriptionId: existingSub.id,
          quantity: d.seats,
          amount: d.firstYearAmount,
        },
      });
    }
  }

  return actions;
}
