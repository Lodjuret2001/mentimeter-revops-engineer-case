'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { today } from '@/lib/clock';
import { salesforce } from '@/lib/connectors';
import {
  chooseWorkspace,
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
