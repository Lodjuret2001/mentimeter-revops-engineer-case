import Link from 'next/link';
import { Status } from '@/components/data/status';
import { SF_LINK, SF_TABLE, SortableHead } from '@/components/salesforce/lightning';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate, formatMoney } from '@/lib/format';
import type { SalesforceAccount, SalesforceOpportunity, SalesforceUser } from '@/lib/systems/types';

/** Opportunities as a Salesforce Lightning list view: dense rows, numbered, blue record links. */
export function DealsTable({
  opportunities,
  accounts,
  users,
}: {
  opportunities: SalesforceOpportunity[];
  accounts: SalesforceAccount[];
  users: SalesforceUser[];
}) {
  const accountName = (id: string) => accounts.find((a) => a.Id === id)?.Name ?? id;
  const userName = (id: string) => users.find((u) => u.Id === id)?.Name ?? id;
  return (
    <div className="rounded-[4px] border border-[#dddbda] bg-card dark:border-border">
      <Table className={SF_TABLE}>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8 text-right" />
            <SortableHead>Opportunity Name</SortableHead>
            <SortableHead>Stage</SortableHead>
            <SortableHead>Opportunity Owner</SortableHead>
            <SortableHead className="text-right">Licenses</SortableHead>
            <SortableHead className="text-right">Amount</SortableHead>
            <SortableHead>Payment Method</SortableHead>
            <SortableHead sorted>Close Date</SortableHead>
            <SortableHead>Subscription ID</SortableHead>
            <SortableHead>Invoice Number</SortableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {opportunities.map((o, index) => (
            <TableRow key={o.Id}>
              <TableCell className="text-right text-[12px] text-muted-foreground tabular-nums">
                {index + 1}
              </TableCell>
              <TableCell>
                <Link href={`/deals/${o.Id}`} className={SF_LINK}>
                  {o.Name}
                </Link>
                <div className="text-[12px] text-muted-foreground">
                  {accountName(o.AccountId)}, {o.RecordType.Name}
                </div>
              </TableCell>
              <TableCell>
                <Status value={o.StageName} />
              </TableCell>
              <TableCell>{userName(o.OwnerId)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {o.Number_of_Licenses__c} {o.Plan__c}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(o.Amount, o.CurrencyIsoCode)}
              </TableCell>
              <TableCell>{o.Payment_Method__c}</TableCell>
              <TableCell className="tabular-nums">{formatDate(o.CloseDate)}</TableCell>
              <TableCell className="font-mono text-[12px]">{o.Subscription_ID__c ?? ''}</TableCell>
              <TableCell className="font-mono text-[12px]">{o.Invoice_Number__c ?? ''}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
