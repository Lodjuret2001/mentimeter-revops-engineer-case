import { today } from '@/lib/clock';
import { adminApp, ConnectorError, kleer, salesforce, stripe } from '@/lib/connectors';
import type { OpportunityWithLines } from '@/lib/connectors/salesforce';
import type {
  KleerCustomer,
  KleerInvoice,
  PricebookEntry,
  SalesforceAccount,
  SalesforceContact,
  SalesforceUser,
  StripeCustomer,
  StripeSubscription,
  Subscription,
  Workspace,
} from '@/lib/systems/types';
import { getCase } from './store';
import type { HandoffCase } from './types';

export interface DealContext {
  opportunity: OpportunityWithLines;
  account: SalesforceAccount;
  owner: SalesforceUser | null;
  billingContact: SalesforceContact | null;
  original: OpportunityWithLines | null;
  originalSubscription: Subscription | null;
  pricebook: PricebookEntry[];
  linkedWorkspace: Workspace | null;
  workspacesByDomain: Workspace[];
  accountSubscriptions: Subscription[];
  kleerCustomer: KleerCustomer | null;
  kleerInvoices: KleerInvoice[];
  stripeCustomers: StripeCustomer[];
  stripeSubscriptions: StripeSubscription[];
  existing: HandoffCase | null;
  today: string;
}

const notFoundAsNull = <T>(promise: Promise<T>): Promise<T | null> =>
  promise.catch((error) => {
    if (error instanceof ConnectorError && error.status === 404) return null;
    throw error;
  });

export function domainOf(account: SalesforceAccount): string | null {
  const site = account.Website?.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  return site?.includes('.') ? site.toLowerCase() : null;
}

export async function collect(opportunityId: string): Promise<DealContext> {
  const opportunity = await salesforce.getOpportunity(opportunityId);
  const [account, users, pricebook, original] = await Promise.all([
    salesforce.getAccount(opportunity.AccountId),
    salesforce.listUsers(),
    salesforce.listPricebook(opportunity.CurrencyIsoCode),
    opportunity.Original_Opportunity__c
      ? notFoundAsNull(salesforce.getOpportunity(opportunity.Original_Opportunity__c))
      : Promise.resolve(null),
  ]);
  const domain = domainOf(account);
  const [
    billingContact,
    linkedWorkspace,
    workspacesByAccount,
    workspacesByDomain,
    accountSubscriptions,
    originalSubscription,
    kleerByNumber,
    kleerInvoices,
    stripeByEmail,
  ] = await Promise.all([
    opportunity.Billing_Contact__c
      ? notFoundAsNull(salesforce.getContact(opportunity.Billing_Contact__c))
      : Promise.resolve(null),
    account.Workspace_ID__c
      ? notFoundAsNull(adminApp.getWorkspace(account.Workspace_ID__c))
      : Promise.resolve(null),
    adminApp.listWorkspaces({ salesforceAccountId: account.Id }),
    domain ? adminApp.listWorkspaces({ domain }) : Promise.resolve([]),
    adminApp.listSubscriptions({ salesforceAccountId: account.Id }),
    original?.Subscription_ID__c
      ? notFoundAsNull(adminApp.getSubscription(original.Subscription_ID__c))
      : Promise.resolve(null),
    account.Kleer_Customer_Number__c
      ? notFoundAsNull(kleer.getCustomer(account.Kleer_Customer_Number__c))
      : Promise.resolve(null),
    kleer.findInvoices({ foreignId: opportunity.Id }),
    account.Invoice_Email__c
      ? stripe.findCustomers({ email: account.Invoice_Email__c })
      : Promise.resolve([]),
  ]);

  let kleerCustomer = kleerByNumber;
  if (!kleerCustomer && account.VAT_Number__c) {
    kleerCustomer = (await kleer.findCustomers({ vatNumber: account.VAT_Number__c }))[0] ?? null;
  }
  if (!kleerCustomer && account.Invoice_Email__c) {
    kleerCustomer = (await kleer.findCustomers({ email: account.Invoice_Email__c }))[0] ?? null;
  }

  const workspace = linkedWorkspace ?? workspacesByAccount[0] ?? null;
  const candidates = workspace
    ? []
    : workspacesByDomain.filter(
        (w) => !w.salesforceAccountId || w.salesforceAccountId === account.Id,
      );

  const workspaceIds = [workspace?.id, ...candidates.map((w) => w.id)].filter((id): id is string =>
    Boolean(id),
  );
  const stripeByWorkspace = (
    await Promise.all(
      workspaceIds.map((id) => stripe.findCustomers({ metadata: { workspace_id: id } })),
    )
  ).flat();
  const stripeCustomers = [...stripeByWorkspace, ...stripeByEmail].filter(
    (c, i, all) => all.findIndex((x) => x.id === c.id) === i,
  );
  const stripeSubscriptions = (
    await Promise.all(stripeCustomers.map((c) => stripe.listSubscriptions({ customer: c.id })))
  ).flat();

  const workspaceSubscriptions = workspace
    ? await adminApp.listSubscriptions({ workspaceId: workspace.id })
    : [];
  const subscriptions = [...accountSubscriptions, ...workspaceSubscriptions].filter(
    (s, i, all) => all.findIndex((x) => x.id === s.id) === i,
  );

  return {
    opportunity,
    account,
    owner: users.find((u) => u.Id === opportunity.OwnerId) ?? null,
    billingContact,
    original,
    originalSubscription,
    pricebook,
    linkedWorkspace: workspace,
    workspacesByDomain: candidates,
    accountSubscriptions: subscriptions,
    kleerCustomer,
    kleerInvoices,
    stripeCustomers,
    stripeSubscriptions,
    existing: getCase(opportunity.Id),
    today: today(),
  };
}
