import { createHash } from 'node:crypto';
import { salesforce, slack } from '@/lib/connectors';
import type { DealContext } from './collect';
import { log } from './store';
import type { CaseStatus, Finding, HandoffCase } from './types';

const FINANCE = '#finance-billing';
const DEAL_DESK = '#deal-desk';

const hash = (text: string) => createHash('sha1').update(text).digest('hex').slice(0, 12);

const bullet = (f: Finding) => `• ${f.rule}: ${f.message}${f.field ? ` (${f.field})` : ''}`;

const statusLine: Record<CaseStatus, string> = {
  done: 'set up and billing created',
  held: 'customer set up, billing on hold',
  blocked: 'nothing set up yet',
  reopened: 'left Closed Won',
};

async function post(opportunityId: string, channel: string, text: string) {
  try {
    await slack.postMessage({ channel, text });
    log(opportunityId, 'info', 'notify', `Slack to ${channel}`, { system: 'slack', detail: text });
  } catch (error) {
    log(opportunityId, 'warn', 'notify', `Slack to ${channel} failed: ${String(error)}`, {
      system: 'slack',
    });
  }
}

async function dmByEmail(opportunityId: string, email: string, text: string) {
  try {
    const user = await slack.lookupUserByEmail(email);
    await post(opportunityId, user.id, text);
  } catch {
    log(opportunityId, 'warn', 'notify', `No Slack user for ${email}`, { system: 'slack' });
  }
}

export async function notify(
  ctx: DealContext,
  record: HandoffCase,
  previous: HandoffCase | null,
  stripePastDue: boolean,
): Promise<string> {
  const o = ctx.opportunity;
  const link = `<http://localhost:3000/orchestrator/${o.Id}|${o.Name}>`;
  const forRep = record.findings.filter(
    (f) => f.owner === 'rep' && (f.severity === 'hold' || f.severity === 'block'),
  );
  const forFinance = record.findings.filter(
    (f) => (f.owner === 'finance' || f.owner === 'revops') && f.severity !== 'info',
  );
  const forDealDesk = record.findings.filter((f) => f.owner === 'deal_desk');

  const digest = hash(
    JSON.stringify([
      record.status,
      record.executed.invoiceNumber,
      record.executed.stripeSubscriptionId,
      record.findings,
    ]),
  );
  if (previous?.notifiedHash === digest) return digest;
  if (record.status === 'reopened' && !record.executed.subscriptionId) return digest;

  if (ctx.owner && forRep.length > 0 && record.status !== 'reopened') {
    await dmByEmail(
      o.Id,
      ctx.owner.Email,
      `${link}: ${statusLine[record.status]}. Needs you in Salesforce:\n${forRep.map(bullet).join('\n')}`,
    );
  }

  const financeLines: string[] = [];
  if (
    record.executed.invoiceNumber &&
    previous?.executed.invoiceNumber !== record.executed.invoiceNumber
  ) {
    financeLines.push(
      `Draft invoice ${record.executed.invoiceNumber} is ready to review and send.`,
    );
  }
  if (
    record.executed.stripeSubscriptionId &&
    previous?.executed.stripeSubscriptionId !== record.executed.stripeSubscriptionId
  ) {
    financeLines.push(
      `Card subscription ${record.executed.stripeSubscriptionId} created${stripePastDue ? ', payment FAILED' : ' and charged'}.`,
    );
  }
  if (forFinance.length > 0) financeLines.push(...forFinance.map(bullet));
  if (record.status === 'reopened' && record.executed.subscriptionId) {
    financeLines.push(
      `Deal left Closed Won after ${record.executed.subscriptionId} was created. Review what to roll back.`,
    );
  }
  if (financeLines.length > 0) {
    await post(
      o.Id,
      FINANCE,
      `${link} (${statusLine[record.status]}):\n${financeLines.join('\n')}`,
    );
  }

  if (forDealDesk.length > 0) {
    await post(
      o.Id,
      DEAL_DESK,
      `${link} is Closed Won but waiting on you:\n${forDealDesk.map(bullet).join('\n')}`,
    );
  }

  if (stripePastDue) {
    const users = await salesforce.listUsers();
    const credit = users.find((u) => /credit/i.test(u.Title));
    const text = `${link}: card payment failed for ${record.executed.stripeSubscriptionId}. ${record.findings.find((f) => f.rule === 'CC')?.message ?? ''}`;
    if (credit) await dmByEmail(o.Id, credit.Email, text);
    else await post(o.Id, FINANCE, text);
  }

  return digest;
}
