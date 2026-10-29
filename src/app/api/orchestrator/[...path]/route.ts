import { orchestratorApp } from '@/lib/orchestrator';

const handle = (request: Request) => orchestratorApp.fetch(request);

export const GET = handle;
export const POST = handle;
