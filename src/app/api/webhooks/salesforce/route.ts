/**
 * Salesforce calls this URL for every Closed Won event. Each event is handed
 * to Menti Orchestrator, which assesses the deal and sets it up.
 */
import { processEvent } from '@/lib/orchestrator';
import type { SalesforceEvent } from '@/lib/systems/types';

export async function POST(request: Request) {
  const event = (await request.json()) as SalesforceEvent;
  const record = await processEvent(event);
  return Response.json(
    { received: true, status: record.status, findings: record.findings.length },
    { status: 202 },
  );
}
