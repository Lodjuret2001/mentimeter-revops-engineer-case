import { editAccountAction, editOpportunityAction } from '@/app/(shell)/orchestrator/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { SalesforceAccount, SalesforceOpportunity } from '@/lib/systems/types';
import { kindOf, PICKLISTS, READ_ONLY } from './fields';

const selectClass =
  'h-8 w-full rounded-md border border-input bg-background px-2 text-[13px] dark:bg-input/30';

function FieldInput({ field, value }: { field: string; value: unknown }) {
  const kind = kindOf(field, value);
  const text = value === null || value === undefined ? '' : String(value);
  if (kind === 'boolean') {
    return (
      <select name={field} defaultValue={value ? 'true' : 'false'} className={selectClass}>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }
  if (kind === 'picklist') {
    const options = PICKLISTS[field];
    return (
      <select name={field} defaultValue={text} className={selectClass}>
        <option value="">None</option>
        {[...new Set([...options, ...(text ? [text] : [])])].map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  const long = kind === 'text' && text.length > 60;
  if (long) {
    return (
      <textarea
        name={field}
        defaultValue={text}
        rows={3}
        className="w-full rounded-md border border-input bg-background px-2 py-1 text-[13px] dark:bg-input/30"
      />
    );
  }
  return (
    <Input
      name={field}
      type={kind === 'number' ? 'number' : kind === 'date' ? 'date' : 'text'}
      step={kind === 'number' ? 'any' : undefined}
      defaultValue={text}
      className={`h-8 text-[13px] ${/Id$|__c$/.test(field) && kind === 'text' && /^[0-9A-Za-z]{15,18}$|^WS-|^SUB-/.test(text) ? 'font-mono' : ''}`}
    />
  );
}

function RecordEditForm({
  record,
  idField,
  action,
  note,
}: {
  record: Record<string, unknown>;
  idField: string;
  action: (formData: FormData) => Promise<void>;
  note: string;
}) {
  const fields = Object.keys(record).filter((key) => !READ_ONLY.has(key));
  return (
    <form action={action} className="flex flex-col gap-3 p-3">
      <input type="hidden" name={idField} value={String(record.Id)} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((field) => (
          <div key={field} className="flex flex-col gap-1">
            <span className="truncate font-mono text-[11px] text-muted-foreground" title={field}>
              {field}
            </span>
            <FieldInput field={field} value={record[field]} />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] text-muted-foreground">{note}</span>
        <Button size="sm" type="submit">
          Save
        </Button>
      </div>
    </form>
  );
}

export function OpportunityEditForm({ opportunity }: { opportunity: SalesforceOpportunity }) {
  const { OpportunityLineItems: _lines, ...record } = opportunity as Record<string, unknown>;
  return (
    <RecordEditForm
      record={record}
      idField="opportunityId"
      action={editOpportunityAction}
      note={
        opportunity.StageName === 'Closed Won'
          ? 'Saving publishes an opportunity.updated event, so Menti Orchestrator runs again.'
          : 'Saving writes to Salesforce. Setting the stage to Closed Won runs Menti Orchestrator.'
      }
    />
  );
}

export function AccountEditForm({ account }: { account: SalesforceAccount }) {
  return (
    <RecordEditForm
      record={account as Record<string, unknown>}
      idField="accountId"
      action={editAccountAction}
      note="Saving re-runs Menti Orchestrator for this account's Closed Won deals."
    />
  );
}
