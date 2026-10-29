'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { kindOf, READ_ONLY } from '@/components/salesforce/fields';
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

function patchFrom(
  formData: FormData,
  current: Record<string, unknown>,
): Record<string, string | number | boolean | null> {
  const patch: Record<string, string | number | boolean | null> = {};
  for (const [field, value] of Object.entries(current)) {
    if (READ_ONLY.has(field) || !formData.has(field)) continue;
    const raw = text(formData, field).trim();
    const kind = kindOf(field, value);
    let next: string | number | boolean | null;
    if (kind === 'boolean') next = raw === 'true';
    else if (kind === 'number') next = raw === '' ? null : Number(raw);
    else next = raw === '' ? null : raw;
    if (kind === 'number' && typeof next === 'number' && !Number.isFinite(next)) continue;
    if (next !== value) patch[field] = next;
  }
  return patch;
}

export async function editOpportunityAction(formData: FormData) {
  const id = text(formData, 'opportunityId');
  if (!id) return;
  const { OpportunityLineItems: _lines, ...current } = await salesforce.getOpportunity(id);
  const patch = patchFrom(formData, current);
  if (Object.keys(patch).length > 0) await salesforce.updateOpportunity(id, patch);
  const after = await salesforce.getOpportunity(id);
  if (after.StageName === 'Closed Won' || getCase(id)) {
    await processOpportunity(id, { trigger: 'opportunity.updated (edited in MentOS)' });
  }
  revalidatePath('/', 'layout');
}

export async function editAccountAction(formData: FormData) {
  const id = text(formData, 'accountId');
  if (!id) return;
  const current = await salesforce.getAccount(id);
  const patch = patchFrom(formData, current);
  if (Object.keys(patch).length > 0) await salesforce.updateAccount(id, patch);
  const deals = await salesforce.listOpportunities({ accountId: id, stage: 'Closed Won' });
  for (const deal of deals) {
    if (getCase(deal.Id)) {
      await processOpportunity(deal.Id, { trigger: 'account edited in MentOS' });
    }
  }
  revalidatePath('/', 'layout');
}
