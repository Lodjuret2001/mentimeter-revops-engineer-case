import type { OpportunityLineItem, Subscription } from '@/lib/systems/types';
import type { DealContext } from './collect';
import { daysInclusive, formatDay, lastDayAfterYears, round2, toEur } from './dates';
import type { Finding, Severity } from './types';

export const CARD_LIMIT_EUR = 10_000;
export const DISCOUNT_APPROVAL_ABOVE = 25;
export const PAYMENT_TERMS_DAYS = 30;

export type SubscriptionMode = 'new' | 'replace' | 'addon' | 'renewal';
export type WorkspaceDecision =
  | { kind: 'linked'; workspaceId: string }
  | { kind: 'link'; workspaceId: string }
  | { kind: 'create' }
  | { kind: 'ambiguous'; candidates: string[] };

export interface InvoiceLine {
  articleNumber: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  amount: number;
}

export interface Derived {
  won: boolean;
  billingSystem: 'Kleer' | 'Stripe' | null;
  mode: SubscriptionMode;
  oldSubscription: Subscription | null;
  workspace: WorkspaceDecision;
  region: 'EU' | 'US';
  plan: string | null;
  planLabel: string;
  seats: number | null;
  startDate: string | null;
  endDate: string | null;
  servicePeriod: { start: string; end: string } | null;
  lines: InvoiceLine[];
  firstYearAmount: number;
  currency: string;
  proration: { days: number; periodDays: number } | null;
  invoiceEmail: string | null;
}

export interface Assessment {
  findings: Finding[];
  derived: Derived;
}

const EU_COUNTRIES = new Set([
  'Austria',
  'Belgium',
  'Bulgaria',
  'Croatia',
  'Cyprus',
  'Czech Republic',
  'Czechia',
  'Denmark',
  'Estonia',
  'Finland',
  'France',
  'Germany',
  'Greece',
  'Hungary',
  'Ireland',
  'Italy',
  'Latvia',
  'Lithuania',
  'Luxembourg',
  'Malta',
  'Netherlands',
  'Poland',
  'Portugal',
  'Romania',
  'Slovakia',
  'Slovenia',
  'Spain',
  'Sweden',
]);

const isEu = (country: string) => EU_COUNTRIES.has(country);

const vatLooksValid = (vat: string) => /^[A-Z]{2}[A-Z0-9]{7,13}$/.test(vat.replace(/[\s.-]/g, ''));

const sum = (xs: number[]) => round2(xs.reduce((a, b) => a + b, 0));

function decideWorkspace(ctx: DealContext): WorkspaceDecision {
  if (ctx.linkedWorkspace) {
    return ctx.account.Workspace_ID__c === ctx.linkedWorkspace.id
      ? { kind: 'linked', workspaceId: ctx.linkedWorkspace.id }
      : { kind: 'link', workspaceId: ctx.linkedWorkspace.id };
  }
  if (ctx.workspacesByDomain.length === 1) {
    return { kind: 'link', workspaceId: ctx.workspacesByDomain[0].id };
  }
  if (ctx.workspacesByDomain.length > 1) {
    return { kind: 'ambiguous', candidates: ctx.workspacesByDomain.map((w) => w.id) };
  }
  return { kind: 'create' };
}

function liveSubscriptions(ctx: DealContext): Subscription[] {
  const own = ctx.existing?.executed.subscriptionId;
  return ctx.accountSubscriptions.filter(
    (s) => s.id !== own && (s.status === 'Active' || s.status === 'Scheduled'),
  );
}

function buildLines(
  ctx: DealContext,
  period: { start: string; end: string } | null,
  proration: { days: number; periodDays: number } | null,
): InvoiceLine[] {
  const o = ctx.opportunity;
  const items: OpportunityLineItem[] = o.OpportunityLineItems.records;
  const when = period ? `, ${formatDay(period.start)} to ${formatDay(period.end)}` : '';
  const source =
    items.length > 0
      ? items
      : o.Plan__c && o.Number_of_Licenses__c && o.Price_per_License_per_Year__c
        ? [
            {
              ProductCode: o.Plan__c,
              Name: o.Plan__c === 'ENT' ? 'Enterprise' : 'Pro',
              Quantity: o.Number_of_Licenses__c,
              UnitPrice: o.Price_per_License_per_Year__c,
              Discount: o.Discount__c ?? 0,
            },
          ]
        : [];
  return source.map((l) => {
    const isLicense = l.ProductCode !== 'ONB';
    if (isLicense && proration) {
      const factor = proration.days / proration.periodDays;
      const unit = round2(l.UnitPrice * (1 - l.Discount / 100) * factor);
      return {
        articleNumber: l.ProductCode,
        description: `${l.Name} licenses${when}, prorated ${proration.days} of ${proration.periodDays} days, ${l.Discount}% discount included`,
        quantity: l.Quantity,
        unitPrice: unit,
        discountPercent: 0,
        amount: round2(unit * l.Quantity),
      };
    }
    return {
      articleNumber: l.ProductCode,
      description: isLicense ? `${l.Name} licenses${when}` : l.Name,
      quantity: l.Quantity,
      unitPrice: l.UnitPrice,
      discountPercent: l.Discount,
      amount: round2(l.Quantity * l.UnitPrice * (1 - l.Discount / 100)),
    };
  });
}

export function assess(ctx: DealContext): Assessment {
  const o = ctx.opportunity;
  const a = ctx.account;
  const findings: Finding[] = [];
  const add = (
    rule: string,
    severity: Severity,
    message: string,
    owner: Finding['owner'],
    field?: string,
  ) => findings.push({ rule, severity, message, owner, field });

  const won = o.StageName === 'Closed Won';
  const currency = o.CurrencyIsoCode;
  const plan = o.Plan__c;
  const seats = o.Number_of_Licenses__c;
  const items = o.OpportunityLineItems.records;
  const licenseItems = items.filter((l) => l.ProductCode !== 'ONB');
  const isAddon = o.RecordType.DeveloperName === 'Add_on';
  const isRenewal = o.RecordType.DeveloperName === 'Renewal';

  const paymentMethod = o.Payment_Method__c;
  const billingSystem =
    paymentMethod === 'Invoice' ? 'Kleer' : paymentMethod === 'Card' ? 'Stripe' : null;
  if (!billingSystem) {
    add(
      'R1',
      'block',
      'Payment method is empty, so nothing can be billed',
      'rep',
      'Payment_Method__c',
    );
  } else if ((paymentMethod === 'Card') !== Boolean(o.Credit_Card_Payment__c)) {
    add(
      'R1',
      'warn',
      `Payment method says ${paymentMethod} but the legacy card checkbox says ${o.Credit_Card_Payment__c ? 'card' : 'not card'}. Going with Payment method.`,
      'rep',
      'Credit_Card_Payment__c',
    );
  }

  if (!plan) add('D1', 'block', 'Plan is empty', 'rep', 'Plan__c');
  if (!seats || seats <= 0)
    add('D1', 'block', 'Number of licenses is empty', 'rep', 'Number_of_Licenses__c');
  if (plan === 'ENT' && seats && seats < 25) {
    add(
      'D1',
      'warn',
      `Enterprise needs at least 25 licenses, this deal has ${seats}`,
      'rep',
      'Number_of_Licenses__c',
    );
  }

  const lineSeats = licenseItems.reduce((n, l) => n + l.Quantity, 0);
  if (licenseItems.length > 0 && seats && lineSeats !== seats) {
    add(
      'R8',
      'block',
      `Licenses disagree: the opportunity says ${seats}, the products say ${lineSeats}. Fix one before anything is set up.`,
      'rep',
      'Number_of_Licenses__c',
    );
  }

  const listPrice = ctx.pricebook.find((p) => p.ProductCode === plan)?.UnitPrice ?? null;
  if (plan && listPrice === null) {
    add('R8', 'block', `No list price for ${plan} in ${currency}`, 'revops', 'CurrencyIsoCode');
  } else if (listPrice !== null && o.Price_per_License_per_Year__c !== listPrice) {
    add(
      'R8',
      'warn',
      `Price per license is ${o.Price_per_License_per_Year__c}, list price in ${currency} is ${listPrice}`,
      'rep',
      'Price_per_License_per_Year__c',
    );
  }
  if (a.CurrencyIsoCode !== currency) {
    add(
      'R8',
      'hold',
      `Deal is in ${currency} but the account is in ${a.CurrencyIsoCode}. Confirm which currency to bill in.`,
      'finance',
      'CurrencyIsoCode',
    );
  }

  const discount = o.Discount__c ?? 0;
  if (discount > DISCOUNT_APPROVAL_ABOVE && o.Discount_Approval__c !== 'Approved') {
    add(
      'DD',
      'hold',
      `${discount}% discount needs Deal Desk approval, status is ${o.Discount_Approval__c ?? 'empty'}`,
      'deal_desk',
      'Discount_Approval__c',
    );
  }

  const startDate = o.Start_Date__c;
  let endDate = o.End_Date__c;
  if (!startDate) add('D2', 'block', 'Start date is empty', 'rep', 'Start_Date__c');
  if (!endDate) add('D2', 'block', 'End date is empty', 'rep', 'End_Date__c');
  if (startDate && endDate && endDate < startDate) {
    add('D2', 'block', 'End date is before start date', 'rep', 'End_Date__c');
  }
  if (startDate && startDate < o.CloseDate) {
    add(
      'D2',
      'warn',
      `Starts ${formatDay(startDate)}, before the close date. Billing the whole period from that day.`,
      'rep',
      'Start_Date__c',
    );
  }

  const live = liveSubscriptions(ctx);
  let mode: SubscriptionMode = 'new';
  let oldSubscription: Subscription | null = null;
  let proration: Derived['proration'] = null;

  if (isAddon) {
    mode = 'addon';
    oldSubscription = ctx.originalSubscription ?? live.find((s) => s.plan === plan) ?? null;
    if (!oldSubscription) {
      add(
        'R6',
        'block',
        'Add-on, but no existing subscription to add the licenses to',
        'finance',
        'Original_Opportunity__c',
      );
    } else {
      endDate = oldSubscription.endDate;
      if (o.End_Date__c && o.End_Date__c !== oldSubscription.endDate) {
        add(
          'R6',
          'warn',
          `End date on the deal is ${formatDay(o.End_Date__c)}, the subscription ends ${formatDay(oldSubscription.endDate)}. Co-terming to the subscription.`,
          'rep',
          'End_Date__c',
        );
      }
      const baseSeats = oldSubscription.seats - (ctx.existing?.executed.addedSeats ?? 0);
      if (seats && o.Total_Licenses__c && baseSeats + seats !== o.Total_Licenses__c) {
        add(
          'R6',
          'warn',
          `Subscription has ${baseSeats} seats plus ${seats} added is ${baseSeats + seats}, the deal says ${o.Total_Licenses__c} in total`,
          'rep',
          'Total_Licenses__c',
        );
      }
      if (startDate) {
        proration = {
          days: daysInclusive(startDate, oldSubscription.endDate),
          periodDays: daysInclusive(oldSubscription.startDate, oldSubscription.endDate),
        };
        add(
          'R6',
          'info',
          `Prorated: ${proration.days} of ${proration.periodDays} days left on ${oldSubscription.id}`,
          'finance',
        );
      }
    }
  } else if (isRenewal) {
    mode = 'renewal';
    oldSubscription = ctx.originalSubscription ?? live[0] ?? null;
    if (!oldSubscription) {
      add(
        'R7',
        'warn',
        'Renewal, but no existing subscription was found. Creating a new one.',
        'finance',
        'Original_Opportunity__c',
      );
    } else if (startDate && startDate <= oldSubscription.endDate) {
      add(
        'R7',
        'info',
        `${oldSubscription.id} will end ${formatDay(startDate)} so the periods do not overlap`,
        'finance',
      );
    }
  } else if (live.length > 0) {
    mode = 'replace';
    oldSubscription = live[0];
    const handled = ctx.existing?.executed.oldSubscriptionId === oldSubscription.id;
    add(
      'R7',
      'info',
      `Customer already has ${oldSubscription.id} (${oldSubscription.seats} ${oldSubscription.plan}, ${oldSubscription.billingSystem}). ${handled ? 'It has been stopped so they are not billed twice.' : 'It will be ended so they are not billed twice.'}`,
      'finance',
    );
    if (live.length > 1) {
      add(
        'R7',
        'hold',
        `More than one live subscription: ${live.map((s) => s.id).join(', ')}. Check which to end.`,
        'finance',
      );
    }
  }

  const years = o.Contract_Term__c === '24 months' ? 2 : 1;
  const upfront = o.Multi_Year_deal__c && o.Multi_Year_Payment_Terms__c === 'Paid upfront';
  const servicePeriod =
    startDate && endDate
      ? {
          start: startDate,
          end: isAddon || upfront || years === 1 ? endDate : lastDayAfterYears(startDate, 1),
        }
      : null;
  if (years > 1 && !upfront && startDate) {
    add(
      'MY',
      'info',
      `Multi-year, invoiced annually: this invoice covers year one, next invoice is due ${formatDay(lastDayAfterYears(startDate, 1))}`,
      'finance',
    );
  }

  const lines = buildLines(ctx, servicePeriod, proration);
  const firstYearAmount = sum(lines.map((l) => l.amount));

  if (!isAddon && seats && listPrice !== null && o.Amount !== null) {
    const expected = round2(
      seats * (o.Price_per_License_per_Year__c ?? listPrice) * (1 - discount / 100) * years +
        items.filter((l) => l.ProductCode === 'ONB').reduce((n, l) => n + l.TotalPrice, 0),
    );
    if (Math.abs(expected - o.Amount) > 0.5) {
      add(
        'R8',
        'warn',
        `Amount is ${o.Amount} ${currency}, licenses × price × (1 − discount) gives ${expected}`,
        'rep',
        'Amount',
      );
    }
  }

  const amountEur = toEur(firstYearAmount, currency);
  if (billingSystem === 'Stripe' && amountEur !== null && amountEur > CARD_LIMIT_EUR) {
    add(
      'R2',
      'hold',
      `Card is only allowed up to ${CARD_LIMIT_EUR.toLocaleString('en-GB')} EUR a year. This is about ${Math.round(amountEur).toLocaleString('en-GB')} EUR, so it must be invoiced. Change the payment method.`,
      'rep',
      'Payment_Method__c',
    );
  }

  const invoiceEmail = a.Invoice_Email__c ?? ctx.billingContact?.Email ?? null;
  if (billingSystem === 'Kleer') {
    if (!a.Legal_Entity_Name__c)
      add(
        'R4',
        'hold',
        'Legal entity name is missing on the account',
        'rep',
        'Legal_Entity_Name__c',
      );
    if (!a.Invoice_Email__c) {
      add(
        'R4',
        'hold',
        ctx.billingContact
          ? `Invoice email is missing on the account. Billing contact ${ctx.billingContact.Name} has ${ctx.billingContact.Email}, confirm it can be used.`
          : 'Invoice email is missing on the account',
        'rep',
        'Invoice_Email__c',
      );
    }
    if (isEu(a.BillingCountry) && a.BillingCountry !== 'Sweden') {
      if (!a.VAT_Number__c) {
        add(
          'R4',
          'hold',
          `${a.BillingCountry} is in the EU, so Kleer will add 25% Swedish VAT without a VAT number`,
          'rep',
          'VAT_Number__c',
        );
      } else if (!vatLooksValid(a.VAT_Number__c)) {
        add(
          'R4',
          'hold',
          `VAT number "${a.VAT_Number__c}" does not look like a valid ${a.BillingCountry} VAT number`,
          'rep',
          'VAT_Number__c',
        );
      }
    }
    if (a.PO_Required__c && !o.PO_Number__c) {
      add(
        'R3',
        'hold',
        'This account requires a PO number on every invoice and the deal has none',
        'rep',
        'PO_Number__c',
      );
    }
  }
  if (billingSystem === 'Stripe') {
    if (!invoiceEmail)
      add(
        'R4',
        'hold',
        'No email for the card receipt: account has no invoice email and the deal no billing contact',
        'rep',
        'Invoice_Email__c',
      );
    const card = ctx.stripeCustomers.find((c) => c.default_payment_method)?.default_payment_method;
    if (card) {
      const expired =
        new Date(Date.UTC(card.exp_year, card.exp_month, 1)) <= new Date(`${ctx.today}T00:00:00Z`);
      if (expired)
        add(
          'CC',
          'warn',
          `Card on file (${card.brand} •••• ${card.last4}) expired ${card.exp_month}/${card.exp_year}. The charge will fail until the customer updates it.`,
          'credit',
        );
    }
  }

  const workspace = decideWorkspace(ctx);
  if (!won) {
    add(
      'SF',
      ctx.existing?.executed.subscriptionId ? 'hold' : 'block',
      `Deal is ${o.StageName}, not Closed Won${ctx.existing?.executed.subscriptionId ? '. It was already set up, review what to roll back.' : ''}`,
      ctx.existing?.executed.subscriptionId ? 'finance' : 'revops',
      'StageName',
    );
  } else if (workspace.kind === 'ambiguous') {
    add(
      'WS',
      'block',
      `Two or more workspaces share this domain: ${workspace.candidates.join(', ')}. Choose which one the contract covers.`,
      'revops',
    );
  } else if (workspace.kind === 'link') {
    const w = ctx.workspacesByDomain[0] ?? ctx.linkedWorkspace;
    add(
      'WS',
      'info',
      `Reusing workspace ${workspace.workspaceId}${w ? ` (${w.activeMembers} active members, ${w.plan})` : ''} and linking it to the account`,
      'revops',
    );
  } else if (workspace.kind === 'create') {
    add('WS', 'info', 'No workspace yet, one will be created', 'revops');
  }

  if (won && !ctx.csm) {
    add(
      'CSM',
      'warn',
      `No CSM on the account and none covers ${a.Region__c}. Assign one so the kickoff has an owner.`,
      'revops',
      'CSM__c',
    );
  }

  const openInvoice = ctx.kleerInvoices.find(
    (i) => i.type === 'invoice' && i.status !== 'credited',
  );
  if (openInvoice && billingSystem === 'Kleer') {
    if (openInvoice.status !== 'draft' && Math.abs(openInvoice.netAmount - firstYearAmount) > 0.5) {
      add(
        'R5',
        'hold',
        `Invoice ${openInvoice.invoiceNumber} was already ${openInvoice.status} for ${openInvoice.netAmount} ${openInvoice.currency}, the deal now comes to ${firstYearAmount}. Finance has to credit and reissue.`,
        'finance',
      );
    } else {
      add(
        'R5',
        'info',
        `Invoice ${openInvoice.invoiceNumber} already exists for this deal (${openInvoice.status})`,
        'finance',
      );
    }
  }

  return {
    findings,
    derived: {
      won,
      billingSystem,
      mode,
      oldSubscription,
      workspace,
      region: a.Region__c === 'North America' ? 'US' : 'EU',
      plan,
      planLabel: plan === 'ENT' ? 'Enterprise' : plan === 'PRO' ? 'Pro' : 'Free',
      seats,
      startDate,
      endDate,
      servicePeriod,
      lines,
      firstYearAmount,
      currency,
      proration,
      invoiceEmail,
    },
  };
}

export const worst = (findings: Finding[]): Severity => {
  const order: Severity[] = ['info', 'warn', 'hold', 'block'];
  return findings.reduce<Severity>(
    (acc, f) => (order.indexOf(f.severity) > order.indexOf(acc) ? f.severity : acc),
    'info',
  );
};
