import { useMemo, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Dialog } from '../../../shared/ui/Dialog';
import { EmptyState, Feedback, LoadingState } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';
import { useFinanceOperations } from './useFinanceOperations';
import { useFinanceOverview } from './useFinanceOverview';
import './finance.css';

interface MonthlyAccountsPageProps { company: CompanySummary; }
type AccountScope = 'all' | 'payable' | 'receivable' | 'paid';
type DialogKind = 'payment' | 'edit' | 'delete' | null;

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function today(): string { return new Date().toISOString().slice(0, 10); }
function currentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthText = String(month).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  return { start: `${year}-${monthText}-01`, end: `${year}-${monthText}-${String(lastDay).padStart(2, '0')}` };
}
function formatDate(value: string): string { const [year, month, day] = value.split('-'); return `${day}/${month}/${year}`; }
function key(prefix: string): string { return `${prefix}:${crypto.randomUUID()}`; }
function monthStart(value: string): string { return `${value}-01`; }
function money(value: string): number { return Number(value.replace(',', '.')); }

export function MonthlyAccountsPage({ company }: MonthlyAccountsPageProps) {
  const scope = useMemo(() => ({ tenantId: company.tenantId, companyId: company.id }), [company.id, company.tenantId]);
  const initialRange = useMemo(() => currentMonthRange(), []);
  const [refreshToken, setRefreshToken] = useState(0);
  const [filter, setFilter] = useState<AccountScope>('all');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [paymentForm, setPaymentForm] = useState({ installmentId: '', accountId: '', settledOn: today(), amount: '', notes: '' });
  const [editForm, setEditForm] = useState({ entryId: '', entryType: 'expense', description: '', counterparty: '', categoryId: '', costCenterId: '', competenceMonth: today().slice(0, 7), dueDate: today(), amount: '', installmentCount: '1', notes: '' });
  const [deleteTarget, setDeleteTarget] = useState({ entryId: '', description: '' });
  const overview = useFinanceOverview(scope, refreshToken);
  const operations = useFinanceOperations(scope);
  const references = operations.state.references;

  if (overview.status === 'idle' || overview.status === 'loading') return <LoadingState label="Carregando contas do mês…" />;
  if (overview.status === 'error') return <EmptyState title="Contas do mês indisponíveis" message={overview.errorMessage} />;
  if (!overview.data) return <LoadingState label="Carregando contas do mês…" />;

  const data = overview.data;
  const balanceByInstallment = new Map((references?.installmentBalances ?? []).map((item) => [item.installmentId, item]));
  const rangeStart = startDate <= endDate ? startDate : endDate;
  const rangeEnd = startDate <= endDate ? endDate : startDate;
  const periodEntries = data.entries.filter((item) => item.dueDate >= rangeStart && item.dueDate <= rangeEnd);
  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
  const visibleEntries = periodEntries.filter((item) => {
    const balance = balanceByInstallment.get(item.installmentId);
    const paid = balance?.financialStatus === 'paid' || (balance?.remainingAmount ?? item.amount) <= 0;
    if (filter === 'payable' && (item.entryType !== 'expense' || paid)) return false;
    if (filter === 'receivable' && (item.entryType !== 'income' || paid)) return false;
    if (filter === 'paid' && !paid) return false;
    if (!normalizedSearch) return true;
    return [item.description, item.counterpartyName ?? '', item.notes ?? ''].some((value) => value.toLocaleLowerCase('pt-BR').includes(normalizedSearch));
  });

  const totals = periodEntries.reduce((result, item) => {
    const balance = balanceByInstallment.get(item.installmentId);
    const remaining = Math.max(0, balance?.remainingAmount ?? item.amount);
    const paid = balance?.financialStatus === 'paid' || remaining <= 0;
    if (paid) result.paid += item.amount;
    else if (item.entryType === 'income') result.receivable += remaining;
    else {
      result.payable += remaining;
      if (item.dueDate < today()) result.overdue += remaining;
    }
    return result;
  }, { payable: 0, receivable: 0, overdue: 0, paid: 0 });

  const activeAccounts = (references?.accounts ?? []).filter((item) => item.status === 'active');
  const activeCostCenters = (references?.costCenters ?? []).filter((item) => item.status === 'active');
  const accountOptions = [{ value: '', label: 'Selecione…' }, ...activeAccounts.map((item) => ({ value: item.id, label: item.name }))];
  const costCenterOptions = [{ value: '', label: 'Sem centro de custo' }, ...activeCostCenters.map((item) => ({ value: item.id, label: item.code ? `${item.code} · ${item.name}` : item.name }))];
  const editType = editForm.entryType === 'income' ? 'income' : 'expense';
  const categoryOptions = [{ value: '', label: 'Selecione…' }, ...(references?.categories ?? []).filter((item) => item.status === 'active' && (item.kind === 'both' || item.kind === editType)).map((item) => ({ value: item.id, label: item.name }))];

  function closeDialog() {
    setDialog(null);
    operations.clearFeedback();
  }

  function openPayment(installmentId: string) {
    const entry = periodEntries.find((item) => item.installmentId === installmentId);
    const balance = balanceByInstallment.get(installmentId);
    setPaymentForm({ installmentId, accountId: '', settledOn: today(), amount: String(balance?.remainingAmount ?? entry?.amount ?? ''), notes: '' });
    operations.clearFeedback();
    setDialog('payment');
  }

  function openEdit(entryId: string) {
    const installments = data.entries.filter((item) => item.entryId === entryId).sort((a, b) => a.installmentNumber - b.installmentNumber);
    const first = installments[0];
    if (!first) return;
    setEditForm({
      entryId,
      entryType: first.entryType,
      description: first.description,
      counterparty: first.counterpartyName ?? '',
      categoryId: first.categoryId,
      costCenterId: first.costCenterId ?? '',
      competenceMonth: first.competenceMonth.slice(0, 7),
      dueDate: first.dueDate,
      amount: String(installments.reduce((total, item) => total + item.amount, 0)),
      installmentCount: String(first.installmentCount),
      notes: first.notes ?? '',
    });
    operations.clearFeedback();
    setDialog('edit');
  }

  function openDelete(entryId: string, description: string) {
    setDeleteTarget({ entryId, description });
    operations.clearFeedback();
    setDialog('delete');
  }

  async function refreshAfterOperation() {
    await operations.loadReferences();
    setRefreshToken((value) => value + 1);
    closeDialog();
  }

  async function savePayment() {
    try {
      await operations.settleInstallment({
        installmentId: paymentForm.installmentId,
        accountId: paymentForm.accountId,
        settledOn: paymentForm.settledOn,
        amount: money(paymentForm.amount),
        idempotencyKey: key('monthly-account'),
        notes: paymentForm.notes || null,
      });
      await refreshAfterOperation();
    } catch { /* feedback padronizado permanece no modal */ }
  }

  async function saveEdit() {
    try {
      await operations.updateEntry({
        entryId: editForm.entryId,
        entryType: editType,
        description: editForm.description,
        counterpartyName: editForm.counterparty || null,
        categoryId: editForm.categoryId,
        costCenterId: editForm.costCenterId || null,
        competenceMonth: monthStart(editForm.competenceMonth),
        dueDate: editForm.dueDate,
        amount: money(editForm.amount),
        installmentCount: Number(editForm.installmentCount),
        notes: editForm.notes || null,
      });
      await refreshAfterOperation();
    } catch { /* feedback padronizado permanece no modal */ }
  }

  async function confirmDelete() {
    try {
      await operations.deleteEntry(deleteTarget.entryId);
      await refreshAfterOperation();
    } catch { /* feedback padronizado permanece no modal */ }
  }

  return <section className="finance-overview" aria-labelledby="monthly-accounts-title">
    <div className="finance-overview__heading">
      <div><span className="ui-muted">Período {formatDate(rangeStart)} a {formatDate(rangeEnd)}</span><h1 id="monthly-accounts-title">Contas do mês</h1></div>
      <p className="ui-muted">Visão operacional de contas a pagar, contas a receber e títulos já baixados.</p>
    </div>

    {operations.state.errorMessage && dialog === null && <Feedback tone="danger" title="Operação não concluída" message={operations.state.errorMessage} />}
    {operations.state.successMessage && dialog === null && <Feedback tone="success" title="Concluído" message={operations.state.successMessage} />}

    <Card title="Período" description="Consulte o mês atual ou qualquer intervalo de vencimentos">
      <div className="finance-form-grid">
        <Input label="Data inicial" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        <Input label="Data final" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
      </div>
      <div className="finance-actions"><Button size="sm" variant="secondary" onClick={() => { const current = currentMonthRange(); setStartDate(current.start); setEndDate(current.end); }}>Mês atual</Button></div>
    </Card>

    <div className="finance-overview__cards">
      <Card title="A pagar"><strong className="balance-card__value">{currency.format(totals.payable)}</strong></Card>
      <Card title="A receber"><strong className="balance-card__value">{currency.format(totals.receivable)}</strong></Card>
      <Card title="Vencidas"><strong className="balance-card__value">{currency.format(totals.overdue)}</strong></Card>
      <Card title="Pagas no período"><strong className="balance-card__value">{currency.format(totals.paid)}</strong></Card>
    </div>

    <Card title="Contas" description="Pesquise e filtre sem sair do período selecionado">
      <div className="finance-form-grid">
        <Input label="Buscar" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Descrição, fornecedor ou observação" />
        <Select label="Mostrar" value={filter} onChange={(event) => setFilter(event.target.value as AccountScope)} options={[
          { value: 'all', label: 'Todas' },
          { value: 'payable', label: 'A pagar' },
          { value: 'receivable', label: 'A receber' },
          { value: 'paid', label: 'Pagas / recebidas' },
        ]} />
      </div>

      {visibleEntries.length === 0 ? <p className="ui-muted">Nenhuma conta encontrada para este filtro.</p> : <div className="finance-list">
        {visibleEntries.map((item) => {
          const balance = balanceByInstallment.get(item.installmentId);
          const remaining = Math.max(0, balance?.remainingAmount ?? item.amount);
          const paid = balance?.financialStatus === 'paid' || remaining <= 0;
          const partial = !paid && remaining + 0.005 < item.amount;
          const overdue = !paid && item.entryType === 'expense' && item.dueDate < today();
          return <div className="finance-list__group" key={item.installmentId}>
            <div className="finance-list__row"><strong>{item.description}</strong><strong>{currency.format(item.amount)}</strong></div>
            <div className="finance-list__row"><span>{item.installmentCount > 1 ? `Parcela ${item.installmentNumber}/${item.installmentCount}` : 'Parcela única'}</span><span>Vence {formatDate(item.dueDate)}</span></div>
            <div className="finance-list__row"><span>{item.entryType === 'income' ? 'A receber' : 'A pagar'}{overdue ? ' · Vencida' : ''}</span><span>{paid ? 'Baixada' : partial ? `Parcial · saldo ${currency.format(remaining)}` : `Saldo ${currency.format(remaining)}`}</span></div>
            {item.counterpartyName && <div className="finance-list__row"><span>{item.counterpartyName}</span></div>}
            <div className="finance-actions">
              {!paid && <Button size="sm" onClick={() => openPayment(item.installmentId)}>{item.entryType === 'income' ? 'Receber' : partial ? 'Completar pagamento' : 'Pagar'}</Button>}
              {item.installmentNumber === 1 && !paid && <Button size="sm" variant="secondary" onClick={() => openEdit(item.entryId)}>Editar</Button>}
              {item.installmentNumber === 1 && !paid && <Button size="sm" variant="tertiary" onClick={() => openDelete(item.entryId, item.description)}>Excluir</Button>}
            </div>
          </div>;
        })}
      </div>}
    </Card>

    <Dialog open={dialog === 'payment'} title="Pagamento ou recebimento" description="Baixa vinculada exclusivamente à empresa e à conta selecionadas." loading={operations.state.busy} confirmLabel="Salvar" onClose={closeDialog} onBack={closeDialog} onConfirm={() => { void savePayment(); }}>
      {operations.state.errorMessage && <Feedback tone="danger" title="Não foi possível salvar" message={operations.state.errorMessage} />}
      <div className="finance-form-grid">
        <Select label="Conta" value={paymentForm.accountId} onChange={(event) => setPaymentForm((current) => ({ ...current, accountId: event.target.value }))} options={accountOptions} required />
        <Input label="Data" type="date" value={paymentForm.settledOn} onChange={(event) => setPaymentForm((current) => ({ ...current, settledOn: event.target.value }))} required />
        <Input label="Valor" type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} required />
        <Input label="Observação" value={paymentForm.notes} onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))} />
      </div>
    </Dialog>

    <Dialog open={dialog === 'edit'} title="Editar lançamento" description="Altera o lançamento e sua série somente quando as regras financeiras permitirem." loading={operations.state.busy} confirmLabel="Salvar" onClose={closeDialog} onBack={closeDialog} onConfirm={() => { void saveEdit(); }}>
      {operations.state.errorMessage && <Feedback tone="danger" title="Não foi possível salvar" message={operations.state.errorMessage} />}
      <div className="finance-form-grid">
        <Select label="Tipo" value={editType} onChange={(event) => setEditForm((current) => ({ ...current, entryType: event.target.value }))} options={[{ value: 'expense', label: 'Despesa' }, { value: 'income', label: 'Receita' }]} />
        <Input label="Descrição" value={editForm.description} onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))} required />
        <Input label="Fornecedor / pagador" value={editForm.counterparty} onChange={(event) => setEditForm((current) => ({ ...current, counterparty: event.target.value }))} />
        <Select label="Categoria" value={editForm.categoryId} onChange={(event) => setEditForm((current) => ({ ...current, categoryId: event.target.value }))} options={categoryOptions} required />
        <Select label="Centro de custo" value={editForm.costCenterId} onChange={(event) => setEditForm((current) => ({ ...current, costCenterId: event.target.value }))} options={costCenterOptions} />
        <Input label="Competência inicial" type="month" value={editForm.competenceMonth} onChange={(event) => setEditForm((current) => ({ ...current, competenceMonth: event.target.value }))} required />
        <Input label="Primeiro vencimento" type="date" value={editForm.dueDate} onChange={(event) => setEditForm((current) => ({ ...current, dueDate: event.target.value }))} required />
        <Input label="Valor total" type="number" min="0.01" step="0.01" value={editForm.amount} onChange={(event) => setEditForm((current) => ({ ...current, amount: event.target.value }))} required />
        <Input label="Parcelas" type="number" min="1" max="120" step="1" value={editForm.installmentCount} onChange={(event) => setEditForm((current) => ({ ...current, installmentCount: event.target.value }))} required />
        <Input label="Observação" value={editForm.notes} onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))} />
      </div>
    </Dialog>

    <Dialog open={dialog === 'delete'} title="Excluir lançamento" description="A exclusão só é permitida para lançamentos sem baixa e sem vínculos protegidos." loading={operations.state.busy} confirmLabel="Excluir" onClose={closeDialog} onBack={closeDialog} onConfirm={() => { void confirmDelete(); }}>
      {operations.state.errorMessage && <Feedback tone="danger" title="Não foi possível excluir" message={operations.state.errorMessage} />}
      <Feedback tone="danger" title="Confirme a exclusão" message={`O lançamento “${deleteTarget.description}” será excluído. Esta ação não pode ser desfeita.`} />
    </Dialog>
  </section>;
}
