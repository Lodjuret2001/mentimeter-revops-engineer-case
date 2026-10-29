import { EmptyState } from '@/components/shell/page';
import type { HandoffCase, LogEntry } from '@/lib/orchestrator';

export async function SystemsView({
  record,
  entries,
}: {
  record: HandoffCase;
  entries: LogEntry[];
}) {
  return (
    <EmptyState>
      Systems view for {record.name}, {entries.length} log entries. Not built yet.
    </EmptyState>
  );
}
