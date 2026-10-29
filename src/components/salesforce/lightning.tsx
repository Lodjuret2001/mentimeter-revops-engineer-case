import {
  Activity,
  ArrowUpDown,
  Boxes,
  Building2,
  ChevronDown,
  type LucideIcon,
  Package,
  Trophy,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';

/**
 * Pieces that make the Salesforce pages look like Salesforce Lightning:
 * object icon tiles, a record header with a highlights panel, Lightning's
 * two-column field layout, related lists and list-view headers.
 */

export type SalesforceObject =
  | 'opportunity'
  | 'account'
  | 'contact'
  | 'product'
  | 'event'
  | 'system';

const OBJECTS: Record<SalesforceObject, { icon: LucideIcon; tile: string }> = {
  opportunity: { icon: Trophy, tile: 'bg-[#fcb95b]' },
  account: { icon: Building2, tile: 'bg-[#7f8de1]' },
  contact: { icon: UserRound, tile: 'bg-[#a094ed]' },
  product: { icon: Package, tile: 'bg-[#5867e8]' },
  event: { icon: Activity, tile: 'bg-[#eb7092]' },
  system: { icon: Boxes, tile: 'bg-[#4bc076]' },
};

/** Salesforce blue for links and record names. */
export const SF_LINK = 'text-[#0176d3] hover:underline dark:text-[#78b0fd]';

/** Lightning's dense table: 12px headers, 13px cells, short rows. */
export const SF_TABLE =
  'text-[13px] [&_th]:h-8 [&_th]:px-3 [&_th]:text-[12px] [&_th]:font-semibold [&_th]:text-muted-foreground [&_td]:px-3 [&_td]:py-1.5 [&_thead_tr]:bg-[#fafaf9] dark:[&_thead_tr]:bg-muted/30 [&_tbody_tr:hover]:bg-[#f3f3f3] dark:[&_tbody_tr:hover]:bg-muted/40';

/** The full-width grey canvas Lightning draws its cards on. */
export function SalesforcePage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-system="salesforce"
      className={cn(
        'flex min-h-full w-full flex-1 flex-col gap-3 bg-[#f3f3f3] p-3 text-[13px] dark:bg-[oklch(0.17_0.008_250)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A white card with a 1px border and Lightning's 4px radius. */
export function LightningCard({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn(
        'scroll-mt-16 rounded-[4px] border border-[#dddbda] bg-card text-card-foreground shadow-[0_2px_2px_rgba(0,0,0,0.05)] dark:border-border',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The coloured rounded-square icon Lightning puts in front of every object. */
export function ObjectIcon({
  object,
  size = 'md',
  className,
}: {
  object: SalesforceObject;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const { icon: Icon, tile } = OBJECTS[object];
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-[4px] text-white',
        size === 'sm' && 'size-6 [&>svg]:size-3.5',
        size === 'md' && 'size-8 [&>svg]:size-[18px]',
        size === 'lg' && 'size-10 [&>svg]:size-6',
        tile,
        className,
      )}
    >
      <Icon strokeWidth={2} />
    </span>
  );
}

export type Highlight = [label: string, value: ReactNode];

/**
 * Lightning's record header: object icon, grey object label, big record name,
 * actions on the right and a row of key fields (the highlights panel) below.
 */
export function RecordHeader({
  object,
  objectLabel,
  name,
  actions,
  highlights,
}: {
  object: SalesforceObject;
  objectLabel: string;
  name: ReactNode;
  actions?: ReactNode;
  highlights: Highlight[];
}) {
  return (
    <LightningCard className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <ObjectIcon object={object} size="lg" />
          <div className="min-w-0">
            <div className="text-[12px] text-muted-foreground leading-tight">{objectLabel}</div>
            <h1 className="truncate font-bold text-[18px] leading-tight tracking-tight">{name}</h1>
          </div>
        </div>
        {actions ? <div className="flex items-center gap-1.5">{actions}</div> : null}
      </div>
      <dl className="mt-3 flex flex-wrap gap-y-2 divide-x divide-border">
        {highlights.map(([label, value]) => (
          <div key={label} className="min-w-0 max-w-[16rem] pr-5 pl-5 first:pl-0">
            <dt className="truncate text-[12px] text-muted-foreground">{label}</dt>
            <dd className="truncate font-medium text-[13px]">
              {value === null || value === undefined || value === '' ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </LightningCard>
  );
}

/** "Details | Related" tabs along the top of a record card. */
export function RecordTabs({
  tabs,
}: {
  tabs: { label: string; href: string; active?: boolean }[];
}) {
  return (
    <nav className="flex gap-6 border-b px-4" aria-label="Record sections">
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          href={tab.href}
          className={cn(
            '-mb-px border-b-[3px] py-2 text-[13px] transition-colors',
            tab.active
              ? 'border-[#0176d3] font-semibold text-foreground dark:border-[#78b0fd]'
              : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

/** A collapsible-looking section header inside the Details tab. */
export function FieldSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="flex items-center gap-1 bg-[#f3f3f3] px-3 py-1.5 font-bold text-[13px] dark:bg-muted/40">
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * Lightning's field layout: two columns of small grey labels over values,
 * each field on its own thin rule.
 */
export function FieldGrid({
  items,
  columns = 2,
}: {
  items: [label: string, value: ReactNode][];
  columns?: 1 | 2;
}) {
  return (
    <dl
      className={cn('grid grid-cols-1 gap-x-8 px-3 pt-1 pb-3', columns === 2 && 'md:grid-cols-2')}
    >
      {items.map(([label, value]) => (
        <div key={label} className="flex min-h-[2.75rem] flex-col gap-0.5 border-b py-1.5">
          <dt className="text-[12px] text-muted-foreground">{label}</dt>
          <dd className="min-h-[1.25rem] break-words text-[13px]">
            {value === null || value === undefined || value === '' ? '' : value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A related list: icon, "Title (count)" and a compact table or list below. */
export function RelatedList({
  object,
  title,
  count,
  actions,
  children,
  id,
  className,
}: {
  object: SalesforceObject;
  title: string;
  count?: number;
  actions?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <LightningCard id={id} className={className}>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <h2 className="flex items-center gap-2 font-bold text-[13px]">
          <ObjectIcon object={object} size="sm" />
          {title}
          {count === undefined ? null : <span className="font-normal">({count})</span>}
        </h2>
        {actions}
      </div>
      <div className="border-t [&>div]:rounded-none [&>div]:border-0">{children}</div>
    </LightningCard>
  );
}

/** A table header cell with the sort affordance Lightning list views show. */
export function SortableHead({
  children,
  className,
  sorted,
}: {
  children: ReactNode;
  className?: string;
  sorted?: boolean;
}) {
  return (
    <TableHead className={cn('group', className)}>
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown
          aria-hidden
          className={cn(
            'size-3 text-muted-foreground transition-opacity',
            sorted ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
        />
      </span>
    </TableHead>
  );
}

/**
 * A Lightning list view: header card with object icon, object label, the view
 * name, a view picker and the "17 items · Sorted by Close Date" line, then
 * the table below it in the same card.
 */
export function ListView({
  object,
  objectLabel,
  viewName,
  views,
  meta,
  children,
}: {
  object: SalesforceObject;
  objectLabel: string;
  viewName: string;
  views?: { id: string; label: string; href: string; count?: number; active: boolean }[];
  meta: string[];
  children: ReactNode;
}) {
  return (
    <LightningCard>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-3 pb-2">
        <div className="flex min-w-0 items-center gap-3">
          <ObjectIcon object={object} size="md" />
          <div className="min-w-0">
            <div className="text-[12px] text-muted-foreground leading-tight">{objectLabel}</div>
            <h1 className="flex items-center gap-1 font-bold text-[18px] leading-tight tracking-tight">
              {viewName}
              <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
            </h1>
          </div>
        </div>
        {views ? (
          <nav
            aria-label="List views"
            className="flex rounded-[4px] border border-[#dddbda] text-[12px] dark:border-border"
          >
            {views.map((v) => (
              <Link
                key={v.id}
                href={v.href}
                aria-current={v.active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-1.5 border-[#dddbda] border-l px-3 py-1 first:border-l-0 dark:border-border',
                  v.active
                    ? 'bg-[#0176d3] font-semibold text-white dark:bg-[#0b5cab]'
                    : 'text-[#0176d3] hover:bg-[#f3f3f3] dark:text-[#78b0fd] dark:hover:bg-muted/40',
                )}
              >
                {v.label}
                {v.count === undefined ? null : (
                  <span
                    className={cn(
                      'tabular-nums',
                      v.active ? 'text-white/80' : 'text-muted-foreground',
                    )}
                  >
                    {v.count}
                  </span>
                )}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
      <p className="px-4 pb-2 text-[12px] text-muted-foreground">{meta.join(' · ')}</p>
      <div className="border-t [&>div]:rounded-none [&>div]:border-0">{children}</div>
    </LightningCard>
  );
}
