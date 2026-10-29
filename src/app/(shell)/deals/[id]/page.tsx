import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Status } from '@/components/data/status';
import {
  FieldGrid,
  FieldSection,
  LightningCard,
  RecordHeader,
  RecordTabs,
  RelatedList,
  SalesforcePage,
  SF_LINK,
  SF_TABLE,
} from '@/components/salesforce/lightning';
import { SalesPath } from '@/components/salesforce/sales-path';
import { EmptyState } from '@/components/shell/page';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { adminApp, ConnectorError, kleer, salesforce } from '@/lib/connectors';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';

/** Fields every opportunity has. Anything else was written back by an integration. */
const STANDARD_FIELDS = new Set([
  'Id',
  'Name',
  'AccountId',
  'RecordType',
  'StageName',
  'IsClosed',
  'IsWon',
  'CloseDate',
  'Amount',
  'CurrencyIsoCode',
  'OwnerId',
  'Plan__c',
  'Number_of_Licenses__c',
  'Total_Licenses__c',
  'Price_per_License_per_Year__c',
  'Discount__c',
  'Contract_Term__c',
  'Start_Date__c',
  'End_Date__c',
  'Multi_Year_deal__c',
  'Multi_Year_Payment_Terms__c',
  'Payment_Method__c',
  'Credit_Card_Payment__c',
  'PO_Number__c',
  'Billing_Contact__c',
  'Discount_Approval__c',
  'Original_Opportunity__c',
  'Subscription_ID__c',
  'Invoice_Number__c',
  'Description',
  'CreatedDate',
  'LastModifiedDate',
  'OpportunityLineItems',
]);

const yesNo = (value: unknown) => (value ? 'Yes' : 'No');

export default async function DealPage(props: PageProps<'/deals/[id]'>) {
  const { id } = await props.params;
  const opportunity = await salesforce.getOpportunity(id).catch((error) => {
    if (error instanceof ConnectorError && error.status === 404) notFound();
    throw error;
  });
  const [account, users, feed, subscriptions, invoices] = await Promise.all([
    salesforce.getAccount(opportunity.AccountId),
    salesforce.listUsers(),
    salesforce.listEvents(),
    adminApp.listSubscriptions({ salesforceAccountId: opportunity.AccountId }),
    kleer.findInvoices({ foreignId: opportunity.Id }),
  ]);
  const contact = opportunity.Billing_Contact__c
    ? await salesforce.getContact(opportunity.Billing_Contact__c).catch(() => null)
    : null;
  const original = opportunity.Original_Opportunity__c
    ? await salesforce.getOpportunity(opportunity.Original_Opportunity__c).catch(() => null)
    : null;
  const owner = users.find((u) => u.Id === opportunity.OwnerId);
  const events = feed.events.filter((e) => e.opportunityId === opportunity.Id);
  const custom = Object.entries(opportunity).filter(([key]) => !STANDARD_FIELDS.has(key));
  const money = (n: number | null) => formatMoney(n, opportunity.CurrencyIsoCode);
  const accountLink = (
    <Link href={`/accounts/${account.Id}`} className={SF_LINK}>
      {account.Name}
    </Link>
  );

  return (
    <SalesforcePage>
      <RecordHeader
        object="opportunity"
        objectLabel="Opportunity"
        name={opportunity.Name}
        actions={
          <>
            <Badge variant="outline">{opportunity.RecordType.Name}</Badge>
            <Status value={opportunity.StageName} />
          </>
        }
        highlights={[
          ['Account Name', accountLink],
          ['Amount', money(opportunity.Amount)],
          ['Close Date', formatDate(opportunity.CloseDate)],
          ['Stage', opportunity.StageName],
          ['Opportunity Owner', owner ? owner.Name : opportunity.OwnerId],
          ['Plan', opportunity.Plan__c],
        ]}
      />

      <SalesPath
        stage={opportunity.StageName}
        isClosed={opportunity.IsClosed}
        isWon={opportunity.IsWon}
      />

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <LightningCard id="details">
            <RecordTabs
              tabs={[
                { label: 'Details', href: '#details', active: true },
                { label: 'Related', href: '#related' },
              ]}
            />
            <FieldSection title="Opportunity Information">
              <FieldGrid
                items={[
                  ['Opportunity Name', opportunity.Name],
                  ['Account Name', accountLink],
                  ['Record Type', opportunity.RecordType.Name],
                  ['Stage', opportunity.StageName],
                  ['Amount', money(opportunity.Amount)],
                  ['Close Date', formatDate(opportunity.CloseDate)],
                  [
                    'Opportunity Owner',
                    owner ? `${owner.Name} (${owner.UserRole.Name})` : opportunity.OwnerId,
                  ],
                  ['Plan', opportunity.Plan__c],
                  ['Licenses on this deal', opportunity.Number_of_Licenses__c],
                  ['Total licenses after this deal', opportunity.Total_Licenses__c],
                  [
                    'List price per license per year',
                    money(opportunity.Price_per_License_per_Year__c),
                  ],
                  [
                    'Discount',
                    opportunity.Discount__c === null ? null : `${opportunity.Discount__c}%`,
                  ],
                  ['Discount approval', opportunity.Discount_Approval__c],
                  ['Contract term', opportunity.Contract_Term__c],
                  ['Start date', formatDate(opportunity.Start_Date__c)],
                  ['End date', formatDate(opportunity.End_Date__c)],
                  ['Multi-year deal', yesNo(opportunity.Multi_Year_deal__c)],
                  ['Multi-year payment terms', opportunity.Multi_Year_Payment_Terms__c],
                  [
                    'Original opportunity',
                    original ? (
                      <Link key="original" href={`/deals/${original.Id}`} className={SF_LINK}>
                        {original.Name}
                      </Link>
                    ) : null,
                  ],
                ]}
              />
            </FieldSection>
            <FieldSection title="Billing">
              <FieldGrid
                items={[
                  ['Payment method', opportunity.Payment_Method__c],
                  ['Credit card payment (legacy)', yesNo(opportunity.Credit_Card_Payment__c)],
                  ['PO number', opportunity.PO_Number__c],
                  ['Billing contact', contact ? `${contact.Name}, ${contact.Email}` : null],
                  ['Legal entity', account.Legal_Entity_Name__c],
                  ['VAT number', account.VAT_Number__c],
                  ['Invoice email', account.Invoice_Email__c],
                  ['PO required', yesNo(account.PO_Required__c)],
                  ['Country', account.BillingCountry],
                ]}
              />
            </FieldSection>
            <FieldSection title="Hand-off">
              <FieldGrid
                items={[
                  ['Subscription_ID__c', opportunity.Subscription_ID__c],
                  ['Invoice_Number__c', opportunity.Invoice_Number__c],
                  ...custom.map(
                    ([key, value]) =>
                      [key, value === null ? null : String(value)] as [string, string | null],
                  ),
                ]}
              />
            </FieldSection>
            {opportunity.Description ? (
              <FieldSection title="Description">
                <FieldGrid columns={1} items={[['Description', opportunity.Description]]} />
              </FieldSection>
            ) : null}
            <FieldSection title="System Information">
              <FieldGrid
                items={[
                  ['Created Date', formatDateTime(opportunity.CreatedDate)],
                  ['Last Modified Date', formatDateTime(opportunity.LastModifiedDate)],
                ]}
              />
            </FieldSection>
          </LightningCard>

          <RelatedList
            id="related"
            object="product"
            title="Products"
            count={opportunity.OpportunityLineItems.totalSize}
          >
            <Table className={SF_TABLE}>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">List Price</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Total Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {opportunity.OpportunityLineItems.records.map((line) => (
                  <TableRow key={line.Id}>
                    <TableCell>
                      <span className="text-[#0176d3] dark:text-[#78b0fd]">{line.Name}</span>{' '}
                      <span className="font-mono text-[12px] text-muted-foreground">
                        {line.ProductCode}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{line.Quantity}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(line.UnitPrice)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{line.Discount}%</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(line.TotalPrice)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </RelatedList>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <RelatedList object="event" title="Salesforce Events" count={events.length}>
            {events.length === 0 ? (
              <p className="px-3 py-4 text-center text-[12px] text-muted-foreground">
                No events for this deal.
              </p>
            ) : (
              <ol className="divide-y">
                {events.map((e) => (
                  <li key={e.replayId} className="flex gap-3 px-3 py-2">
                    <span
                      aria-hidden
                      className="mt-1.5 size-2 shrink-0 rounded-full bg-[#eb7092] ring-4 ring-[#eb7092]/15"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-mono text-[12px]">
                          #{e.replayId} {e.type}
                        </span>
                        <span className="shrink-0 text-[12px] text-muted-foreground">
                          {formatDateTime(e.occurredAt)}
                        </span>
                      </div>
                      <div className="text-[12px] text-muted-foreground">
                        Changed: {e.changedFields.join(', ')}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </RelatedList>

          <RelatedList
            object="system"
            title="In Other Systems"
            count={subscriptions.length + invoices.length}
          >
            <div className="divide-y">
              {subscriptions.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0">
                    <span className="text-[12px] text-muted-foreground">Admin app</span>{' '}
                    <span className="font-mono">{s.id}</span>: {s.seats} {s.plan},{' '}
                    {formatDate(s.startDate)} to {formatDate(s.endDate)}
                  </span>
                  <Status value={s.status} />
                </div>
              ))}
              {invoices.map((i) => (
                <div
                  key={i.invoiceNumber}
                  className="flex items-center justify-between gap-2 px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="text-[12px] text-muted-foreground">Kleer</span>{' '}
                    <span className="font-mono">{i.invoiceNumber}</span>:{' '}
                    {formatMoney(i.totalAmount, i.currency)}
                  </span>
                  <Status value={i.status} />
                </div>
              ))}
              {subscriptions.length + invoices.length === 0 ? (
                <div className="p-3">
                  <EmptyState>
                    Nothing for this account in the admin app, and no Kleer invoice for this deal.
                  </EmptyState>
                </div>
              ) : null}
            </div>
          </RelatedList>
        </div>
      </div>
    </SalesforcePage>
  );
}
