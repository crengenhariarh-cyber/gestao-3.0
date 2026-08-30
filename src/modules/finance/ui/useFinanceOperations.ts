import { useMemo, useState } from 'react';
import type { CloseCardStatement, CreateCardPurchase, RecordCardStatementPayment } from '../domain/cards';
import type { CreateFinancialTransfer } from '../domain/accounts';
import type { CreateSingleFinancialEntry } from '../domain/entries';
import type {
  CompanyScope,
  CostCenter,
  CreateCostCenter,
  CreateFinancialAccount,
  CreateFinancialCategory,
  FinancialAccount,
  FinancialCategory,
} from '../domain/registries';
import type { CreateFinancialRecurrenceRule, FinancialRecurrenceRule } from '../domain/recurrence';
import type { RecordFinancialSettlement } from '../domain/settlements';
import { getFinanceRepositories } from '../infrastructure/createFinanceRepositories';

export interface FinanceReferenceData {
  categories: readonly FinancialCategory[];
  costCenters: readonly CostCenter[];
  accounts: readonly FinancialAccount[];
  recurrences: readonly FinancialRecurrenceRule[];
}

export type FinanceOperationState = {
  busy: boolean;
  errorMessage: string | null;
  successMessage: string | null;
  references: FinanceReferenceData | null;
};

function messageFrom(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Não foi possível concluir a operação financeira.';
}

export function useFinanceOperations(scope: CompanyScope) {
  const repositories = useMemo(() => getFinanceRepositories(), []);
  const [state, setState] = useState<FinanceOperationState>({
    busy: false,
    errorMessage: null,
    successMessage: null,
    references: null,
  });

  async function execute<T>(operation: () => Promise<T>, successMessage: string): Promise<T> {
    setState((current) => ({ ...current, busy: true, errorMessage: null, successMessage: null }));
    try {
      const result = await operation();
      setState((current) => ({ ...current, busy: false, successMessage }));
      return result;
    } catch (error) {
      setState((current) => ({ ...current, busy: false, errorMessage: messageFrom(error) }));
      throw error;
    }
  }

  async function loadReferences(): Promise<FinanceReferenceData> {
    setState((current) => ({ ...current, busy: true, errorMessage: null }));
    try {
      const [categories, costCenters, accounts, recurrences] = await Promise.all([
        repositories.registries.listCategories(scope),
        repositories.registries.listCostCenters(scope),
        repositories.registries.listAccounts(scope),
        repositories.recurrences.list(scope),
      ]);
      const references = { categories, costCenters, accounts, recurrences };
      setState((current) => ({ ...current, busy: false, references }));
      return references;
    } catch (error) {
      setState((current) => ({ ...current, busy: false, errorMessage: messageFrom(error) }));
      throw error;
    }
  }

  return {
    state,
    clearFeedback: () => setState((current) => ({ ...current, errorMessage: null, successMessage: null })),
    loadReferences,
    createEntry: (input: Omit<CreateSingleFinancialEntry, keyof CompanyScope>) =>
      execute(() => repositories.entries.createSingle({ ...scope, ...input }), 'Lançamento criado com sucesso.'),
    settleInstallment: (input: Omit<RecordFinancialSettlement, keyof CompanyScope>) =>
      execute(() => repositories.settlements.record({ ...scope, ...input }), 'Pagamento/recebimento registrado com sucesso.'),
    transfer: (input: Omit<CreateFinancialTransfer, keyof CompanyScope>) =>
      execute(() => repositories.accounts.recordTransfer({ ...scope, ...input }), 'Transferência registrada com sucesso.'),
    createCardPurchase: (input: Omit<CreateCardPurchase, keyof CompanyScope>) =>
      execute(() => repositories.cards.createPurchase({ ...scope, ...input }), 'Compra no cartão registrada com sucesso.'),
    closeCardStatement: (input: Omit<CloseCardStatement, keyof CompanyScope>) =>
      execute(() => repositories.cards.closeStatement({ ...scope, ...input }), 'Fatura fechada com sucesso.'),
    payCardStatement: (input: Omit<RecordCardStatementPayment, keyof CompanyScope>) =>
      execute(() => repositories.cards.recordStatementPayment({ ...scope, ...input }), 'Pagamento da fatura registrado com sucesso.'),
    createRecurrence: (input: Omit<CreateFinancialRecurrenceRule, keyof CompanyScope>) =>
      execute(() => repositories.recurrences.create({ ...scope, ...input }), 'Recorrência criada com sucesso.'),
    materializeRecurrence: (ruleId: string) =>
      execute(() => repositories.recurrences.materializeNext(ruleId), 'Próxima ocorrência gerada com sucesso.'),
    createCategory: (input: Omit<CreateFinancialCategory, keyof CompanyScope>) =>
      execute(() => repositories.registries.createCategory({ ...scope, ...input }), 'Categoria criada com sucesso.'),
    createCostCenter: (input: Omit<CreateCostCenter, keyof CompanyScope>) =>
      execute(() => repositories.registries.createCostCenter({ ...scope, ...input }), 'Centro de custo criado com sucesso.'),
    createAccount: (input: Omit<CreateFinancialAccount, keyof CompanyScope>) =>
      execute(() => repositories.registries.createAccount({ ...scope, ...input }), 'Conta criada com sucesso.'),
  };
}
