import { editAccountAction, editOpportunityAction } from '@/app/(shell)/orchestrator/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { SalesforceAccount, SalesforceOpportunity } from '@/lib/systems/types';

const CURRENCIES = ['SEK', 'EUR', 'USD', 'GBP'];

const selectClass =
  'h-8 w-full rounded-md border border-input bg-background px-2 text-[13px] dark:bg-input/30';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function SelectField({
  name,
  value,
  options,
  allowEmpty,
}: {
  name: string;
  value: string | null | undefined;
  options: string[];
  allowEmpty?: boolean;
}) {
  return (
    <select name={name} defaultValue={value ?? ''} className={selectClass}>
      {allowEmpty ? <option value="">None</option> : null}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

export function OpportunityEditForm({ opportunity }: { opportunity: SalesforceOpportunity }) {
  const won = opportunity.StageName === 'Closed Won';
  return (
    <form action={editOpportunityAction} className="flex flex-col gap-3 p-3">
      <input type="hidden" name="opportunityId" value={opportunity.Id} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="PO Number">
          <Input
            name="PO_Number__c"
            defaultValue={opportunity.PO_Number__c ?? ''}
            className="h-8 text-[13px]"
          />
        </Field>
        <Field label="Payment Method">
          <SelectField
            name="Payment_Method__c"
            value={opportunity.Payment_Method__c}
            options={['Invoice', 'Card']}
            allowEmpty
          />
        </Field>
        <Field label="Discount Approval">
          <SelectField
            name="Discount_Approval__c"
            value={opportunity.Discount_Approval__c}
            options={['Not required', 'Pending', 'Approved']}
            allowEmpty
          />
        </Field>
        <Field label="Number of Licenses">
          <Input
            name="Number_of_Licenses__c"
            type="number"
            min={1}
            defaultValue={opportunity.Number_of_Licenses__c ?? ''}
            className="h-8 text-[13px]"
          />
        </Field>
        <Field label="Start Date">
          <Input
            name="Start_Date__c"
            type="date"
            defaultValue={opportunity.Start_Date__c ?? ''}
            className="h-8 text-[13px]"
          />
        </Field>
        <Field label="End Date">
          <Input
            name="End_Date__c"
            type="date"
            defaultValue={opportunity.End_Date__c ?? ''}
            className="h-8 text-[13px]"
          />
        </Field>
        <Field label="Currency">
          <SelectField
            name="CurrencyIsoCode"
            value={opportunity.CurrencyIsoCode}
            options={CURRENCIES}
          />
        </Field>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] text-muted-foreground">
          {won
            ? 'Saving publishes an opportunity.updated event, so Menti Orchestrator runs again.'
            : 'Saving writes to Salesforce.'}
        </span>
        <Button size="sm" type="submit">
          Save
        </Button>
      </div>
    </form>
  );
}

export function AccountEditForm({ account }: { account: SalesforceAccount }) {
  return (
    <form action={editAccountAction} className="flex flex-col gap-3 p-3">
      <input type="hidden" name="accountId" value={account.Id} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Legal Entity Name">
          <Input
            name="Legal_Entity_Name__c"
            defaultValue={account.Legal_Entity_Name__c ?? ''}
            className="h-8 text-[13px]"
          />
        </Field>
        <Field label="VAT Number">
          <Input
            name="VAT_Number__c"
            defaultValue={account.VAT_Number__c ?? ''}
            className="h-8 text-[13px]"
          />
        </Field>
        <Field label="Invoice Email">
          <Input
            name="Invoice_Email__c"
            type="email"
            defaultValue={account.Invoice_Email__c ?? ''}
            className="h-8 text-[13px]"
          />
        </Field>
        <Field label="Currency">
          <SelectField
            name="CurrencyIsoCode"
            value={account.CurrencyIsoCode}
            options={[...new Set([...CURRENCIES, account.CurrencyIsoCode])]}
          />
        </Field>
        <Field label="Workspace ID">
          <Input
            name="Workspace_ID__c"
            defaultValue={account.Workspace_ID__c ?? ''}
            placeholder="WS-…"
            className="h-8 font-mono text-[13px]"
          />
        </Field>
        <Field label="PO Required">
          <SelectField
            name="PO_Required__c"
            value={account.PO_Required__c ? 'Yes' : 'No'}
            options={['Yes', 'No']}
          />
        </Field>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] text-muted-foreground">
          Saving re-runs Menti Orchestrator for this account's Closed Won deals.
        </span>
        <Button size="sm" type="submit">
          Save
        </Button>
      </div>
    </form>
  );
}
