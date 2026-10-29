export type Severity = 'info' | 'warn' | 'hold' | 'block';
export type OwnerRole = 'rep' | 'finance' | 'credit' | 'revops' | 'deal_desk';

export interface Finding {
  rule: string;
  severity: Severity;
  message: string;
  owner: OwnerRole;
  field?: string;
}

export type SystemName = 'salesforce' | 'admin' | 'kleer' | 'stripe' | 'slack';

export type ActionType =
  | 'link_workspace'
  | 'create_workspace'
  | 'set_workspace_plan'
  | 'create_subscription'
  | 'update_subscription'
  | 'end_old_subscription'
  | 'stop_stripe_renewal'
  | 'cancel_stripe_subscription'
  | 'ensure_kleer_customer'
  | 'create_kleer_draft'
  | 'replace_kleer_draft'
  | 'ensure_stripe_customer'
  | 'create_stripe_subscription'
  | 'update_stripe_subscription';
export type Stage = 'setup' | 'billing';

export interface Action {
  type: ActionType;
  system: SystemName;
  stage: Stage;
  summary: string;
  params: Record<string, unknown>;
}
export interface Executed {
  workspaceId?: string;
  subscriptionId?: string;
  oldSubscriptionId?: string;
  addedSeats?: number;
  kleerCustomerNumber?: string;
  invoiceNumber?: string;
  billedSeats?: number;
  billedAmount?: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export type CaseStatus = 'done' | 'held' | 'blocked' | 'reopened';

export interface HandoffCase {
  opportunityId: string;
  name: string;
  accountId: string;
  accountName: string;
  ownerId: string;
  recordType: string;
  status: CaseStatus;
  findings: Finding[];
  plan: Action[];
  executed: Executed;
  lastReplayId: number;
  assessedAt: string;
  notifiedHash?: string;
  history: { at: string; summary: string }[];
}

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  id: number;
  at: string;
  opportunityId: string | null;
  level: LogLevel;
  step: string;
  message: string;
  system?: SystemName;
  detail?: unknown;
}

export interface OrchestratorState {
  cases: Record<string, HandoffCase>;
  log: LogEntry[];
  cursor: number;
}
