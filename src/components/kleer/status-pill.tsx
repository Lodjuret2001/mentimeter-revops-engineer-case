import { cn } from '@/lib/utils';

type InvoiceStatus = 'draft' | 'sent' | 'overdue' | 'paid' | 'credited' | 'credit';

const PILLS: Record<InvoiceStatus, { en: string; sv: string; className: string }> = {
  draft: {
    en: 'Draft',
    sv: 'Utkast',
    className:
      'bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
  },
  sent: {
    en: 'Sent',
    sv: 'Skickad',
    className:
      'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-900',
  },
  overdue: {
    en: 'Overdue',
    sv: 'Förfallen',
    className:
      'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900',
  },
  paid: {
    en: 'Paid',
    sv: 'Betald',
    className:
      'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900',
  },
  credited: {
    en: 'Credited',
    sv: 'Krediterad',
    className: 'bg-muted text-muted-foreground ring-border',
  },
  credit: {
    en: 'Credit note',
    sv: 'Kreditnota',
    className:
      'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-900',
  },
};

/** Kleer's invoice status pill: English first, the Swedish word in grey for flavour. */
export function InvoiceStatusPill({ status }: { status: string }) {
  const pill = PILLS[status as InvoiceStatus] ?? {
    en: status.replaceAll('_', ' '),
    sv: '',
    className: 'bg-muted text-muted-foreground ring-border',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 font-medium text-xs ring-1 ring-inset',
        pill.className,
      )}
    >
      {pill.en}
      {pill.sv ? <span className="font-normal opacity-60">{pill.sv}</span> : null}
    </span>
  );
}
