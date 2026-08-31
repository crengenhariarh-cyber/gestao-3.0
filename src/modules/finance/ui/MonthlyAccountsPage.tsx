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

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function today(): string { return new Date().toISOString().slice(0, 10); }
function formatDate(value: string): string { const [year, month, day] = value.split('-'); return `${day}/${month}/${year}`; }
function key(prefix: string): string { return `${prefix}:${crypto.randomUUID()}`; }

export function MonthlyAccountsPage({ company }: MonthlyAccountsPageProps) {
  const scope = useMemo(() => ({ tenantId: company.tenantId, companyId: company.id }), [company.id, company.tenantId]);
  const [refreshToken, setRefreshToken] = useState(0);
  const [filter, setFilter] = useState<AccountScope>('all');
  const [search, setSearch] = useState('');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ installmentId: '', accountId: '', settledOn: today(), amount: '', notes: '' });
  const overview = useFinanceOverview(scope, refreshToken);
  const operations = useFinanceOperations(scope);
  const references = operations.state.references;

  if (overview.status === 'idle' || overview.status === 'loading') return <LoadingState label="Carregando contas do mês…" />;
  if (overview.status === 'error') return <EmptyState title="Contas do mês indisponíveis" message={overview.errorMessage} />;
  if (!overview.data) return <LoadingState label="Carregando contas do mês…" />;

  const month = overview.data.month.slice(0, 7);
  const balanceByInstallment = new Map((references?.installmentBalances ?? []).map((item) => [item.installmentId, item]));
  const monthEntries = overview.data.entries.filter((item) => item.dueDate.slice(0, 7) === month);
  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
  const visibleEntries = monthEntries.filter((item) => {
    const balance = balanceByInstallment.get(item.installmentId);
    const paid = balance?.financialStatus === 'paid' || (balance?.remainingAmount ?? item.amount) <= 0;
    if (filter === 'payable' && (item.entryType !== 'expense' || paid)) return false;
    if (filter === 'receivable' && (item.entryType !== 'income' || paid)) return false;
    if (filter === 'paid' && !paid) return false;
    if (!normalizedSearch) return true;
    return [item.description, item.counterpartyName ?? '', item.notes ?? ''].some((value) => value.toLocaleLowerCase('pt-BR').includes(normalizedSearch));
  });

  const totals = monthEntries.reduce((result, item) => {
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
  const accountOptions = [{ value: '', label: 'Selecione…' }, ...activeAccounts.map((item) => ({ value: item.id, label: item.name }))];

  function openPayment(installmentId: string) {
    const entry = monthEntries.find((item) => item.installmentId === installmentId);
    const balance = balanceByInstallment.get(installmentId);
    setPaymentForm({ installmentId, accountId: '', settledOn: today(), amount: String(balance?.remainingAmount ?? entry?.amount ?? ''), notes: '' });
    operations.clearFeedback();
    setPaymentOpen(true);
  }

  async function savePayment() {
    try {
      await operations.settleInstallment({
        installmentId: paymentForm.installmentId,
        accountId: paymentForm.accountId,
        settledOn: paymentForm.settledOn,
        amount: Number(paymentForm.amount.replace(',', '.')),
        idempotencyKey: key('monthly-account'),
        notes: paymentForm.notes || null,
      });
      await operations.loadReferences();
      setRefreshToken((value) => value + 1);
      setPaymentOpen(false);
    } catch { /* feedback padronizado permanece no modal */ }
  }

  return <section className="finance-overview" aria-labelledby="monthly-accounts-title">
    <div className="finance-overview__heading">
      <div><span className="ui-muted">Competência {month.slice(5, 7)}/{month.slice(0, 4)}</span><h1 id="monthly-accounts-title">Contas do mês</h1></div>
      <p className="ui-muted">Visão operacional de contas a pagar, contas a receber e títulos já baixados.</p>
    </div>

    {operations.state.errorMessage && !paymentOpen && <Feedback tone="danger" title="Operação não concluída" message={operations.state.errorMessage} />}
    {operations.state.successMessage && !paymentOpen && <Feedback tone="success" title="Concluído" message={operations.state.successMessage} />}

    <div className="finance-overview__cards">
      <Card title="A pagar"><strong className="balance-card__value">{currency.format(totals.payable)}</strong></Card>
      <Card title="A receber"><strong className="balance-card__value">{currency.format(totals.receivable)}</strong></Card>
      <Card title="Vencidas"><strong className="balance-card__value">{currency.format(totals.overdue)}</strong></Card>
      <Card title="Pagas no mês"><strong className="balance-card__value">{currency.format(totals.paid)}</strong></Card>
    </div>

    <Card title="Contas" description="Pesquise e filtre sem sair da competência atual">
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
          const overdue = !paid && item.entryType === 'expense' && item.dueDate < today();
          return <div className="finance-list__group" key={item.installmentId}>
            <div className="finance-list__row"><strong>{item.description}</strong><strong>{currency.format(item.amount)}</strong></div>
            <div className="finance-list__row"><span>{item.installmentCount > 1 ? `Parcela ${item.installmentNumber}/${item.installmentCount}` : 'Parcela única'}</span><span>Vence {formatDate(item.dueDate)}</span></div>
            <div className="finance-list__row"><span>{item.entryType === 'income' ? 'A receber' : 'A pagar'}{overdue ? ' · Vencida' : ''}</span><span>{paid ? 'Baixada' : `Saldo ${currency.format(remaining)}`}</span></div>
            {item.counterpartyName && <div className="finance-list__row"><span>{item.counterpartyName}</span></div>}
            {!paid && <div className="finance-actions"><Button size="sm" onClick={() => openPayment(item.installmentId)}>{item.entryType === 'income' ? 'Receber' : 'Pagar'}</Button></div>}
          </div>;
        })}
      </div>}
    </Card>

    <Dialog open={paymentOpen} title="Pagamento ou recebimento" description="Baixa vinculada exclusivamente à empresa e à conta selecionadas." loading={operations.state.busy} confirmLabel="Salvar" onClose={() => setPaymentOpen(false)} onBack={() => setPaymentOpen(false)} onConfirm={() => { void savePayment(); }}>
      {operations.state.errorMessage && <Feedback tone="danger" title="Não foi possível salvar" message={operations.state.errorMessage} />}
      <div className="finance-form-grid">
        <Select label="Conta" value={paymentForm.accountId} onChange={(event) => setPaymentForm((current) => ({ ...current, accountId: event.target.value }))} options={accountOptions} required />
        <Input label="Data" type="date" value={paymentForm.settledOn} onChange={(event) => setPaymentForm((current) => ({ ...current, settledOn: event.target.value }))} required />
        <Input label="Valor" type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} required />
        <Input label="Observação" value={paymentForm.notes} onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))} />
      </div>
    </Dialog>
  </section>;
}
