import { Hono } from 'hono';
import { kleer } from '@/lib/connectors';
import type { SalesforceEvent } from '@/lib/systems/types';
import { chooseWorkspace, processEvent, processOpportunity, sync } from './handoff';
import { getCase, getState, listCases, log, queryLog, resetState } from './store';

export const ORCHESTRATOR_BASE = '/api/orchestrator';

function createApp() {
  const app = new Hono().basePath(ORCHESTRATOR_BASE);

  app.get('/', (c) =>
    c.json({
      name: 'Menti Orchestrator',
      cursor: getState().cursor,
      cases: listCases().length,
      routes: [
        'POST /events',
        'POST /sync',
        'GET /cases',
        'GET /cases/:opportunityId',
        'POST /cases/:opportunityId/assess',
        'POST /cases/:opportunityId/run',
        'POST /cases/:opportunityId/workspace',
        'POST /cases/:opportunityId/send-invoice',
        'GET /log',
        'POST /reset',
      ],
    }),
  );

  app.post('/events', async (c) => {
    const event = (await c.req.json()) as SalesforceEvent;
    if (!event?.opportunityId || !event.replayId) {
      return c.json({ error: { code: 'bad_event', message: 'Expected a Salesforce event' } }, 400);
    }
    const record = await processEvent(event);
    return c.json({ received: true, status: record.status, case: record }, 202);
  });

  app.post('/sync', async (c) => c.json(await sync()));

  app.get('/cases', (c) => c.json(listCases()));

  app.get('/cases/:id', (c) => {
    const record = getCase(c.req.param('id'));
    return record
      ? c.json({ ...record, log: queryLog({ opportunityId: record.opportunityId }) })
      : c.json({ error: { code: 'not_found', message: 'No case for that opportunity' } }, 404);
  });

  app.post('/cases/:id/assess', async (c) =>
    c.json(await processOpportunity(c.req.param('id'), { trigger: 'assess', dryRun: true })),
  );

  app.post('/cases/:id/run', async (c) =>
    c.json(await processOpportunity(c.req.param('id'), { trigger: 'manual run' })),
  );

  app.post('/cases/:id/workspace', async (c) => {
    const { workspaceId } = (await c.req.json()) as { workspaceId?: string };
    if (!workspaceId) {
      return c.json({ error: { code: 'bad_request', message: 'workspaceId is required' } }, 400);
    }
    return c.json(await chooseWorkspace(c.req.param('id'), workspaceId));
  });

  app.post('/cases/:id/send-invoice', async (c) => {
    const record = getCase(c.req.param('id'));
    if (!record?.executed.invoiceNumber) {
      return c.json(
        { error: { code: 'no_invoice', message: 'No draft invoice for this deal' } },
        409,
      );
    }
    const invoice = await kleer.sendInvoice(record.executed.invoiceNumber);
    log(record.opportunityId, 'info', 'send_invoice', `Invoice ${invoice.invoiceNumber} sent`, {
      system: 'kleer',
    });
    return c.json(invoice);
  });

  app.get('/log', (c) => {
    const q = c.req.query();
    return c.json(
      queryLog({
        opportunityId: q.opportunity,
        system: q.system,
        level: q.level,
        step: q.step,
        q: q.q,
        limit: q.limit ? Number(q.limit) : undefined,
      }),
    );
  });

  app.post('/reset', (c) => {
    resetState();
    return c.json({ reset: true });
  });

  app.onError((error, c) => {
    log(null, 'error', 'api', error.message);
    return c.json({ error: { code: 'internal_error', message: error.message } }, 500);
  });

  return app;
}

export const orchestratorApp = createApp();
