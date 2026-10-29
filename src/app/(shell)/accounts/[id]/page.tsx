import { notFound } from 'next/navigation';
import { DealsTable } from '@/components/data/deals-table';
import { Status } from '@/components/data/status';
import { AccountEditForm } from '@/components/salesforce/edit-forms';
import {
  FieldGrid,
  FieldSection,
  LightningCard,
  RecordHeader,
  RecordTabs,
  RelatedList,
  SalesforcePage,
  SF_TABLE,
} from '@/components/salesforce/lightning';
import { EmptyState } from '@/components/shell/page';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { adminApp, ConnectorError, kleer, salesforce, stripe } from '@/lib/connectors';
import { formatDate, formatMoney } from '@/lib/format';

export default async function AccountPage(props: PageProps<'/accounts/[id]'>) {
  const { id } = await props.params;
  const account = await salesforce.getAccount(id).catch((error) => {
    if (error instanceof ConnectorError && error.status === 404) notFound();
    throw error;
  });
  const [users, contacts, opportunities, workspaces, subscriptions] = await Promise.all([
    salesforce.listUsers(),
    salesforce.listContacts(account.Id),
    salesforce.listOpportunities({ accountId: account.Id }),
    adminApp.listWorkspaces({ salesforceAccountId: account.Id }),
    adminApp.listSubscriptions({ salesforceAccountId: account.Id }),
  ]);
  const kleerCustomer = account.Kleer_Customer_Number__c
    ? await kleer.getCustomer(account.Kleer_Customer_Number__c).catch(() => null)
    : null;
  const invoices = kleerCustomer
    ? await kleer.findInvoices({ customerNumber: kleerCustomer.customerNumber })
    : [];
  const stripeCustomers = (
    await Promise.all(
      workspaces.map((w) => stripe.findCustomers({ metadata: { workspace_id: w.id } })),
    )
  ).flat();
  const name = (userId: string | null) => users.find((u) => u.Id === userId)?.Name ?? null;
  const otherSystems =
    workspaces.length + subscriptions.length + invoices.length + stripeCustomers.length;

  return (
    <SalesforcePage>
      <RecordHeader
        object="account"
        objectLabel="Account"
        name={account.Name}
        actions={
          <Status value={account.Type} tone={account.Type === 'Customer' ? 'good' : 'neutral'} />
        }
        highlights={[
          ['Type', account.Type],
          ['Industry', account.Industry],
          ['Account Owner', name(account.OwnerId)],
          ['Billing Country', account.BillingCountry],
          ['Currency', account.CurrencyIsoCode],
          ['Website', account.Website],
        ]}
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
            <FieldSection title="Account Information">
              <FieldGrid
                items={[
                  ['Account Name', account.Name],
                  ['Type', account.Type],
                  ['Industry', account.Industry],
                  ['Employees', account.NumberOfEmployees.toLocaleString('en-GB')],
                  ['Website', account.Website],
                  ['Region', account.Region__c],
                  ['Account Owner', name(account.OwnerId)],
                  ['CSM', name(account.CSM__c)],
                ]}
              />
            </FieldSection>
            <FieldSection title="Billing">
              <FieldGrid
                items={[
                  ['Legal entity', account.Legal_Entity_Name__c],
                  ['VAT number', account.VAT_Number__c],
                  ['Invoice email', account.Invoice_Email__c],
                  ['PO required', account.PO_Required__c ? 'Yes' : 'No'],
                  ['Currency', account.CurrencyIsoCode],
                  [
                    'Billing address',
                    `${account.BillingStreet}, ${account.BillingPostalCode} ${account.BillingCity}, ${account.BillingCountry}`,
                  ],
                ]}
              />
            </FieldSection>
            <FieldSection title="Integrations">
              <FieldGrid
                items={[
                  ['Workspace ID', account.Workspace_ID__c],
                  ['Kleer customer number', account.Kleer_Customer_Number__c],
                ]}
              />
            </FieldSection>
            <FieldSection title="Edit">
              <AccountEditForm account={account} />
            </FieldSection>
          </LightningCard>

          <RelatedList
            id="related"
            object="opportunity"
            title="Opportunities"
            count={opportunities.length}
          >
            <DealsTable opportunities={opportunities} accounts={[account]} users={users} />
          </RelatedList>

          <RelatedList object="contact" title="Contacts" count={contacts.length}>
            <Table className={SF_TABLE}>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((c) => (
                  <TableRow key={c.Id}>
                    <TableCell className="text-[#0176d3] dark:text-[#78b0fd]">{c.Name}</TableCell>
                    <TableCell>{c.Title}</TableCell>
                    <TableCell>{c.Email}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </RelatedList>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <RelatedList object="system" title="In Other Systems" count={otherSystems}>
            <div className="divide-y">
              {workspaces.map((w) => (
                <div key={w.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0">
                    <span className="text-[12px] text-muted-foreground">Workspace</span>{' '}
                    <span className="font-mono">{w.id}</span> {w.name}, {w.activeMembers} members
                  </span>
                  <Status value={w.plan} />
                </div>
              ))}
              {subscriptions.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0">
                    <span className="text-[12px] text-muted-foreground">Subscription</span>{' '}
                    <span className="font-mono">{s.id}</span>: {s.seats} {s.plan} until{' '}
                    {formatDate(s.endDate)}, billed by {s.billingSystem}
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
              {stripeCustomers.map((c) => (
                <div key={c.id} className="px-3 py-2">
                  <span className="text-[12px] text-muted-foreground">Stripe customer</span>{' '}
                  <span className="font-mono">{c.id}</span> {c.email}
                </div>
              ))}
              {otherSystems === 0 ? (
                <div className="p-3">
                  <EmptyState>Not linked to anything in the admin app, Kleer or Stripe.</EmptyState>
                </div>
              ) : null}
            </div>
          </RelatedList>
        </div>
      </div>
    </SalesforcePage>
  );
}
