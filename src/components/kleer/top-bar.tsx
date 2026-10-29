import { Package, Receipt, Users } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Module = {
  id: string;
  sv: string;
  en: string;
  href?: string;
  count?: number;
  icon: ReactNode;
};

/**
 * Kleer's product chrome: a rounded wordmark and the module nav as pills.
 * "Artiklar" is in the nav for flavour only; this mock holds no articles.
 */
export function KleerTopBar({
  active,
  invoices,
  customers,
}: {
  active: 'invoices' | 'customers';
  invoices: number;
  customers: number;
}) {
  const modules: Module[] = [
    {
      id: 'invoices',
      sv: 'Kundfakturor',
      en: 'Invoices',
      href: '/kleer',
      count: invoices,
      icon: <Receipt className="size-3.5" />,
    },
    {
      id: 'customers',
      sv: 'Kunder',
      en: 'Customers',
      href: '/kleer?tab=customers',
      count: customers,
      icon: <Users className="size-3.5" />,
    },
    { id: 'articles', sv: 'Artiklar', en: 'Articles', icon: <Package className="size-3.5" /> },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border bg-card px-4 py-3 shadow-xs">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex size-8 items-center justify-center rounded-xl bg-emerald-600 font-bold text-lg text-white tracking-tight dark:bg-emerald-500"
        >
          k
        </span>
        <span className="font-bold text-xl tracking-tight">Kleer</span>
      </div>
      <nav aria-label="Kleer modules" className="flex flex-wrap items-center gap-1">
        {modules.map((m) => {
          const isActive = m.id === active;
          const className = cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors',
            isActive
              ? 'bg-emerald-600 font-medium text-white dark:bg-emerald-500 dark:text-emerald-950'
              : 'text-muted-foreground',
            !isActive &&
              m.href &&
              'hover:bg-emerald-50 hover:text-foreground dark:hover:bg-emerald-950/40',
            !m.href && 'cursor-default opacity-60',
          );
          const body = (
            <>
              {m.icon}
              <span>{m.en}</span>
              <span className={cn('text-xs', isActive ? 'opacity-80' : 'opacity-70')}>{m.sv}</span>
              {m.count === undefined ? null : (
                <span
                  className={cn(
                    'rounded-full px-1.5 font-mono text-[11px] tabular-nums',
                    isActive ? 'bg-white/20' : 'bg-muted',
                  )}
                >
                  {m.count}
                </span>
              )}
            </>
          );
          return m.href ? (
            <Link
              key={m.id}
              href={m.href}
              className={className}
              aria-current={isActive ? 'page' : undefined}
            >
              {body}
            </Link>
          ) : (
            <span key={m.id} className={className} title="Not part of this mock">
              {body}
            </span>
          );
        })}
      </nav>
      <div className="ml-auto hidden items-center gap-2 text-muted-foreground text-xs sm:flex">
        <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
        Mentimeter AB
      </div>
    </div>
  );
}
