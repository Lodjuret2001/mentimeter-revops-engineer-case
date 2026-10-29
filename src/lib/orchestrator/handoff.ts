import { salesforce } from '@/lib/connectors';
import type { SalesforceEvent } from '@/lib/systems/types';
import { collect } from './collect';
import { execute, writeBack } from './execute';
import { notify } from './notify';
import { buildPlan } from './plan';
import { assess } from './rules';
import { getCase, getState, log, saveCase, setCursor } from './store';
import type { CaseStatus, Finding, HandoffCase } from './types';

export interface ProcessOptions {
  replayId?: number;
  trigger: string;
  dryRun?: boolean;
}

function statusOf(won: boolean, findings: Finding[]): CaseStatus {
  if (!won) return 'reopened';
  if (findings.some((f) => f.severity === 'block')) return 'blocked';
  if (findings.some((f) => f.severity === 'hold')) return 'held';
  return 'done';
}

export async function processOpportunity(
  opportunityId: string,
  options: ProcessOptions,
): Promise<HandoffCase> {
  const previous = getCase(opportunityId);
  if (options.replayId !== undefined && previous && previous.lastReplayId >= options.replayId) {
    log(opportunityId, 'info', 'skip', `Event ${options.replayId} already handled`);
    return previous;
  }
  log(opportunityId, 'info', 'start', `Processing (${options.trigger})`);

  const ctx = await collect(opportunityId);
  const assessment = assess(ctx);
  const plan = buildPlan(ctx, assessment, ctx.existing);
  const now = new Date().toISOString();

  if (options.dryRun) {
    return {
      opportunityId,
      name: ctx.opportunity.Name,
      accountId: ctx.account.Id,
      accountName: ctx.account.Name,
      ownerId: ctx.opportunity.OwnerId,
      recordType: ctx.opportunity.RecordType.DeveloperName,
      status: statusOf(assessment.derived.won, assessment.findings),
      findings: assessment.findings,
      plan,
      executed: previous?.executed ?? {},
      lastReplayId: previous?.lastReplayId ?? 0,
      assessedAt: now,
      history: previous?.history ?? [],
    };
  }

  const result = await execute(ctx, plan, ctx.existing?.executed ?? {});
  const findings = [...assessment.findings, ...result.failures];
  const status = statusOf(assessment.derived.won, findings);

  const record: HandoffCase = {
    opportunityId,
    name: ctx.opportunity.Name,
    accountId: ctx.account.Id,
    accountName: ctx.account.Name,
    ownerId: ctx.opportunity.OwnerId,
    recordType: ctx.opportunity.RecordType.DeveloperName,
    status,
    findings,
    plan,
    executed: result.executed,
    lastReplayId: Math.max(previous?.lastReplayId ?? 0, options.replayId ?? 0),
    assessedAt: now,
    notifiedHash: previous?.notifiedHash,
    history: [
      ...(ctx.existing?.history ?? []),
      {
        at: now,
        summary: `${options.trigger}: ${status}, ${result.ran.length} of ${plan.length} actions ran, ${findings.length} findings`,
      },
    ],
  };

  try {
    await writeBack(ctx, record.executed, status, findings);
    log(opportunityId, 'info', 'writeback', `Salesforce updated: ${status}`, {
      system: 'salesforce',
    });
  } catch (error) {
    log(opportunityId, 'error', 'writeback', `Salesforce write-back failed: ${String(error)}`, {
      system: 'salesforce',
    });
  }

  record.notifiedHash = await notify(ctx, record, ctx.existing, result.stripePastDue);
  saveCase(record);
  log(opportunityId, 'info', 'end', `${status}: ${record.history.at(-1)?.summary}`);
  return record;
}

export async function processEvent(event: SalesforceEvent): Promise<HandoffCase> {
  log(event.opportunityId, 'info', 'event', `${event.type} #${event.replayId}`, {
    system: 'salesforce',
    detail: { changedFields: event.changedFields },
  });
  const record = await processOpportunity(event.opportunityId, {
    replayId: event.replayId,
    trigger: `${event.type} #${event.replayId}`,
  });
  setCursor(event.replayId);
  return record;
}

export async function sync(): Promise<{ handled: number; cursor: number }> {
  const from = getState().cursor;
  const { events, latestReplayId } = await salesforce.listEvents(from);
  for (const event of events) await processEvent(event);
  return { handled: events.length, cursor: latestReplayId };
}

export async function chooseWorkspace(opportunityId: string, workspaceId: string) {
  const current = getCase(opportunityId);
  const accountId =
    current?.accountId ?? (await salesforce.getOpportunity(opportunityId)).AccountId;
  await salesforce.updateAccount(accountId, { Workspace_ID__c: workspaceId });
  log(opportunityId, 'info', 'decision', `Workspace ${workspaceId} chosen for the account`, {
    system: 'salesforce',
  });
  return processOpportunity(opportunityId, { trigger: `workspace chosen: ${workspaceId}` });
}
