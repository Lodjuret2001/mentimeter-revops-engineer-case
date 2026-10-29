export const READ_ONLY = new Set([
  'Id',
  'IsClosed',
  'IsWon',
  'RecordType',
  'CreatedDate',
  'LastModifiedDate',
  'OpportunityLineItems',
]);

export const PICKLISTS: Record<string, string[]> = {
  StageName: ['Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'],
  Payment_Method__c: ['Invoice', 'Card'],
  Discount_Approval__c: ['Not required', 'Pending', 'Approved'],
  Contract_Term__c: ['12 months', '24 months', 'Co-term'],
  Multi_Year_Payment_Terms__c: ['Invoiced annually', 'Paid upfront'],
  Plan__c: ['PRO', 'ENT'],
  CurrencyIsoCode: ['SEK', 'EUR', 'USD', 'GBP'],
  Type: ['Customer', 'Prospect'],
};

export const NUMBER_FIELDS = new Set([
  'Amount',
  'Number_of_Licenses__c',
  'Total_Licenses__c',
  'Price_per_License_per_Year__c',
  'Discount__c',
  'NumberOfEmployees',
]);

export const DATE_FIELDS = new Set(['CloseDate', 'Start_Date__c', 'End_Date__c']);

export const BOOLEAN_FIELDS = new Set([
  'Multi_Year_deal__c',
  'Credit_Card_Payment__c',
  'PO_Required__c',
]);

export type FieldKind = 'boolean' | 'number' | 'date' | 'picklist' | 'text';

export function kindOf(field: string, value: unknown): FieldKind {
  if (BOOLEAN_FIELDS.has(field) || typeof value === 'boolean') return 'boolean';
  if (NUMBER_FIELDS.has(field) || typeof value === 'number') return 'number';
  if (DATE_FIELDS.has(field)) return 'date';
  if (PICKLISTS[field]) return 'picklist';
  return 'text';
}
