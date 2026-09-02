import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';

export type AttendanceStatus = 'present' | 'absence' | 'medical_certificate' | 'vacation' | 'day_off' | 'other';

export interface AttendanceRecord {
  id: string;
  tenantId: string;
  companyId: string;
  employmentContractId: string;
  attendanceDate: string;
  status: AttendanceStatus;
  checkIn: string | null;
  checkOut: string | null;
  notes: string | null;
}

type AttendanceDbRow = {
  id: string;
  tenant_id: string;
  company_id: string;
  employment_contract_id: string;
  attendance_date: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
  notes: string | null;
};

type TransferResultRow = { new_contract_id: string };

function isTransferResultRow(value: unknown): value is TransferResultRow {
  if (typeof value !== 'object' || value === null || !('new_contract_id' in value)) return false;
  return typeof (value as Record<string, unknown>).new_contract_id === 'string';
}

export async function listAttendanceForDate(scopes: readonly { tenantId: string; companyId: string }[], attendanceDate: string): Promise<AttendanceRecord[]> {
  if (scopes.length === 0) return [];
  const client = getSupabaseClient();
  const rows = await Promise.all(scopes.map(async (scope) => {
    const result = await client
      .from('employee_attendance_daily')
      .select('id,tenant_id,company_id,employment_contract_id,attendance_date,status,check_in,check_out,notes')
      .eq('tenant_id', scope.tenantId)
      .eq('company_id', scope.companyId)
      .eq('attendance_date', attendanceDate)
      .returns<AttendanceDbRow[]>();
    if (result.error) throw result.error;
    return result.data ?? [];
  }));
  return rows.flat().map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    companyId: row.company_id,
    employmentContractId: row.employment_contract_id,
    attendanceDate: row.attendance_date,
    status: row.status as AttendanceStatus,
    checkIn: row.check_in,
    checkOut: row.check_out,
    notes: row.notes,
  }));
}

export async function saveAttendance(input: {
  tenantId: string;
  companyId: string;
  employmentContractId: string;
  attendanceDate: string;
  status: AttendanceStatus;
  checkIn?: string | null;
  checkOut?: string | null;
  notes?: string | null;
}): Promise<void> {
  const client = getSupabaseClient();
  const result = await client.from('employee_attendance_daily').upsert({
    tenant_id: input.tenantId,
    company_id: input.companyId,
    employment_contract_id: input.employmentContractId,
    attendance_date: input.attendanceDate,
    status: input.status,
    check_in: input.checkIn ?? null,
    check_out: input.checkOut ?? null,
    notes: input.notes ?? null,
    source_system: 'gestao-3.0',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'tenant_id,company_id,employment_contract_id,attendance_date' });
  if (result.error) throw result.error;
}

export async function saveAttendanceBatch(inputs: readonly {
  tenantId: string;
  companyId: string;
  employmentContractId: string;
  attendanceDate: string;
  status: AttendanceStatus;
}[]): Promise<void> {
  if (inputs.length === 0) return;
  const client = getSupabaseClient();
  const rows = inputs.map((input) => ({
    tenant_id: input.tenantId,
    company_id: input.companyId,
    employment_contract_id: input.employmentContractId,
    attendance_date: input.attendanceDate,
    status: input.status,
    source_system: 'gestao-3.0',
    updated_at: new Date().toISOString(),
  }));
  const result = await client.from('employee_attendance_daily').upsert(rows, { onConflict: 'tenant_id,company_id,employment_contract_id,attendance_date' });
  if (result.error) throw result.error;
}

export async function transferEmployeeCompany(input: {
  tenantId: string;
  sourceCompanyId: string;
  targetCompanyId: string;
  employmentContractId: string;
  effectiveOn: string;
  targetCostCenterId?: string | null;
  allocationPercent?: number;
}): Promise<string> {
  const client = getSupabaseClient();
  const { data: rawData, error } = await client.rpc('transfer_hr_employee_company', {
    p_tenant_id: input.tenantId,
    p_source_company_id: input.sourceCompanyId,
    p_target_company_id: input.targetCompanyId,
    p_employment_contract_id: input.employmentContractId,
    p_effective_on: input.effectiveOn,
    p_target_cost_center_id: input.targetCostCenterId ?? null,
    p_allocation_percent: input.allocationPercent ?? 100,
  }) as { data: unknown; error: unknown };
  if (error !== null && error !== undefined) {
    throw error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Falha ao transferir colaborador entre empresas.');
  }
  const row: unknown = Array.isArray(rawData) ? rawData[0] : rawData;
  if (!isTransferResultRow(row)) throw new Error('A transferência foi concluída sem retornar o novo vínculo.');
  return row.new_contract_id;
}
