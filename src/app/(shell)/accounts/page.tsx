import type { Metadata } from 'next';
import Link from 'next/link';
import { Status } from '@/components/data/status';
import {
  ListView,
  SalesforcePage,
  SF_LINK,
  SF_TABLE,
  SortableHead,
} from '@/components/salesforce/lightning';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { salesforce } from '@/lib/connectors';

export const metadata: Metadata = { title: 'Accounts' };

export default async function AccountsPage() {
  const [accounts, users] = await Promise.all([salesforce.listAccounts(), salesforce.listUsers()]);
  const sorted = [...accounts].sort((a, b) => a.Name.localeCompare(b.Name));
  return (
    <SalesforcePage>
      <ListView
        object="account"
        objectLabel="Accounts"
        viewName="All Accounts"
        meta={[
          `${sorted.length} ${sorted.length === 1 ? 'item' : 'items'}`,
          'Sorted by Account Name',
          'Filtered by All accounts',
        ]}
      >
        <Table className={SF_TABLE}>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8 text-right" />
              <SortableHead sorted>Account Name</SortableHead>
              <SortableHead>Type</SortableHead>
              <SortableHead>Billing Country</SortableHead>
              <SortableHead>Currency</SortableHead>
              <SortableHead>Account Owner</SortableHead>
              <SortableHead>Workspace ID</SortableHead>
              <SortableHead>PO Required</SortableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((a, index) => (
              <TableRow key={a.Id}>
                <TableCell className="text-right text-[12px] text-muted-foreground tabular-nums">
                  {index + 1}
                </TableCell>
                <TableCell>
                  <Link href={`/accounts/${a.Id}`} className={SF_LINK}>
                    {a.Name}
                  </Link>
                  <div className="text-[12px] text-muted-foreground">{a.Industry}</div>
                </TableCell>
                <TableCell>
                  <Status value={a.Type} tone={a.Type === 'Customer' ? 'good' : 'neutral'} />
                </TableCell>
                <TableCell>{a.BillingCountry}</TableCell>
                <TableCell>{a.CurrencyIsoCode}</TableCell>
                <TableCell>{users.find((u) => u.Id === a.OwnerId)?.Name}</TableCell>
                <TableCell className="font-mono text-[12px]">{a.Workspace_ID__c ?? ''}</TableCell>
                <TableCell>{a.PO_Required__c ? 'Yes' : 'No'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ListView>
    </SalesforcePage>
  );
}
