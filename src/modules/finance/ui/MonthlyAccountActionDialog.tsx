import { useEffect, useMemo, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import type { FinancialEntryListItem } from '../domain/entries';
import type { InstallmentBalance } from '../domain/settlements';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback, LoadingState } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';
import { getFinanceRepositories } from '../infrastructure/createFinanceRepositories';
import { useFinanceOperations } from './useFinanceOperations';

type Action = 'details' | 'payment' | 'edit' | 'delete';

interface Props {
  company: CompanySummary;
  entry: FinancialEntryListItem;
  balance?: InstallmentBalance;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function today(): string { return new Date().toISOString().slice(0, 10); }
function key(prefix: string): string { return `${prefix}:${crypto.randomUUID()}`; }
function monthStart(value: string): string { return `${value}-01`; }
function money(value: string): number { return Number(value.replace(',', '.')); }
function formatDate(value: string): string { const [year, month, day] = value.split('-'); return `${day}/${month}/${year}`; }

export function MonthlyAccountActionDialog({ company, entry, balance, open, onClose, onChanged }: Props) {
  const scope = useMemo(() => ({ tenantId: company.tenantId, companyId: company.id }), [company.id, company.tenantId]);
  const operations = useFinanceOperations(scope);
  const references = operations.state.references;
  const [action, setAction] = useState<Action>('details');
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ accountId: '', settledOn: today(), amount: '', notes: '' });
  const [editForm, setEditForm] = useState({ entryType: entry.entryType, description: entry.description, counterparty: entry.counterpartyName ?? '', categoryId: entry.categoryId, costCenterId: entry.costCenterId ?? '', competenceMonth: entry.competenceMonth.slice(0, 7), dueDate: entry.dueDate, amount: String(entry.amount), installmentCount: String(entry.installmentCount), notes: entry.notes ?? '' });

  const remaining = Math.max(0, balance?.remainingAmount ?? entry.amount);
  const paid = balance?.financialStatus === 'paid' || remaining <= 0;
  const partial = !paid && remaining + 0.005 < entry.amount;
  const isIncome = entry.entryType === 'income';

  useEffect(() => {
    if (!open) return;
    setAction('details');
    setPaymentForm({ accountId: '', settledOn: today(), amount: String(remaining), notes: '' });
    setEditForm({ entryType: entry.entryType, description: entry.description, counterparty: entry.counterpartyName ?? '', categoryId: entry.categoryId, costCenterId: entry.costCenterId ?? '', competenceMonth: entry.competenceMonth.slice(0, 7), dueDate: entry.dueDate, amount: String(entry.amount), installmentCount: String(entry.installmentCount), notes: entry.notes ?? '' });
    operations.clearFeedback();
  }, [entry.entryId, entry.installmentId, open]);

  const activeAccounts = (references?.accounts ?? []).filter((item) => item.status === 'active');
  const activeCostCenters = (references?.costCenters ?? []).filter((item) => item.status === 'active');
  const editType = editForm.entryType === 'income' ? 'income' : 'expense';
  const accountOptions = [{ value: '', label: 'Selecione…' }, ...activeAccounts.map((item) => ({ value: item.id, label: item.name }))];
  const costCenterOptions = [{ value: '', label: 'Sem centro de custo' }, ...activeCostCenters.map((item) => ({ value: item.id, label: item.code ? `${item.code} · ${item.name}` : item.name }))];
  const categoryOptions = [{ value: '', label: 'Selecione…' }, ...(references?.categories ?? []).filter((item) => item.status === 'active' && (item.kind === 'both' || item.kind === editType)).map((item) => ({ value: item.id, label: item.name }))];

  async function prepareEdit() {
    setLoadingEntry(true);
    try {
      const rows = await getFinanceRepositories().entries.list(scope);
      const installments = rows.filter((item) => item.entryId === entry.entryId).sort((a, b) => a.installmentNumber - b.installmentNumber);
      const first = installments[0] ?? entry;
      setEditForm({
        entryType: first.entryType,
        description: first.description,
        counterparty: first.counterpartyName ?? '',
        categoryId: first.categoryId,
        costCenterId: first.costCenterId ?? '',
        competenceMonth: first.competenceMonth.slice(0, 7),
        dueDate: first.dueDate,
        amount: String(installments.length ? installments.reduce((total, item) => total + item.amount, 0) : first.amount),
        installmentCount: String(first.installmentCount),
        notes: first.notes ?? '',
      });
      setAction('edit');
    } finally { setLoadingEntry(false); }
  }

  async function savePayment() {
    try {
      await operations.settleInstallment({ installmentId: entry.installmentId, accountId: paymentForm.accountId, settledOn: paymentForm.settledOn, amount: money(paymentForm.amount), idempotencyKey: key('monthly-account'), notes: paymentForm.notes || null });
      onChanged(); onClose();
    } catch { /* feedback permanece no modal */ }
  }

  async function saveEdit() {
    try {
      await operations.updateEntry({ entryId: entry.entryId, entryType: editType, description: editForm.description, counterpartyName: editForm.counterparty || null, categoryId: editForm.categoryId, costCenterId: editForm.costCenterId || null, competenceMonth: monthStart(editForm.competenceMonth), dueDate: editForm.dueDate, amount: money(editForm.amount), installmentCount: Number(editForm.installmentCount), notes: editForm.notes || null });
      onChanged(); onClose();
    } catch { /* feedback permanece no modal */ }
  }

  async function confirmDelete() {
    try { await operations.deleteEntry(entry.entryId); onChanged(); onClose(); } catch { /* feedback permanece no modal */ }
  }

  if (loadingEntry) return <Dialog open={open} title="Carregando lançamento" onClose={onClose} onBack={onClose}><LoadingState label="Carregando dados…" /></Dialog>;

  if (action === 'payment') return <Dialog open={open} title={isIncome ? 'Registrar recebimento' : 'Registrar pagamento'} description={partial ? `Saldo restante ${currency.format(remaining)}` : undefined} loading={operations.state.busy} confirmLabel={isIncome ? 'Confirmar recebimento' : 'Confirmar pagamento'} onClose={onClose} onBack={() => setAction('details')} onConfirm={() => { void savePayment(); }}>
    {operations.state.errorMessage && <Feedback tone="danger" title="Não foi possível concluir" message={operations.state.errorMessage} />}
    <div className="finance-form-grid"><Select label="Banco / Conta" value={paymentForm.accountId} onChange={(event) => setPaymentForm((current) => ({ ...current, accountId: event.target.value }))} options={accountOptions} required /><Input label="Data efetiva" type="date" value={paymentForm.settledOn} onChange={(event) => setPaymentForm((current) => ({ ...current, settledOn: event.target.value }))} required /><Input label="Valor efetivamente pago" type="number" min="0.01" step="0.01" max={remaining} value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} required /><Input label="Observação" value={paymentForm.notes} onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))} /></div>
  </Dialog>;

  if (action === 'edit') return <Dialog open={open} title="Editar lançamento" description="Altere os dados do lançamento." loading={operations.state.busy} confirmLabel="Salvar" onClose={onClose} onBack={() => setAction('details')} onConfirm={() => { void saveEdit(); }}>
    {operations.state.errorMessage && <Feedback tone="danger" title="Não foi possível salvar" message={operations.state.errorMessage} />}
    <div className="finance-form-grid"><Select label="Tipo" value={editType} onChange={(event) => setEditForm((current) => ({ ...current, entryType: event.target.value }))} options={[{ value: 'expense', label: 'Despesa' }, { value: 'income', label: 'Receita' }]} /><Input label="Descrição" value={editForm.description} onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))} required /><Input label="Fornecedor / pagador" value={editForm.counterparty} onChange={(event) => setEditForm((current) => ({ ...current, counterparty: event.target.value }))} /><Select label="Categoria" value={editForm.categoryId} onChange={(event) => setEditForm((current) => ({ ...current, categoryId: event.target.value }))} options={categoryOptions} required /><Select label="Centro de custo" value={editForm.costCenterId} onChange={(event) => setEditForm((current) => ({ ...current, costCenterId: event.target.value }))} options={costCenterOptions} /><Input label="Competência inicial" type="month" value={editForm.competenceMonth} onChange={(event) => setEditForm((current) => ({ ...current, competenceMonth: event.target.value }))} required /><Input label="Primeiro vencimento" type="date" value={editForm.dueDate} onChange={(event) => setEditForm((current) => ({ ...current, dueDate: event.target.value }))} required /><Input label="Valor total" type="number" min="0.01" step="0.01" value={editForm.amount} onChange={(event) => setEditForm((current) => ({ ...current, amount: event.target.value }))} required /><Input label="Parcelas" type="number" min="1" max="120" step="1" value={editForm.installmentCount} onChange={(event) => setEditForm((current) => ({ ...current, installmentCount: event.target.value }))} required /><Input label="Observação" value={editForm.notes} onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))} /></div>
  </Dialog>;

  if (action === 'delete') return <Dialog open={open} title="Excluir lançamento" description="Esta ação não pode ser desfeita." loading={operations.state.busy} confirmLabel="Excluir" onClose={onClose} onBack={() => setAction('details')} onConfirm={() => { void confirmDelete(); }}>
    {operations.state.errorMessage && <Feedback tone="danger" title="Não foi possível excluir" message={operations.state.errorMessage} />}
    <Feedback tone="danger" title="Confirme a exclusão" message={`O lançamento “${entry.description}” será excluído.`} />
  </Dialog>;

  return <Dialog open={open} title={entry.description} description={`${isIncome ? 'A receber' : 'A pagar'} · ${formatDate(entry.dueDate)}`} onClose={onClose} onBack={onClose}>
    <div className="monthly-account-detail">
      <div className="monthly-account-detail__amount"><span>{paid ? 'Valor baixado' : partial ? 'Saldo restante' : 'Valor'}</span><strong>{currency.format(paid ? entry.amount : remaining)}</strong></div>
      <div className="monthly-account-detail__meta"><span>{entry.installmentCount > 1 ? `Parcela ${entry.installmentNumber}/${entry.installmentCount}` : 'Parcela única'}</span>{entry.counterpartyName && <span>{entry.counterpartyName}</span>}<span>{paid ? 'Baixada' : partial ? 'Pagamento parcial' : 'Pendente'}</span></div>
      <div className="monthly-account-detail__actions">
        {!paid && <Button onClick={() => setAction('payment')}>{isIncome ? 'Receber' : partial ? 'Completar pagamento' : 'Pagar'}</Button>}
        {!paid && entry.installmentNumber === 1 && <Button variant="secondary" onClick={() => { void prepareEdit(); }}>Editar</Button>}
        {!paid && entry.installmentNumber === 1 && <Button variant="danger" onClick={() => setAction('delete')}>Excluir</Button>}
      </div>
    </div>
  </Dialog>;
}
