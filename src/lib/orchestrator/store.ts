import { type Db, readDb, updateDb } from '@/lib/db';
import type { HandoffCase, LogEntry, LogLevel, OrchestratorState, SystemName } from './types';

const KEY = 'orchestrator';
const LOG_LIMIT = 2000;

function stateOf(db: Db): OrchestratorState {
  const existing = db.app[KEY] as OrchestratorState | undefined;
  if (existing) return existing;
  const fresh: OrchestratorState = { cases: {}, log: [], cursor: 0 };
  db.app[KEY] = fresh;
  return fresh;
}

export function getState(): OrchestratorState {
  return stateOf(readDb());
}

export function getCase(opportunityId: string): HandoffCase | null {
  return getState().cases[opportunityId] ?? null;
}

export function listCases(): HandoffCase[] {
  return Object.values(getState().cases).sort((a, b) => b.assessedAt.localeCompare(a.assessedAt));
}

export function saveCase(record: HandoffCase) {
  updateDb((db) => {
    stateOf(db).cases[record.opportunityId] = record;
  });
}

export function setCursor(replayId: number) {
  updateDb((db) => {
    const s = stateOf(db);
    s.cursor = Math.max(s.cursor, replayId);
  });
}

export function log(
  opportunityId: string | null,
  level: LogLevel,
  step: string,
  message: string,
  extra: { system?: SystemName; detail?: unknown } = {},
): LogEntry {
  return updateDb((db) => {
    const s = stateOf(db);
    const entry: LogEntry = {
      id: (s.log.at(-1)?.id ?? 0) + 1,
      at: new Date().toISOString(),
      opportunityId,
      level,
      step,
      message,
      ...extra,
    };
    s.log.push(entry);
    if (s.log.length > LOG_LIMIT) s.log = s.log.slice(-LOG_LIMIT);
    return entry;
  });
}

export function queryLog(filter: {
  opportunityId?: string;
  system?: string;
  level?: string;
  step?: string;
  q?: string;
  limit?: number;
}): LogEntry[] {
  const q = filter.q?.toLowerCase();
  return getState()
    .log.filter(
      (e) =>
        (!filter.opportunityId || e.opportunityId === filter.opportunityId) &&
        (!filter.system || e.system === filter.system) &&
        (!filter.level || e.level === filter.level) &&
        (!filter.step || e.step === filter.step) &&
        (!q ||
          `${e.message} ${e.step} ${JSON.stringify(e.detail ?? '')}`.toLowerCase().includes(q)),
    )
    .reverse()
    .slice(0, filter.limit ?? 200);
}
export function resetState() {
  updateDb((db) => {
    db.app[KEY] = { cases: {}, log: [], cursor: 0 } satisfies OrchestratorState;
  });
}
