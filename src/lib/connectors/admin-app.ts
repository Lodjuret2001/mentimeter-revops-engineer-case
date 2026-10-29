import type {
  BillingSystem,
  Subscription,
  SubscriptionStatus,
  Workspace,
} from '@/lib/systems/types';
import { request } from './http';

const id = encodeURIComponent;

export interface CreateSubscriptionInput {
  workspaceId: string;
  salesforceAccountId?: string | null;
  plan: string;
  seats: number;
  startDate: string;
  endDate: string;
  billingSystem: BillingSystem;
  /** Defaults to "Active" */
  status?: SubscriptionStatus;
  autoRenew?: boolean;
  billingReference?: string | null;
}

export type UpdateSubscriptionInput = Partial<
  Pick<
    Subscription,
    | 'plan'
    | 'seats'
    | 'startDate'
    | 'endDate'
    | 'status'
    | 'autoRenew'
    | 'billingSystem'
    | 'billingReference'
  >
>;

export const adminApp = {
  listWorkspaces: (filter: { salesforceAccountId?: string; domain?: string } = {}) =>
    request<Workspace[]>('admin', 'GET', '/workspaces', { query: filter }),

  getWorkspace: (workspaceId: string) =>
    request<Workspace>('admin', 'GET', `/workspaces/${id(workspaceId)}`),

  createWorkspace: (input: {
    name: string;
    salesforceAccountId?: string | null;
    domain?: string | null;
    region?: 'EU' | 'US';
  }) => request<Workspace>('admin', 'POST', '/workspaces', { body: input }),

  updateWorkspace: (
    workspaceId: string,
    changes: { name?: string; salesforceAccountId?: string | null; plan?: string },
  ) => request<Workspace>('admin', 'PATCH', `/workspaces/${id(workspaceId)}`, { body: changes }),

  listSubscriptions: (
    filter: {
      workspaceId?: string;
      salesforceAccountId?: string;
      status?: SubscriptionStatus;
    } = {},
  ) => request<Subscription[]>('admin', 'GET', '/subscriptions', { query: filter }),

  getSubscription: (subscriptionId: string) =>
    request<Subscription>('admin', 'GET', `/subscriptions/${id(subscriptionId)}`),

  /** `createdBy` names the integration in the subscription's audit field. */
  createSubscription: (input: CreateSubscriptionInput, options: { createdBy?: string } = {}) =>
    request<Subscription>('admin', 'POST', '/subscriptions', {
      body: input,
      headers: options.createdBy ? { 'x-created-by': options.createdBy } : undefined,
    }),

  updateSubscription: (subscriptionId: string, changes: UpdateSubscriptionInput) =>
    request<Subscription>('admin', 'PATCH', `/subscriptions/${id(subscriptionId)}`, {
      body: changes,
    }),
};
