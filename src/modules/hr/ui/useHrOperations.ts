import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CompanyScope, HrOperationalSnapshot, RecordPayrollEventInput } from '../application/HrOperationsRepository';
import { getHrOperationsRepository } from '../infrastructure/createHrRepositories';

export interface HrOperationsState {
  busy: boolean;
  errorMessage: string | null;
  successMessage: string | null;
  data: HrOperationalSnapshot | null;
}

function messageFrom(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Não foi possível concluir a operação de RH.';
}

export function useHrOperations(scope: CompanyScope, competenceMonth: string) {
  const repository = useMemo(() => getHrOperationsRepository(), []);
  const [state, setState] = useState<HrOperationsState>({ busy: false, errorMessage: null, successMessage: null, data: null });

  const reload = useCallback(async () => {
    setState((current) => ({ ...current, busy: true, errorMessage: null }));
    try {
      const data = await repository.getSnapshot(scope, competenceMonth);
      setState((current) => ({ ...current, busy: false, data }));
      return data;
    } catch (error) {
      setState((current) => ({ ...current, busy: false, errorMessage: messageFrom(error) }));
      throw error;
    }
  }, [repository, scope, competenceMonth]);

  useEffect(() => { void reload().catch(() => undefined); }, [reload]);

  const execute = useCallback(async <T,>(action: () => Promise<T>, successMessage: string): Promise<T> => {
    setState((current) => ({ ...current, busy: true, errorMessage: null, successMessage: null }));
    try {
      const result = await action();
      const data = await repository.getSnapshot(scope, competenceMonth);
      setState((current) => ({ ...current, busy: false, successMessage, data }));
      return result;
    } catch (error) {
      setState((current) => ({ ...current, busy: false, errorMessage: messageFrom(error) }));
      throw error;
    }
  }, [repository, scope, competenceMonth]);

  return {
    state,
    reload,
    clearFeedback: () => setState((current) => ({ ...current, errorMessage: null, successMessage: null })),
    createEmployee: (input: { fullName: string; hiredOn: string; jobTitle: string; baseSalary: number; costCenterId?: string | null; allocationPercent?: number }) => execute(() => repository.createEmployeeBundle({ ...scope, ...input }), 'Colaborador cadastrado com sucesso.'),
    updateEmployeeProfile: (employmentContractId: string, fullName: string, jobTitle: string) => execute(() => repository.updateEmployeeProfile(scope, employmentContractId, fullName, jobTitle), 'Cadastro do colaborador atualizado com sucesso.'),
    changeSalary: (employmentContractId: string, effectiveFrom: string, baseSalary: number) => execute(() => repository.changeSalary(scope, employmentContractId, effectiveFrom, baseSalary), 'Salário atualizado com sucesso.'),
    changeAllocation: (employmentContractId: string, effectiveFrom: string, costCenterId: string, allocationPercent: number) => execute(() => repository.changeAllocation(scope, employmentContractId, effectiveFrom, costCenterId, allocationPercent), 'Alocação atualizada com sucesso.'),
    terminateContract: (employmentContractId: string, terminatedOn: string) => execute(() => repository.terminateContract(scope, employmentContractId, terminatedOn), 'Vínculo encerrado com sucesso.'),
    recordEvent: (input: Omit<RecordPayrollEventInput, keyof CompanyScope>) => execute(() => repository.recordPayrollEvent({ ...scope, ...input }), 'Evento lançado com sucesso.'),
    voidEvent: (payrollEventId: string, reason: string) => execute(() => repository.voidPayrollEvent(scope, payrollEventId, reason), 'Evento estornado com sucesso.'),
    closePayroll: (employmentContractId: string, key: string) => execute(() => repository.closePayroll(scope, employmentContractId, competenceMonth, key), 'Folha fechada com sucesso.'),
    calculateStatutory: (payrollClosingId: string, dependents: number, deductions: number) => execute(() => repository.calculateStatutory(scope, payrollClosingId, dependents, deductions), 'INSS, IRRF e FGTS recalculados com sucesso.'),
    reopenPayroll: (payrollClosingId: string, reason: string) => execute(() => repository.reopenPayroll(scope, payrollClosingId, reason), 'Folha reaberta com sucesso.'),
    configurePayrollFinance: (input: { salaryCategoryId: string; fgtsCategoryId: string; inssCategoryId: string; irrfCategoryId: string }) => execute(() => repository.configurePayrollFinance(scope, input.salaryCategoryId, input.fgtsCategoryId, input.inssCategoryId, input.irrfCategoryId), 'Categorias financeiras da folha configuradas com sucesso.'),
    syncPayables: (dates: { salaryDueDate: string; fgtsDueDate: string; inssDueDate: string; irrfDueDate: string }) => execute(() => repository.syncPayrollPayables(scope, competenceMonth, dates.salaryDueDate, dates.fgtsDueDate, dates.inssDueDate, dates.irrfDueDate), 'Contas a pagar da folha sincronizadas com sucesso.'),
    upsertBudgetPlan: (input: { costCenterId?: string | null; categoryId?: string | null; amount: number; notes?: string | null }) => execute(() => repository.upsertBudgetPlan({ ...scope, competenceMonth, ...input }), 'Planejamento atualizado com sucesso.'),
    upsertBudgetLimit: (input: { costCenterId?: string | null; categoryId?: string | null; amount: number; warningPercent: number; notes?: string | null }) => execute(() => repository.upsertBudgetLimit({ ...scope, competenceMonth, ...input }), 'Limite atualizado com sucesso.'),
  };
}
