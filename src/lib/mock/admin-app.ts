/** Mock admin app API: workspaces and subscriptions. */
import { Hono } from 'hono';
import { nextId, readDb, updateDb } from '@/lib/db';
import type {
  BillingSystem,
  Subscription,
  SubscriptionStatus,
  Workspace,
} from '@/lib/systems/types';
import { appError, body, check, now, problems } from './validate';

const STATUSES = ['Active', 'Scheduled', 'Ended', 'Cancelled'] as const;
const BILLING = ['Kleer', 'Stripe'] as const;
const EDITABLE = [
  'plan',
  'seats',
  'startDate',
  'endDate',
  'status',
  'autoRenew',
  'billingSystem',
  'billingReference',
] as const;

export function adminAppRoutes() {
  const app = new Hono();
  const plans = () => readDb().salesforce.products.map((p) => p.ProductCode);

  app.get('/workspaces', (c) => {
    const { salesforceAccountId, domain } = c.req.query();
    return c.json(
      readDb().adminApp.workspaces.filter(
        (w) =>
          (!salesforceAccountId || w.salesforceAccountId === salesforceAccountId) &&
          (!domain || w.domain === domain),
      ),
    );
  });

  app.get('/workspaces/:id', (c) => {
    const workspace = readDb().adminApp.workspaces.find((w) => w.id === c.req.param('id'));
    return workspace ? c.json(workspace) : appError(c, 404, 'not_found', 'Workspace not found');
  });

  app.post('/workspaces', async (c) => {
    const b = await body(c);
    const list = problems(
      check.text(b.name, 'name'),
      check.optionalText(b.salesforceAccountId, 'salesforceAccountId'),
      check.optionalText(b.domain, 'domain'),
      check.oneOf(b.region ?? 'EU', 'region', ['EU', 'US']),
    );
    if (list.length > 0) {
      return appError(c, 422, 'validation_failed', list.join('; '), list);
    }
    const workspace = updateDb((db) => {
      const created: Workspace = {
        id: `WS-${nextId(db, 'workspace', 3000)}`,
        name: b.name as string,
        salesforceAccountId: (b.salesforceAccountId as string | undefined) ?? null,
        domain: (b.domain as string | undefined) ?? null,
        region: (b.region as 'EU' | 'US' | undefined) ?? 'EU',
        plan: 'Free',
        activeMembers: 0,
        ownerEmail: null,
        createdAt: now(),
      };
      db.adminApp.workspaces.push(created);
      return created;
    });
    return c.json(workspace, 201);
  });

  app.patch('/workspaces/:id', async (c) => {
    const b = await body(c);
    const unknown = Object.keys(b).filter(
      (k) => !['name', 'salesforceAccountId', 'plan'].includes(k),
    );
    const list = problems(
      ...unknown.map((k) => `${k} cannot be changed`),
      'name' in b ? check.text(b.name, 'name') : null,
      check.optionalText(b.salesforceAccountId, 'salesforceAccountId'),
      'plan' in b ? check.oneOf(b.plan, 'plan', ['Free', 'Pro', 'Enterprise']) : null,
    );
    if (list.length > 0) {
      return appError(c, 422, 'validation_failed', list.join('; '), list);
    }
    const workspace = updateDb((db) => {
      const found = db.adminApp.workspaces.find((w) => w.id === c.req.param('id'));
      if (found) Object.assign(found, b);
      return found;
    });
    return workspace ? c.json(workspace) : appError(c, 404, 'not_found', 'Workspace not found');
  });

  app.get('/subscriptions', (c) => {
    const { workspaceId, salesforceAccountId, status } = c.req.query();
    return c.json(
      readDb().adminApp.subscriptions.filter(
        (s) =>
          (!workspaceId || s.workspaceId === workspaceId) &&
          (!salesforceAccountId || s.salesforceAccountId === salesforceAccountId) &&
          (!status || s.status === status),
      ),
    );
  });

  app.get('/subscriptions/:id', (c) => {
    const subscription = readDb().adminApp.subscriptions.find((s) => s.id === c.req.param('id'));
    return subscription
      ? c.json(subscription)
      : appError(c, 404, 'not_found', 'Subscription not found');
  });

  app.post('/subscriptions', async (c) => {
    const b = await body(c);
    const db = readDb();
    const workspace = db.adminApp.workspaces.find((w) => w.id === b.workspaceId);
    const list = problems(
      check.text(b.workspaceId, 'workspaceId'),
      typeof b.workspaceId === 'string' && !workspace
        ? `workspace ${b.workspaceId} does not exist`
        : null,
      check.optionalText(b.salesforceAccountId, 'salesforceAccountId'),
      check.oneOf(b.plan, 'plan', plans()),
      check.positiveInteger(b.seats, 'seats'),
      check.date(b.startDate, 'startDate'),
      check.date(b.endDate, 'endDate'),
      check.dateOrder(b.startDate, b.endDate, 'The subscription'),
      check.oneOf(b.billingSystem, 'billingSystem', BILLING),
      'status' in b ? check.oneOf(b.status, 'status', STATUSES) : null,
      check.optionalText(b.billingReference, 'billingReference'),
    );
    if (list.length > 0) {
      return appError(c, 422, 'validation_failed', list.join('; '), list);
    }
    const subscription = updateDb((next) => {
      const at = now();
      const created: Subscription = {
        id: `SUB-${nextId(next, 'subscription', 600)}`,
        workspaceId: b.workspaceId as string,
        salesforceAccountId:
          (b.salesforceAccountId as string | undefined) ?? workspace?.salesforceAccountId ?? null,
        plan: b.plan as string,
        seats: b.seats as number,
        startDate: b.startDate as string,
        endDate: b.endDate as string,
        status: (b.status as SubscriptionStatus | undefined) ?? 'Active',
        autoRenew: b.autoRenew === true,
        billingSystem: b.billingSystem as BillingSystem,
        billingReference: (b.billingReference as string | undefined) ?? null,
        createdBy: c.req.header('x-created-by')?.trim() || 'api',
        createdAt: at,
        updatedAt: at,
      };
      next.adminApp.subscriptions.push(created);
      return created;
    });
    return c.json(subscription, 201);
  });

  app.patch('/subscriptions/:id', async (c) => {
    const b = await body(c);
    const existing = readDb().adminApp.subscriptions.find((s) => s.id === c.req.param('id'));
    if (!existing) return appError(c, 404, 'not_found', 'Subscription not found');
    const unknown = Object.keys(b).filter((k) => !(EDITABLE as readonly string[]).includes(k));
    const merged = { ...existing, ...b };
    const list = problems(
      ...unknown.map((k) => `${k} cannot be changed`),
      Object.keys(b).length === 0 ? 'Send at least one field' : null,
      'plan' in b ? check.oneOf(b.plan, 'plan', plans()) : null,
      'seats' in b ? check.positiveInteger(b.seats, 'seats') : null,
      'startDate' in b ? check.date(b.startDate, 'startDate') : null,
      'endDate' in b ? check.date(b.endDate, 'endDate') : null,
      check.dateOrder(merged.startDate, merged.endDate, 'The subscription'),
      'status' in b ? check.oneOf(b.status, 'status', STATUSES) : null,
      'billingSystem' in b ? check.oneOf(b.billingSystem, 'billingSystem', BILLING) : null,
      check.optionalText(b.billingReference, 'billingReference'),
    );
    if (list.length > 0) {
      return appError(c, 422, 'validation_failed', list.join('; '), list);
    }
    const subscription = updateDb((db) => {
      const found = db.adminApp.subscriptions.find((s) => s.id === existing.id);
      if (found) Object.assign(found, b, { updatedAt: now() });
      return found;
    });
    return c.json(subscription);
  });

  return app;
}
