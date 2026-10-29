import { beforeEach, describe, expect, it } from 'vitest';
import { adminApp, kleer, salesforce, stripe } from '@/lib/connectors';
import { readDb } from '@/lib/db';
import {
  getCase,
  listCases,
  processEvent,
  processOpportunity,
  resetState,
  sync,
} from '@/lib/orchestrator';

const NORDLYS = '006Wb0000000hizAAI';
const CORVID = '006Wb0000000w94AAP';
const KESSLER = '006Wb0000000lqRAAK';
const HALDEN_ADDON = '006Wb0000000nuAAAL';
const VANTERA = '006Wb0000000pxtAAM';
const ALPENBLICK = '006Wb0000000s1cAAN';
const FJORDLINE = '006Wb0000000u5LAAO';
const LUMEN = '006Wb0000000yCnAAQ';
const SABLE = '006Wb00000010GWAAR';
const TORVIK = '006Wb00000012KFAAS';
const MARIS = '006Wb00000014NyAAT';
const OKAPI_RENEWAL = '006Wb00000016RhAAU';
const QUILL = '006Wb00000018VQAAV';
const HELIX = '006Wb0000001AZ9AAW';
const ARCADIA = '006Wb0000001CcsAAX';
const POLAR_BEAR = '006Wb0000001EgbAAY';
const WAVECREST = '006Wb0000001GkKAAZ';

const rules = (id: string) => (getCase(id)?.findings ?? []).map((f) => `${f.rule}:${f.severity}`);

describe('the week, end to end', () => {
  beforeEach(async () => {
    await sync();
  });

  it('handles all 21 events and leaves a case per deal', () => {
    expect(listCases()).toHaveLength(18);
    const byStatus = Object.groupBy(listCases(), (c) => c.status);
    expect(byStatus.done?.map((c) => c.opportunityId).sort()).toEqual(
      [
        FJORDLINE,
        HALDEN_ADDON,
        NORDLYS,
        OKAPI_RENEWAL,
        QUILL,
        SABLE,
        TORVIK,
        WAVECREST,
        '006Wb0000000jmiAAJ',
      ].sort(),
    );
    expect(byStatus.held?.map((c) => c.opportunityId).sort()).toEqual(
      [ALPENBLICK, ARCADIA, KESSLER, LUMEN, MARIS, VANTERA].sort(),
    );
    expect(byStatus.blocked?.map((c) => c.opportunityId).sort()).toEqual([CORVID, HELIX].sort());
    expect(byStatus.reopened?.map((c) => c.opportunityId)).toEqual([POLAR_BEAR]);
  });

  it('R1 and R4: invoices go to Kleer as drafts with the right VAT', async () => {
    const invoices = await kleer.findInvoices({ foreignId: NORDLYS });
    expect(invoices).toHaveLength(1);
    expect(invoices[0]).toMatchObject({
      status: 'draft',
      currency: 'SEK',
      netAmount: 432000,
      vatRate: 25,
    });
    const norway = await kleer.findInvoices({ foreignId: FJORDLINE });
    expect(norway[0]).toMatchObject({ vatRate: 0, netAmount: 14980 });
    expect(norway[0].lines.map((l) => l.articleNumber)).toEqual(['ENT', 'ONB']);
  });

  it('R2: a card deal above 10,000 EUR is set up but not charged', async () => {
    expect(getCase(VANTERA)?.status).toBe('held');
    expect(rules(VANTERA)).toContain('R2:hold');
    expect(getCase(VANTERA)?.executed.subscriptionId).toBeDefined();
    expect(getCase(VANTERA)?.executed.stripeSubscriptionId).toBeUndefined();
  });

  it('R3: no PO means workspace and subscription, but no invoice', async () => {
    const c = getCase(KESSLER);
    expect(c?.status).toBe('held');
    expect(rules(KESSLER)).toContain('R3:hold');
    expect(c?.executed.workspaceId).toBe('WS-2207');
    expect((await adminApp.getWorkspace('WS-2207')).salesforceAccountId).toBe(c?.accountId);
    expect(await kleer.findInvoices({ foreignId: KESSLER })).toHaveLength(0);
  });

  it('R4: missing VAT, missing email and a malformed VAT number hold the invoice', () => {
    expect(rules(ALPENBLICK).filter((r) => r === 'R4:hold')).toHaveLength(2);
    expect(rules(ARCADIA)).toContain('R4:hold');
    expect(getCase(ARCADIA)?.findings.find((f) => f.rule === 'R4')?.message).toContain(
      'FR 12 3456',
    );
  });

  it('R5: running the same events again changes nothing', async () => {
    const before = readDb();
    const again = await sync();
    expect(again.handled).toBe(0);
    for (const event of before.salesforce.events) await processEvent(event);
    const after = readDb();
    expect(after.kleer.invoices).toHaveLength(before.kleer.invoices.length);
    expect(after.adminApp.subscriptions).toHaveLength(before.adminApp.subscriptions.length);
    expect(after.stripe.subscriptions).toHaveLength(before.stripe.subscriptions.length);
    expect(after.adminApp.workspaces).toHaveLength(before.adminApp.workspaces.length);
  });

  it('R5: losing its own memory does not make it create things twice', async () => {
    const before = readDb();
    resetState();
    const again = await sync();
    expect(again.handled).toBe(21);
    const after = readDb();
    expect(after.kleer.invoices).toHaveLength(before.kleer.invoices.length);
    expect(after.adminApp.subscriptions).toHaveLength(before.adminApp.subscriptions.length);
    expect(after.stripe.subscriptions).toHaveLength(before.stripe.subscriptions.length);
    expect(after.adminApp.workspaces).toHaveLength(before.adminApp.workspaces.length);
    expect(getCase(NORDLYS)?.status).toBe('done');
    expect(getCase(NORDLYS)?.executed.subscriptionId).toBe('SUB-602');
  });

  it('R6: an add-on updates the existing subscription and prorates the invoice', async () => {
    const sub = await adminApp.getSubscription('SUB-502');
    expect(sub.seats).toBe(95);
    expect(sub.endDate).toBe('2027-02-28');
    expect(sub.billingReference).toBe('2026-0142');
    const [invoice] = await kleer.findInvoices({ foreignId: HALDEN_ADDON });
    expect(invoice.netAmount).toBeCloseTo(3134.6, 1);
    expect(invoice.servicePeriod).toEqual({ start: '2026-11-10', end: '2027-02-28' });
    expect(invoice.poNumber).toBe('PO-7781');
    expect(invoice.lines[0].description).toContain('111 of 365');
  });

  it('R7: moving from a card plan ends the old subscription in Stripe and the admin app', async () => {
    const nordlysOld = await stripe.getSubscription('sub_1PxNordlys7Hq2Lw');
    expect(nordlysOld.cancel_at_period_end).toBe(true);
    expect((await adminApp.getSubscription('SUB-501')).autoRenew).toBe(false);
    const sableOld = await stripe.getSubscription('sub_1PxSable3Kd9Vb');
    expect(sableOld.status).toBe('canceled');
    expect((await adminApp.getSubscription('SUB-504')).status).toBe('Ended');
    const okapiOld = await adminApp.getSubscription('SUB-503');
    expect(okapiOld.autoRenew).toBe(false);
    expect(getCase(OKAPI_RENEWAL)?.executed.subscriptionId).not.toBe('SUB-503');
  });

  it('R8: conflicting license counts block the deal before anything is created', () => {
    expect(getCase(CORVID)?.status).toBe('blocked');
    expect(getCase(CORVID)?.executed).toEqual({});
    expect(rules(MARIS)).toContain('R8:hold');
  });

  it('multi-year invoiced annually bills year one only', async () => {
    const [invoice] = await kleer.findInvoices({ foreignId: TORVIK });
    expect(invoice.netAmount).toBe(120000);
    expect(invoice.servicePeriod).toEqual({ start: '2026-11-20', end: '2027-11-19' });
    const sub = await adminApp.getSubscription(getCase(TORVIK)?.executed.subscriptionId as string);
    expect(sub.endDate).toBe('2028-11-19');
    expect(sub.createdBy).toBe('Menti Orchestrator');
  });

  it('a pending discount approval holds the money', () => {
    expect(getCase(LUMEN)?.status).toBe('held');
    expect(rules(LUMEN)).toContain('DD:hold');
  });

  it('a reopened deal is never set up and nobody is pinged about it', () => {
    expect(getCase(POLAR_BEAR)?.status).toBe('reopened');
    expect(getCase(POLAR_BEAR)?.executed).toEqual({});
    const pings = readDb().slack.messages.filter(
      (m) => m.user === 'U04HANDOFF' && m.text.includes('Polar Bear'),
    );
    expect(pings).toHaveLength(0);
  });

  it('writes status and IDs back to Salesforce', async () => {
    const nordlys = await salesforce.getOpportunity(NORDLYS);
    expect(nordlys.Handoff_Status__c).toBe('done');
    expect(nordlys.Subscription_ID__c).toMatch(/^SUB-/);
    expect(nordlys.Invoice_Number__c).toMatch(/^2026-/);
    const kessler = await salesforce.getOpportunity(KESSLER);
    expect(kessler.Handoff_Status__c).toBe('held');
    expect(String(kessler.Handoff_Issues__c)).toContain('R3');
    const account = await salesforce.getAccount(getCase(FJORDLINE)?.accountId as string);
    expect(account.Workspace_ID__c).toMatch(/^WS-/);
    expect(account.Kleer_Customer_Number__c).toBeTruthy();
  });

  it('tells the right people in Slack', () => {
    const sent = readDb().slack.messages.filter((m) => m.user === 'U04HANDOFF');
    const to = (channel: string) => sent.filter((m) => m.channel === channel).map((m) => m.text);
    expect(to('U04ALEXBRG').some((t) => t.includes('Kessler') && t.includes('PO_Number__c'))).toBe(
      true,
    );
    expect(
      to('U04NOORHDD').some((t) => t.includes('Vantera') && t.includes('Payment_Method__c')),
    ).toBe(true);
    expect(to('C04DEALDSK').some((t) => t.includes('Lumen'))).toBe(true);
    expect(to('U04TOMBCKR').some((t) => t.includes('Sable') && t.includes('failed'))).toBe(true);
    expect(to('C04FINBILL').filter((t) => t.includes('Draft invoice'))).toHaveLength(7);
    expect(to('U04LEAFSCH').some((t) => t.includes('Nordlys') && t.includes('WS-1001'))).toBe(true);
    expect(
      to('U04LEAFSCH').some(
        (t) => t.includes('Fjordline') && t.includes('Onboarding package: yes'),
      ),
    ).toBe(true);
    expect(
      to('U04LEAFSCH').some((t) => t.includes('Kessler') && t.includes('Billing is on hold')),
    ).toBe(true);
    expect(to('U04KIMANDS').some((t) => t.includes('Brightwell') && t.includes('No CSM'))).toBe(
      true,
    );
    expect(to('U04KIMANDS').some((t) => t.includes('Helix') && t.includes('workspaces'))).toBe(
      true,
    );
  });

  it('picks up fixes in Salesforce on the next run', async () => {
    await salesforce.updateOpportunity(KESSLER, { PO_Number__c: 'PO-KL-5001' });
    const record = await processOpportunity(KESSLER, { trigger: 'test' });
    expect(record.status).toBe('done');
    const [invoice] = await kleer.findInvoices({ foreignId: KESSLER });
    expect(invoice.poNumber).toBe('PO-KL-5001');
    expect(invoice.vatRate).toBe(0);
    expect(
      (await adminApp.getSubscription(record.executed.subscriptionId as string)).billingReference,
    ).toBe(invoice.invoiceNumber);
  });

  it('resolves two candidate workspaces when a human chooses', async () => {
    await salesforce.updateAccount(getCase(HELIX)?.accountId as string, {
      Workspace_ID__c: 'WS-2310',
    });
    const record = await processOpportunity(HELIX, { trigger: 'test' });
    expect(record.status).toBe('done');
    expect(record.executed.workspaceId).toBe('WS-2310');
    expect((await adminApp.getWorkspace('WS-2310')).plan).toBe('Enterprise');
  });
});
