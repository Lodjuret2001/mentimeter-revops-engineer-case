import type { Metadata } from 'next';
import { DealsTable } from '@/components/data/deals-table';
import { ListView, SalesforcePage } from '@/components/salesforce/lightning';
import { salesforce } from '@/lib/connectors';
import { CASE_WEEK_START } from '@/lib/format';

export const metadata: Metadata = { title: 'Deals' };

const VIEWS = {
  won: { label: 'Closed Won this week', href: '/deals', filter: 'Stage is Closed Won, this week' },
  open: { label: 'Open', href: '/deals?view=open', filter: 'Stage is not Closed' },
  all: { label: 'All Opportunities', href: '/deals?view=all', filter: 'All opportunities' },
} as const;

export default async function DealsPage(props: PageProps<'/deals'>) {
  const { view } = await props.searchParams;
  const active = view === 'all' ? 'all' : view === 'open' ? 'open' : 'won';
  const [opportunities, accounts, users] = await Promise.all([
    salesforce.listOpportunities(),
    salesforce.listAccounts(),
    salesforce.listUsers(),
  ]);
  const won = opportunities.filter(
    (o) => o.StageName === 'Closed Won' && o.CloseDate >= CASE_WEEK_START,
  );
  const open = opportunities.filter((o) => !o.IsClosed && !o.StageName.startsWith('Closed'));
  const shown = (active === 'won' ? won : active === 'open' ? open : opportunities).sort((a, b) =>
    b.CloseDate.localeCompare(a.CloseDate),
  );
  const counts = { won: won.length, open: open.length, all: opportunities.length };

  return (
    <SalesforcePage>
      <ListView
        object="opportunity"
        objectLabel="Opportunities"
        viewName={VIEWS[active].label}
        views={(Object.keys(VIEWS) as (keyof typeof VIEWS)[]).map((id) => ({
          id,
          label: VIEWS[id].label,
          href: VIEWS[id].href,
          count: counts[id],
          active: id === active,
        }))}
        meta={[
          `${shown.length} ${shown.length === 1 ? 'item' : 'items'}`,
          'Sorted by Close Date',
          `Filtered by ${VIEWS[active].filter}`,
        ]}
      >
        <DealsTable opportunities={shown} accounts={accounts} users={users} />
      </ListView>
    </SalesforcePage>
  );
}
