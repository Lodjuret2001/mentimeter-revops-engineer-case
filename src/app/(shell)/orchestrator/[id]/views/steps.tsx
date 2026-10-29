import { EmptyState } from '@/components/shell/page';
import type { HandoffCase, LogEntry } from '@/lib/orchestrator';

export async function StepsView({ record, entries }: { record: HandoffCase; entries: LogEntry[] }) {
  return (
    <EmptyState>
      Steps view for {record.name}, {entries.length} log entries. Not built yet.
    </EmptyState>
  );
}
