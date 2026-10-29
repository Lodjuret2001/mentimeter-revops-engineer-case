import { Check, Copy, Download, ListFilter } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Stripe's primary purple, used for links and the active nav item. */
export const STRIPE_PURPLE = '#635bff';

/** Formats an amount the way the Stripe Dashboard does: "SEK 54,000.00". */
export function stripeMoney(
  amount: number | null | undefined,
  currency: string | null | undefined,
) {
  if (amount === null || amount === undefined) return '';
  const code = (currency ?? '').toUpperCase();
  const number = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return code ? `${code} ${number}` : number;
}

/** A Stripe card expiry, e.g. "08/2028", and whether that month has passed. */
export function cardExpiry(expMonth: number, expYear: number, now = new Date()) {
  const label = `${String(expMonth).padStart(2, '0')}/${expYear}`;
  // A card is valid through the last day of its expiry month.
  const expired = new Date(Date.UTC(expYear, expMonth, 1)) <= now;
  return { label, expired };
}

const BRANDS: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
};

export function cardBrand(brand: string) {
  return BRANDS[brand.toLowerCase()] ?? brand;
}

type Tone = 'green' | 'amber' | 'red' | 'grey' | 'blue';

const TONES: Record<Tone, string> = {
  green: 'bg-[#d7f7c2] text-[#006908] dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-[#fcedb9] text-[#5f3f00] dark:bg-amber-500/15 dark:text-amber-300',
  red: 'bg-[#ffe7f2] text-[#b3093c] dark:bg-rose-500/15 dark:text-rose-300',
  grey: 'bg-[#ebeef1] text-[#545969] dark:bg-muted dark:text-muted-foreground',
  blue: 'bg-[#cff5f6] text-[#0055bc] dark:bg-sky-500/15 dark:text-sky-300',
};

const BY_VALUE: Record<string, { tone: Tone; label: string; check?: boolean }> = {
  active: { tone: 'green', label: 'Active', check: true },
  paid: { tone: 'green', label: 'Paid', check: true },
  trialing: { tone: 'blue', label: 'Trialing' },
  open: { tone: 'grey', label: 'Open' },
  past_due: { tone: 'amber', label: 'Past due' },
  payment_failed: { tone: 'red', label: 'Payment failed' },
  canceled: { tone: 'grey', label: 'Canceled' },
};

/** A status badge in the Stripe Dashboard style: small, square-ish, tinted. */
export function StripeBadge({ value, className }: { value: string; className?: string }) {
  const entry = BY_VALUE[value.toLowerCase()] ?? {
    tone: 'grey' as Tone,
    label: value.replaceAll('_', ' '),
  };
  return (
    <span
      className={cn(
        'inline-flex h-[18px] items-center gap-0.5 whitespace-nowrap rounded-[4px] px-1.5 font-medium text-[11px] leading-none',
        TONES[entry.tone],
        className,
      )}
    >
      {entry.label}
      {entry.check ? <Check className="size-3" strokeWidth={3} /> : null}
    </span>
  );
}

/** A Stripe object ID in monospace with the decorative copy icon Stripe shows next to it. */
export function StripeId({ value, className }: { value: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-mono text-[#425466] text-[12px] dark:text-muted-foreground',
        className,
      )}
    >
      {value}
      <Copy className="size-3 text-[#8792a2]" aria-hidden />
    </span>
  );
}

/** Stripe's primary link colour. */
export function StripeLink({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('font-medium text-[#635bff] hover:text-[#4b45c6]', className)}>
      {children}
    </span>
  );
}

/** The "Filter / Export" ghost buttons on every Stripe list. Decorative. */
export function StripeListActions() {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 rounded-md border-[#e3e8ee] bg-white text-[#353a44] text-[13px] shadow-[0_1px_1px_rgba(0,0,0,.06)] dark:border-border dark:bg-card dark:text-foreground"
      >
        <ListFilter />
        Filter
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 rounded-md border-[#e3e8ee] bg-white text-[#353a44] text-[13px] shadow-[0_1px_1px_rgba(0,0,0,.06)] dark:border-border dark:bg-card dark:text-foreground"
      >
        <Download />
        Export
      </Button>
    </div>
  );
}

/** A section title with the right-aligned list actions. */
export function StripeSectionHeader({
  title,
  count,
  description,
}: {
  title: ReactNode;
  count?: number;
  description?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="flex items-baseline gap-2 font-semibold text-[#30313d] text-[20px] tracking-[-0.01em] dark:text-foreground">
          {title}
          {count === undefined ? null : (
            <span className="font-normal text-[#687385] text-[13px] dark:text-muted-foreground">
              {count}
            </span>
          )}
        </h2>
        {description ? (
          <p className="text-[#687385] text-[13px] dark:text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <StripeListActions />
    </div>
  );
}

/** A labelled value inside a Stripe detail card. */
export function StripeField({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[#687385] text-[12px] dark:text-muted-foreground">{label}</dt>
      <dd className="text-[#30313d] text-[13px] dark:text-foreground">{children}</dd>
    </div>
  );
}
