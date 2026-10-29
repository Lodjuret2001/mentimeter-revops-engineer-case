import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** A monospace ID such as WS-1001 or SUB-501, as a chip. */
export function IdChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-block rounded border bg-muted/60 px-1.5 py-px font-mono text-[11px] text-foreground/80 leading-4',
        className,
      )}
    >
      {children}
    </span>
  );
}

const PLAN_TONES: Record<string, string> = {
  free: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
  pro: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900',
  ent: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-900',
  enterprise:
    'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-900',
};

/** Free grey, Pro blue, Enterprise purple. Accepts names ("Pro") and codes ("PRO", "ENT"). */
export function PlanBadge({ plan }: { plan: string }) {
  const tone = PLAN_TONES[plan.toLowerCase()] ?? 'bg-muted text-muted-foreground border-border';
  return (
    <span
      className={cn(
        'inline-block rounded border px-1.5 py-px font-medium text-[11px] leading-4',
        plan === plan.toUpperCase() && 'font-mono',
        tone,
      )}
    >
      {plan}
    </span>
  );
}

const STATUS_DOTS: Record<string, string> = {
  active: 'bg-emerald-500',
  scheduled: 'bg-amber-500',
  ended: 'bg-zinc-400',
  cancelled: 'bg-rose-500',
  canceled: 'bg-rose-500',
};

export function SubscriptionStatusBadge({ status }: { status: string }) {
  const dot = STATUS_DOTS[status.toLowerCase()] ?? 'bg-zinc-400';
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span aria-hidden className={cn('size-1.5 rounded-full', dot)} />
      {status}
    </span>
  );
}

const BILLING_DOTS: Record<string, string> = {
  kleer: 'bg-emerald-500',
  stripe: 'bg-violet-500',
};

export function BillingChip({ system }: { system: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        aria-hidden
        className={cn('size-1.5 rounded-sm', BILLING_DOTS[system.toLowerCase()] ?? 'bg-zinc-400')}
      />
      {system}
    </span>
  );
}

export function RegionChip({ region }: { region: string }) {
  return (
    <span className="inline-block rounded border px-1.5 py-px font-mono text-[11px] leading-4">
      {region}
    </span>
  );
}

/** A thin bar scaled against the largest workspace, with the count beside it. */
export function MembersBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-indigo-500 dark:bg-indigo-400"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="w-6 text-right font-mono text-xs tabular-nums">{value}</span>
    </span>
  );
}

export type LinkFilter = 'all' | 'linked' | 'self';

export function FilterChips({
  active,
  options,
}: {
  active: LinkFilter;
  options: { id: LinkFilter; label: string; href: string; count: number }[];
}) {
  return (
    <nav className="flex flex-wrap items-center gap-1" aria-label="Filter rows">
      {options.map((o) => {
        const isActive = o.id === active;
        return (
          <Link
            key={o.id}
            href={o.href}
            aria-pressed={isActive}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs transition-colors',
              isActive
                ? 'border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {o.label}
            <span className="font-mono text-[10px] tabular-nums opacity-70">{o.count}</span>
          </Link>
        );
      })}
    </nav>
  );
}
