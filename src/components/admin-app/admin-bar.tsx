import { Server } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export type AdminTab = { id: string; label: string; href: string; count: number };

/**
 * The back-office chrome: a dark strip with the title, an environment badge
 * and underline tabs. Full-bleed, so the page below it reads as a tool.
 */
export function AdminBar({ active, tabs }: { active: string; tabs: AdminTab[] }) {
  const current = tabs.find((t) => t.id === active);
  return (
    <div className="border-slate-800 border-b bg-slate-900 text-slate-100 dark:bg-slate-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col px-6">
        <div className="flex h-11 items-center gap-3">
          <span
            aria-hidden
            className="flex size-6 items-center justify-center rounded bg-indigo-500 text-white"
          >
            <Server className="size-3.5" />
          </span>
          <span className="font-semibold text-sm tracking-tight">Admin</span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-400 text-sm">{current?.label.toLowerCase()}</span>
          <span className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-300">
            <span aria-hidden className="size-1.5 rounded-full bg-emerald-400" />
            production
          </span>
          <div className="ml-auto hidden items-center gap-4 font-mono text-[11px] text-slate-400 sm:flex">
            {tabs.map((t) => (
              <span key={t.id}>
                {t.label.toLowerCase()}=<span className="text-slate-200">{t.count}</span>
              </span>
            ))}
            <span className="rounded border border-slate-700 px-1.5 py-0.5 text-slate-300">
              read-only
            </span>
          </div>
        </div>
        <nav aria-label="Admin sections" className="-mb-px flex gap-1">
          {tabs.map((t) => {
            const isActive = t.id === active;
            return (
              <Link
                key={t.id}
                href={t.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'border-indigo-400 text-white'
                    : 'border-transparent text-slate-400 hover:border-slate-600 hover:text-slate-200',
                )}
              >
                {t.label}
                <span
                  className={cn(
                    'rounded px-1.5 font-mono text-[10px] tabular-nums',
                    isActive ? 'bg-indigo-500/30 text-indigo-200' : 'bg-slate-800 text-slate-400',
                  )}
                >
                  {t.count}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
