import { useEffect, useMemo, useState } from 'react';
import { Banknote, CalendarDays, CheckCircle2, Pencil, Trash2, WalletCards } from 'lucide-react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import type { FinancialEntryListItem, FinancialEntryType } from '../domain/entries';
import type { FinancialAccount } from '../domain/registries';
import type { InstallmentBalance } from '../domain/settlements';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback, LoadingState } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { MoneyInput } from '../../../shared/ui/MoneyInput';
import { Select } from '../../../shared/ui/Select';
import { getFinanceRepositories } from '../infrastructure/createFinanceRepositories';
import { useFinanceOperations } from './useFinanceOperations';
import './quick-entry.css';
import '../../home/ui/planning-payments.css';

type Action = 'details' | 'payment' | 'edit' | 'delete';
type PaymentMode = 'total' | 'partial';

interface Props {
  company: CompanySummary;
  availableCompanies?: readonly CompanySummary[];
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

export function MonthlyAccountActionDialog({ company, availableCompanies, entry, balance, open, onClose, onChanged }: Props) {
  const scope = useMemo(() => ({ tenantId: company.tenantId, companyId: company.id }), [company.id, company.tenantId]);
  const operations = useFinanceOperations(scope);
  const references = operations.state.references;
  const [action, setAction] = useState<Action>('details');
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('total');
  const [paymentAccounts, setPaymentAccounts] = useState<readonly FinancialAccount[]>([]);
  const [paymentForm, setPaymentForm] = useState({ accountId: '', settledOn: today(), amount: 0, notes: '' });
  const [editForm, setEditForm] = useState({ entryType: entry.entryType, description: entry.description, counterparty: entry.counterpartyName ?? '', categoryId: entry.categoryId, costCenterId: entry.costCenterId ?? '', competenceMonth: entry.competenceMonth.slice(0, 7), dueDate: entry.dueDate, amount: String(entry.amount), installmentCount: String(entry.installmentCount), notes: entry.notes ?? '' });

  const original = balance?.installmentAmount ?? entry.amount;
  const alreadySettled = balance?.settledAmount ?? Math.max(0, original - (balance?.remainingAmount ?? entry.amount));
  const remaining = Math.max(0, balance?.remainingAmount ?? entry.amount);
  const paid = balance?.financialStatus === 'paid' || remaining <= 0;
  const partial = !paid && remaining + 0.005 < original;
  const isIncome = entry.entryType === 'income';
  const clearFeedback = operations.clearFeedback;
  const paymentAmount = paymentForm.amount;
  const remainingAfter = Math.max(remaining - paymentAmount, 0);
  const overpayAmount = Math.max(paymentAmount - remaining, 0);

  useEffect(() => {
    if (!open) return;
    setAction('details');
    setPaymentMode('total');
    setPaymentForm({ accountId: '', settledOn: today(), amount: remaining, notes: '' });
    setEditForm({ entryType: entry.entryType, description: entry.description, counterparty: entry.counterpartyName ?? '', categoryId: entry.categoryId, costCenterId: entry.costCenterId ?? '', competenceMonth: entry.competenceMonth.slice(0, 7), dueDate: entry.dueDate, amount: String(entry.amount), installmentCount: String(entry.installmentCount), notes: entry.notes ?? '' });
    clearFeedback();
  }, [clearFeedback, entry.amount, entry.categoryId, entry.competenceMonth, entry.costCenterId, entry.counterpartyName, entry.description, entry.dueDate, entry.entryType, entry.installmentCount, entry.notes, open, remaining]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const companies = availableCompanies?.length ? availableCompanies : [company];
    const repositories = getFinanceRepositories();
    void Promise.all(companies.map((item) => repositories.registries.listAccounts({ tenantId: item.tenantId, companyId: item.id })))
      .then((rows) => {
        if (cancelled) return;
        const unique = new Map<string, FinancialAccount>();
        rows.flat().forEach((account) => {
          if (account.status === 'active') unique.set(account.id, account);
        });
        setPaymentAccounts([...unique.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
      })
      .catch(() => {
        if (!cancelled) setPaymentAccounts([]);
      });
    return () => { cancelled = true; };
  }, [availableCompanies, company, open]);

  const activeAccounts = paymentAccounts.length > 0 ? paymentAccounts : (references?.accounts ?? []).filter((item) => item.status === 'active');
  const activeCostCenters = (references?.costCenters ?? []).filter((item) => item.status === 'active');
  const editType = editForm.entryType === 'income' ? 'income' : 'expense';
  const accountOptions = [{ value: '', label: 'Selecione…' }, ...activeAccounts.map((item) => ({ value: item.id, label: item.name }))];
  const costCenterOptions = [{ value: '', label: 'Sem centro de custo' }, ...activeCostCenters.map((item) => ({ value: item.id, label: item.name }))];
  const categoryOptions = [{ value: '', label: 'Selecione…' }, ...(references?.categories ?? []).filter((item) => item.status === 'active' && (item.kind === 'both' || item.kind === editType)).map((item) => ({ value: item.id, label: item.name }))];

  function choosePaymentMode(mode: PaymentMode) {
    setPaymentMode(mode);
    if (mode === 'total') setPaymentForm((current) => ({ ...current, amount: remaining }));
  }

  function openPayment() {
    setPaymentMode('total');
    setPaymentForm((current) => ({ ...current, amount: remaining }));
    setAction('payment');
  }

  async function prepareEdit() {
    setLoadingEntry(true);
    try {
      const rows = await getFinanceRepositories().entries.list(scope);
      const installments = rows.filter((item) => item.entryId === entry.entryId).sort((a, b) => a.installmentNumber - b.installmentNumber);
      const first = installments[0] ?? entry;
      setEditForm({ entryType: first.entryType, description: first.description, counterparty: first.counterpartyName ?? '', categoryId: first.categoryId, costCenterId: first.costCenterId ?? '', competenceMonth: first.competenceMonth.slice(0, 7), dueDate: first.dueDate, amount: String(installments.length ? installments.reduce((total, item) => total + item.amount, 0) : first.amount), installmentCount: String(first.installmentCount), notes: first.notes ?? '' });
      setAction('edit');
    } finally { setLoadingEntry(false); }
  }

  async function savePayment() {
    if (!paymentForm.accountId || paymentForm.amount <= 0 || paymentForm.amount > remaining + 0.005) return;
    try {
      await operations.settleInstallment({ installmentId: entry.installmentId, accountId: paymentForm.accountId, settledOn: paymentForm.settledOn, amount: paymentForm.amount, idempotencyKey: key('monthly-account'), notes: paymentForm.notes || null });
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

  if (action === 'payment') return <Dialog open={open} title={isIncome ? 'Registrar recebimento' : 'Registrar pagamento'} description={entry.description} loading={operations.state.busy} confirmLabel={isIncome ? 'Confirmar recebimento' : 'Confirmar pagamento'} onClose={() => setAction('details')} onBack={() => setAction('details')} onConfirm={() => { void savePayment(); }}>
    <div className="payment-app">
      {operations.state.errorMessage && <Feedback tone="danger" title={isIncome ? 'Não foi possível receber' : 'Não foi possível pagar'} message={operations.state.errorMessage} />}
      <div className="payment-app__hero"><span className="payment-app__icon" aria-hidden="true">▤</span><div><strong>{entry.description}</strong><span>{entry.installmentCount > 1 ? `PARCELA ${entry.installmentNumber}/${entry.installmentCount}` : isIncome ? 'RECEITA' : 'DESPESA'}</span></div></div>
      <div className="payment-app__totals"><div><span>Total original</span><strong>{currency.format(original)}</strong></div><div><span>{isIncome ? 'Já recebido' : 'Já pago'}</span><strong>{currency.format(alreadySettled)}</strong></div><div><span>Restante</span><strong>{currency.format(remaining)}</strong></div></div>
      <div className="payment-app__modes"><Button variant={paymentMode === 'total' ? 'primary' : 'secondary'} className="payment-app__mode" onClick={() => choosePaymentMode('total')} aria-pressed={paymentMode === 'total'}><span className="payment-app__mode-icon" aria-hidden="true">✓</span><span><strong>{isIncome ? 'Recebimento total' : 'Pagamento total'}</strong><small>Liquidar o valor restante</small></span></Button><Button variant={paymentMode === 'partial' ? 'primary' : 'secondary'} className="payment-app__mode" onClick={() => choosePaymentMode('partial')} aria-pressed={paymentMode === 'partial'}><span className="payment-app__mode-icon" aria-hidden="true">◔</span><span><strong>{isIncome ? 'Recebimento parcial' : 'Pagamento parcial'}</strong><small>{isIncome ? 'Receber parte ou informar outro valor' : 'Pagar parte ou informar outro valor'}</small></span></Button></div>
      <div className="payment-app__bank"><Select label="Banco" value={paymentForm.accountId} onChange={(event) => setPaymentForm((current) => ({ ...current, accountId: event.target.value }))} options={accountOptions} required /></div>
      <div className="payment-app__fields"><Input label="Data efetiva" type="date" value={paymentForm.settledOn} onChange={(event) => setPaymentForm((current) => ({ ...current, settledOn: event.target.value }))} required /><MoneyInput label={isIncome ? 'Valor efetivamente recebido' : 'Valor efetivamente pago'} value={paymentForm.amount} onValueChange={(amount) => setPaymentForm((current) => ({ ...current, amount }))} required /></div>
      <Input label="Observação" value={paymentForm.notes} onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Opcional" />
      <div className={`payment-app__result ${overpayAmount > 0 ? 'is-warning' : ''}`.trim()}><span>{overpayAmount > 0 ? 'Valor acima do restante' : 'Saldo restante após confirmar'}</span><strong>{overpayAmount > 0 ? `+ ${currency.format(overpayAmount)}` : currency.format(remainingAfter)}</strong></div>
    </div>
  </Dialog>;

  if (action === 'edit') return <Dialog open={open} title="Editar lançamento" description="Altere os dados do lançamento." loading={operations.state.busy} confirmLabel="Salvar" onClose={() => setAction('details')} onBack={() => setAction('details')} onConfirm={() => { void saveEdit(); }}>
    <div className="quick-entry edit-entry-app">
      {operations.state.errorMessage && <Feedback tone="danger" title="Não foi possível salvar" message={operations.state.errorMessage} />}
      <div className="quick-entry__hero"><div className="quick-entry__type-switch" role="group" aria-label="Tipo do lançamento">
        <Button variant="tertiary" className={`quick-entry__type-choice quick-entry__type-choice--expense${editType === 'expense' ? ' is-selected' : ''}`} aria-pressed={editType === 'expense'} onClick={() => setEditForm((current) => ({ ...current, entryType: 'expense' as FinancialEntryType }))}><span className="quick-entry__choice-check">{editType === 'expense' ? '✓' : ''}</span><span className="quick-entry__choice-icon">↓</span><span><strong>Despesa</strong><small>Saída de dinheiro</small></span></Button>
        <Button variant="tertiary" className={`quick-entry__type-choice quick-entry__type-choice--income${editType === 'income' ? ' is-selected' : ''}`} aria-pressed={editType === 'income'} onClick={() => setEditForm((current) => ({ ...current, entryType: 'income' as FinancialEntryType }))}><span className="quick-entry__choice-check">{editType === 'income' ? '✓' : ''}</span><span className="quick-entry__choice-icon">↑</span><span><strong>Receita</strong><small>Entrada de dinheiro</small></span></Button>
      </div></div>
      <div className="quick-entry__form-card">
        <div className="quick-entry__two-col"><Input label="Descrição" value={editForm.description} onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))} required /><Input label="Valor" type="number" min="0.01" step="0.01" value={editForm.amount} onChange={(event) => setEditForm((current) => ({ ...current, amount: event.target.value }))} required /></div>
        <div className="quick-entry__two-col"><Select label="Categoria" value={editForm.categoryId} onChange={(event) => setEditForm((current) => ({ ...current, categoryId: event.target.value }))} options={categoryOptions} required /><Input label={editType === 'income' ? 'Pagador' : 'Fornecedor'} value={editForm.counterparty} onChange={(event) => setEditForm((current) => ({ ...current, counterparty: event.target.value }))} /></div>
        <div className="quick-entry__company-section"><strong className="quick-entry__section-label">Empresa</strong><div className="quick-entry__company-options"><Button variant="tertiary" className="quick-entry__company-choice is-selected" aria-pressed="true"><span className="quick-entry__company-check">✓</span><span><strong>{company.tradeName ?? company.legalName}</strong><small>{company.legalName}</small></span></Button></div></div>
        <Select label="Obra / Centro de custo" value={editForm.costCenterId} onChange={(event) => setEditForm((current) => ({ ...current, costCenterId: event.target.value }))} options={costCenterOptions} />
        <div className="quick-entry__two-col"><Input label="Competência inicial" type="month" value={editForm.competenceMonth} onChange={(event) => setEditForm((current) => ({ ...current, competenceMonth: event.target.value }))} required /><Input label="Primeiro vencimento" type="date" value={editForm.dueDate} onChange={(event) => setEditForm((current) => ({ ...current, dueDate: event.target.value }))} required /></div>
        <div className="quick-entry__two-col"><Input label="Parcelas" type="number" min="1" max="120" step="1" value={editForm.installmentCount} onChange={(event) => setEditForm((current) => ({ ...current, installmentCount: event.target.value }))} required /><Input label="Observação" value={editForm.notes} onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))} /></div>
      </div>
    </div>
  </Dialog>;

  if (action === 'delete') return <Dialog open={open} title="Excluir lançamento" description="Esta ação não pode ser desfeita." loading={operations.state.busy} confirmLabel="Excluir" onClose={() => setAction('details')} onBack={() => setAction('details')} onConfirm={() => { void confirmDelete(); }}>{operations.state.errorMessage && <Feedback tone="danger" title="Não foi possível excluir" message={operations.state.errorMessage} />}<Feedback tone="danger" title="Confirme a exclusão" message={`O lançamento “${entry.description}” será excluído.`} /></Dialog>;

  return <Dialog open={open} title={entry.description} description={`${isIncome ? 'A receber' : 'A pagar'} · ${formatDate(entry.dueDate)}`} onClose={onClose} onBack={onClose}>
    <div className="monthly-account-detail">
      <section className={`monthly-account-detail__hero ${isIncome ? 'monthly-account-detail__hero--income' : 'monthly-account-detail__hero--expense'}`}>
        <span className="monthly-account-detail__hero-icon">{isIncome ? <Banknote aria-hidden="true" /> : <WalletCards aria-hidden="true" />}</span>
        <div><small>{paid ? 'Valor baixado' : partial ? 'Saldo restante' : isIncome ? 'Valor a receber' : 'Valor a pagar'}</small><strong>{currency.format(paid ? entry.amount : remaining)}</strong></div>
        <span className={`monthly-account-detail__status ${paid ? 'is-paid' : partial ? 'is-partial' : 'is-pending'}`}>{paid ? 'Baixada' : partial ? 'Parcial' : 'Pendente'}</span>
      </section>
      <section className="monthly-account-detail__info"><div><CalendarDays aria-hidden="true" /><span><small>Vencimento</small><strong>{formatDate(entry.dueDate)}</strong></span></div><div><CheckCircle2 aria-hidden="true" /><span><small>Parcela</small><strong>{entry.installmentCount > 1 ? `${entry.installmentNumber}/${entry.installmentCount}` : 'Única'}</strong></span></div>{entry.counterpartyName && <div className="monthly-account-detail__counterparty"><span><small>{isIncome ? 'Pagador' : 'Fornecedor'}</small><strong>{entry.counterpartyName}</strong></span></div>}</section>
      {!paid && <section className="monthly-account-detail__actions" aria-label="Ações do lançamento"><Button className="monthly-account-detail__action monthly-account-detail__action--pay" onClick={openPayment}><WalletCards aria-hidden="true" /><span>{isIncome ? 'Receber' : partial ? 'Completar pagamento' : 'Pagar'}</span></Button>{entry.installmentNumber === 1 && <Button variant="secondary" className="monthly-account-detail__action monthly-account-detail__action--edit" onClick={() => { void prepareEdit(); }}><Pencil aria-hidden="true" /><span>Editar</span></Button>}{entry.installmentNumber === 1 && <Button variant="danger" className="monthly-account-detail__action monthly-account-detail__action--delete" onClick={() => setAction('delete')}><Trash2 aria-hidden="true" /><span>Excluir</span></Button>}</section>}
    </div>
  </Dialog>;
}