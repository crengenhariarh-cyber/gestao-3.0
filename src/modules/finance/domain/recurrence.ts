import type { FinancialEntryType, FinancialPaymentMethod } from './entries';
import type { CompanyScope } from './registries';

export type RecurrenceStatus = 'active' | 'inactive';
export type RecurrenceFrequency = 'monthly';

export interface FinancialRecurrenceRule extends CompanyScope {
  id: string;
  entryType: FinancialEntryType;
  description: string;
  counterpartyName: string | null;
  categoryId: string;
  costCenterId: string | null;
  workId: string | null;
  paymentMethod: FinancialPaymentMethod | null;
  amount: number;
  frequency: RecurrenceFrequency;
  intervalCount: number;
  startDate: string;
  endDate: string | null;
  nextOccurrenceDate: string;
  anchorDay: number;
  status: RecurrenceStatus;
  notes: string | null;
}

export interface CreateFinancialRecurrenceRule extends CompanyScope {
  entryType: FinancialEntryType;
  description: string;
  counterpartyName?: string | null;
  categoryId: string;
  costCenterId?: string | null;
  workId?: string | null;
  paymentMethod?: FinancialPaymentMethod | null;
  amount: number;
  frequency?: RecurrenceFrequency;
  intervalCount?: number;
  startDate: string;
  endDate?: string | null;
  notes?: string | null;
}

export interface MaterializedFinancialRecurrence {
  entryId: string;
  occurrenceDate: string;
  nextOccurrenceDate: string;
}
