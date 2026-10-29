'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { today } from '@/lib/clock';
import { salesforce } from '@/lib/connectors';
import {
  chooseWorkspace,
  getCase,
  orchestratorApp,
  processOpportunity,
  resetState,
  sync,
} from '@/lib/orchestrator';

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

export async function syncAction() {
  await sync();
  revalidatePath('/', 'layout');
}

export async function resetAction() {
  resetState();
  revalidatePath('/', 'layout');
}

export async function runAction(formData: FormData) {
  const id = text(formData, 'opportunityId');
  if (id) await processOpportunity(id, { trigger: 'manual run' });
  revalidatePath('/', 'layout');
}

export async function sendInvoiceAction(formData: FormData) {
  const id = text(formData, 'opportunityId');
  if (id) {
    await orchestratorApp.request(`/api/orchestrator/cases/${id}/send-invoice`, {
      method: 'POST',
    });
  }
  revalidatePath('/', 'layout');
}

export async function chooseWorkspaceAction(formData: FormData) {
  const id = text(formData, 'opportunityId');
  const workspaceId = text(formData, 'workspaceId');
  if (id && workspaceId) await chooseWorkspace(id, workspaceId);
  revalidatePath('/', 'layout');
}

export async function closeWonAction(formData: FormData) {
  const id = text(formData, 'opportunityId');
  if (!id) return;
  await salesforce.updateOpportunity(id, { StageName: 'Closed Won', CloseDate: today() });
  await processOpportunity(id, { trigger: 'marked Closed Won in MentOS' });
  revalidatePath('/', 'layout');
  redirect(`/orchestrator/${id}`);
}

const OPPORTUNITY_TEXT = [
  'PO_Number__c',
  'Payment_Method__c',
  'Discount_Approval__c',
  'Start_Date__c',
  'End_Date__c',
  'CurrencyIsoCode',
];
const ACCOUNT_TEXT = [
  'Legal_Entity_Name__c',
  'VAT_Number__c',
  'Invoice_Email__c',
  'CurrencyIsoCode',
  'Workspace_ID__c',
];

function textFields(formData: FormData, keys: string[]) {
  const fields: Record<string, string | null> = {};
  for (const key of keys) {
    if (!formData.has(key)) continue;
    const value = text(formData, key).trim();
    fields[key] = value === '' ? null : value;
  }
  return fields;
}

export async function editOpportunityAction(formData: FormData) {
  const id = text(formData, 'opportunityId');
  if (!id) return;
  const licenses = Number(text(formData, 'Number_of_Licenses__c'));
  await salesforce.updateOpportunity(id, {
    ...textFields(formData, OPPORTUNITY_TEXT),
    ...(Number.isInteger(licenses) && licenses > 0 ? { Number_of_Licenses__c: licenses } : {}),
  });
  const opportunity = await salesforce.getOpportunity(id);
  if (opportunity.StageName === 'Closed Won' || getCase(id)) {
    await processOpportunity(id, { trigger: 'opportunity.updated (edited in MentOS)' });
  }
  revalidatePath('/', 'layout');
}

export async function editAccountAction(formData: FormData) {
  const id = text(formData, 'accountId');
  if (!id) return;
  await salesforce.updateAccount(id, {
    ...textFields(formData, ACCOUNT_TEXT),
    PO_Required__c: text(formData, 'PO_Required__c') === 'Yes',
  });
  const deals = await salesforce.listOpportunities({ accountId: id, stage: 'Closed Won' });
  for (const deal of deals) {
    if (getCase(deal.Id)) {
      await processOpportunity(deal.Id, { trigger: 'account edited in MentOS' });
    }
  }
  revalidatePath('/', 'layout');
}
