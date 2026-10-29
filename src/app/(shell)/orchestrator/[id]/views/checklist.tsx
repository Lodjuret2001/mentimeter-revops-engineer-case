import { EmptyState } from '@/components/shell/page';
import type { HandoffCase, LogEntry } from '@/lib/orchestrator';

export async function ChecklistView({
  record,
  entries,
}: {
  record: HandoffCase;
  entries: LogEntry[];
}) {
  return (
    <EmptyState>
      Checklist view for {record.name}, {entries.length} log entries. Not built yet.
    </EmptyState>
  );
}
