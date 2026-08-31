export interface EngineeringScope { tenantId: string; companyId: string; }

export interface EngineeringReferenceItem { id: string; name: string; }
export interface EngineeringContractOption { id: string; contractNumber: string; workId: string; status: string; }
export interface EngineeringServiceOption { id: string; name: string; unit: string; }
export interface EngineeringContractServiceOption { id: string; contractId: string; description: string; unit: string; unitPrice: number; }
export interface EngineeringMeasurementOption { id: string; contractId: string; competence: string; status: string; }
export interface EngineeringProductionPeriodOption { id: string; workId: string; competence: string; status: string; }
export interface EngineeringEmployeeOption { id: string; name: string; }
export interface EngineeringProvisionalOption { id: string; number: string; status: string; workId: string; }

export interface EngineeringOperationalSnapshot {
  works: readonly EngineeringReferenceItem[];
  structures: readonly (EngineeringReferenceItem & { workId: string })[];
  services: readonly EngineeringServiceOption[];
  contracts: readonly EngineeringContractOption[];
  contractServices: readonly EngineeringContractServiceOption[];
  measurements: readonly EngineeringMeasurementOption[];
  productionPeriods: readonly EngineeringProductionPeriodOption[];
  employees: readonly EngineeringEmployeeOption[];
  provisionals: readonly EngineeringProvisionalOption[];
}

export interface EngineeringOperationsRepository {
  getSnapshot(scope: EngineeringScope): Promise<EngineeringOperationalSnapshot>;
  createContract(scope: EngineeringScope, input: { workId: string; contractNumber: string; clientName?: string | null; signedAt?: string | null; startDate?: string | null; endDate?: string | null; notes?: string | null }): Promise<void>;
  updateContractStatus(scope: EngineeringScope, contractId: string, status: 'draft' | 'active' | 'suspended' | 'completed' | 'cancelled'): Promise<void>;
  createService(scope: EngineeringScope, input: { name: string; unit: string; code?: string | null; category?: string | null; notes?: string | null }): Promise<void>;
  addContractService(scope: EngineeringScope, input: { contractId: string; serviceId?: string | null; description: string; unit: string; quantity: number; unitPrice: number; notes?: string | null }): Promise<void>;
  createProvisional(scope: EngineeringScope, input: { workId: string; number: string; title?: string | null; clientName?: string | null; notes?: string | null }): Promise<void>;
  addProvisionalLine(scope: EngineeringScope, input: { provisionalId: string; serviceId?: string | null; description: string; unit: string; quantity: number; unitPrice: number; notes?: string | null }): Promise<void>;
  convertProvisional(input: { provisionalId: string; destination: 'contract' | 'addendum'; number: string; contractId?: string | null; addendumType?: 'increase' | 'reduction' | 'adjustment' | null }): Promise<void>;
  createAddendum(scope: EngineeringScope, input: { contractId: string; number: string; type: 'increase' | 'reduction' | 'adjustment'; effectiveDate?: string | null; statedValue?: number | null; notes?: string | null }): Promise<void>;
  createMeasurement(scope: EngineeringScope, input: { contractId: string; competence: string; notes?: string | null }): Promise<void>;
  addMeasurementLine(scope: EngineeringScope, input: { measurementId: string; contractServiceId: string; structureId?: string | null; measuredQuantity: number; unitPrice: number; notes?: string | null }): Promise<void>;
  addRetention(scope: EngineeringScope, input: { measurementId: string; retentionType: 'inss' | 'iss' | 'rt' | 'other'; calculationType: 'percentage' | 'fixed'; rate?: number | null; fixedAmount?: number | null; description?: string | null; notes?: string | null }): Promise<void>;
  setMeasurementStatus(measurementId: string, action: 'close' | 'approve' | 'cancel' | 'reopen', reason?: string | null): Promise<void>;
  generateMeasurementReceivable(measurementId: string, dueDate: string): Promise<void>;
  receiveMeasurement(measurementId: string, accountId: string, receivedOn: string, amount: number): Promise<void>;
  createProductionPeriod(scope: EngineeringScope, input: { workId: string; competence: string }): Promise<void>;
  addProductionEntry(scope: EngineeringScope, input: { periodId: string; employmentContractId: string; structureId: string; serviceId: string; productionDate: string; executedQuantity: number; unitValue?: number | null; notes?: string | null }): Promise<void>;
  setProductionPeriodStatus(periodId: string, action: 'close' | 'reopen', reason?: string | null): Promise<void>;
}
