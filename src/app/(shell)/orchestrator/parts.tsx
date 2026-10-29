import Link from 'next/link';
import { Json } from '@/components/data/fields';
import { Status } from '@/components/data/status';
import { EmptyState } from '@/components/shell/page';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime } from '@/lib/format';
import type { CaseStatus, LogEntry, LogLevel, OwnerRole, Severity } from '@/lib/orchestrator';
import { cn } from '@/lib/utils';

type Tone = 'good' | 'warn' | 'bad' | 'muted' | 'neutral';

export const STATUS_TONE: Record<CaseStatus, Tone> = {
  done: 'good',
  held: 'warn',
  blocked: 'bad',
  reopened: 'muted',
};

export const STATUS_ORDER: Record<CaseStatus, number> = {
  blocked: 0,
  held: 1,
  done: 2,
  reopened: 3,
};

const SEVERITY_TONE: Record<Severity, Tone> = {
  block: 'bad',
  hold: 'warn',
  warn: 'warn',
  info: 'muted',
};

const LEVEL_TONE: Record<LogLevel, Tone> = {
  error: 'bad',
  warn: 'warn',
  info: 'muted',
};

export const OWNER_LABEL: Record<OwnerRole, string> = {
  rep: 'Deal owner',
  finance: 'Finance',
  credit: 'Credit control',
  revops: 'RevOps',
  deal_desk: 'Deal Desk',
};

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  return <Status value={status} tone={STATUS_TONE[status]} />;
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Status
      value={severity}
      tone={SEVERITY_TONE[severity]}
      className={cn(severity === 'warn' && 'bg-amber-500/5 text-amber-600 dark:text-amber-300')}
    />
  );
}

export function LevelBadge({ level }: { level: LogLevel }) {
  return <Status value={level} tone={LEVEL_TONE[level]} />;
}

export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-md border bg-muted/40 px-1.5 font-mono text-[11px] text-foreground/80',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function LogTable({
  entries,
  showDeal = false,
  empty = 'No log entries.',
}: {
  entries: LogEntry[];
  showDeal?: boolean;
  empty?: string;
}) {
  if (entries.length === 0) return <EmptyState>{empty}</EmptyState>;
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Time</TableHead>
            <TableHead className="w-16">Level</TableHead>
            <TableHead className="w-36">Step</TableHead>
            <TableHead className="w-24">System</TableHead>
            {showDeal ? <TableHead className="w-40">Deal</TableHead> : null}
            <TableHead>Message</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id} className="align-top">
              <TableCell className="whitespace-nowrap text-muted-foreground text-xs tabular-nums">
                {formatDateTime(entry.at)}
              </TableCell>
              <TableCell>
                <LevelBadge level={entry.level} />
              </TableCell>
              <TableCell className="font-mono text-xs">{entry.step}</TableCell>
              <TableCell className="text-xs capitalize">
                {entry.system ?? <span className="text-muted-foreground">—</span>}
              </TableCell>
              {showDeal ? (
                <TableCell className="text-xs">
                  {entry.opportunityId ? (
                    <Link
                      href={`/orchestrator/${entry.opportunityId}`}
                      className="font-mono hover:underline"
                    >
                      {entry.opportunityId}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              ) : null}
              <TableCell className="text-sm">
                <div>{entry.message}</div>
                {entry.detail !== undefined ? (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-muted-foreground text-xs">
                      Detail
                    </summary>
                    <div className="pt-2">
                      <Json value={entry.detail} />
                    </div>
                  </details>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
