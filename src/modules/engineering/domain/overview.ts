export interface EngineeringContractSummary {
  contractId: string;
  companyId: string;
  contractNumber: string;
  status: string;
  updatedContractValue: number;
  measuredNet: number;
  grossBalance: number;
  measuredPercent: number;
}

export interface EngineeringMeasurementSummary {
  measurementId: string;
  competence: string;
  status: string;
  grossAmount: number;
  retainedAmount: number;
  netAmount: number;
}

export interface EngineeringProductionSummary {
  employmentContractId: string;
  competence: string;
  executedQuantity: number;
  productionValue: number;
}

export interface EngineeringAddendumSummary {
  id: string;
  addendumNumber: string;
  addendumType: string;
  status: string;
  statedValue: number | null;
}

export interface EngineeringProvisionalSummary {
  id: string;
  provisionalNumber: string;
  title: string | null;
  status: string;
  clientName: string | null;
}

export interface EngineeringOverview {
  contracts: readonly EngineeringContractSummary[];
  measurements: readonly EngineeringMeasurementSummary[];
  production: readonly EngineeringProductionSummary[];
  addenda: readonly EngineeringAddendumSummary[];
  provisionals: readonly EngineeringProvisionalSummary[];
}
