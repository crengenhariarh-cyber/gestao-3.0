import { useEffect, useMemo, useState } from 'react';
import type { FinancialAccountMovement } from '../domain/accounts';
import type { FinancialAccountType, RegistryStatus } from '../domain/registries';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Dialog } from '../../../shared/ui/Dialog';
import { EmptyState, Feedback, LoadingState } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';
import { getFinanceRepositories } from '../infrastructure/createFinanceRepositories';
import { useFinanceOperations } from './useFinanceOperations';
import { useFinanceOverview } from './useFinanceOverview';
import './finance.css';

interface BanksPageProps { company: CompanySummary; }
type DialogKind = 'account' | 'transfer' | null;

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function today(): string { return new Date().toISOString().slice(0, 10); }
function monthRange() {
  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const mm = String(month).padStart(2, '0');
  const last = new Date(year, month, 0).getDate();
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(last).padStart(2, '0')}` };
}
function formatDate(value: string): string { const [year, month, day] = value.split('-'); return `${day}/${month}/${year}`; }
function money(value: string): number { return Number(value.replace(',', '.')); }
function key(prefix: string): string { return `${prefix}:${crypto.randomUUID()}`; }

export function BanksPage({ company }: BanksPageProps) {
  const scope = useMemo(() => ({ tenantId: company.tenantId, companyId: company.id }), [company.id, company.tenantId]);
  const repositories = useMemo(() => getFinanceRepositories(), []);
  const initialRange = useMemo(() => monthRange(), []);
  const [refreshToken, setRefreshToken] = useState(0);
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [movements, setMovements] = useState<readonly FinancialAccountMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(true);
  const [movementsError, setMovementsError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [accountForm, setAccountForm] = useState({ id: '', name: '', accountType: 'bank' as FinancialAccountType, openingBalance: '0', status: 'active' as RegistryStatus });
  const [transferForm, setTransferForm] = useState({ fromAccountId: '', toAccountId: '', transferOn: today(), amount: '', notes: '' });
  const overview = useFinanceOverview(scope, refreshToken);
  const operations = useFinanceOperations(scope);
  const references = operations.state.references;
  const rangeStart = startDate <= endDate ? startDate : endDate;
  const rangeEnd = startDate <= endDate ? endDate : startDate;

  useEffect(() => {
    let cancelled = false;
    setMovementsLoading(true);
    setMovementsError(null);
    void repositories.accounts.listMovements(scope, rangeStart, rangeEnd)
      .then((items) => { if (!cancelled) setMovements(items); })
      .catch(() => { if (!cancelled) setMovementsError('Não foi possível carregar o extrato deste período.'); })
      .finally(() => { if (!cancelled) setMovementsLoading(false); });
    return () => { cancelled = true; };
  }, [repositories, rangeEnd, rangeStart, refreshToken, scope]);

  if (overview.status === 'idle' || overview.status === 'loading') return <LoadingState label="Carregando bancos…" />;
  if (overview.status === 'error') return <EmptyState title="Bancos indisponíveis" message={overview.errorMessage} />;
  if (!overview.data) return <LoadingState label="Carregando bancos…" />;

  const activeBalances = overview.data.accountBalances.filter((item) => item.status === 'active');
  const activeAccounts = (references?.accounts ?? []).filter((item) => item.status === 'active');
  const selectedBalance = activeBalances.find((item) => item.accountId === selectedAccountId) ?? activeBalances[0];
  const effectiveAccountId = selectedBalance?.accountId ?? '';
  const accountMovements = movements
    .filter((item) => item.accountId === effectiveAccountId)
    .sort((a, b) => `${b.movementOn}:${b.id}`.localeCompare(`${a.movementOn}:${a.id}`));
  const totalCurrent = activeBalances.reduce((sum, item) => sum + item.currentBalance, 0);
  const dashboardCurrent = activeBalances.filter((item) => item.includeInDashboard).reduce((sum, item) => sum + item.currentBalance, 0);
  const periodInflow = accountMovements.filter((item) => item.direction === 'inflow').reduce((sum, item) => sum + item.amount, 0);
  const periodOutflow = accountMovements.filter((item) => item.direction === 'outflow').reduce((sum, item) => sum + item.amount, 0);
  const accountOptions = [{ value: '', label: 'Selecione…' }, ...activeAccounts.map((item) => ({ value: item.id, label: item.name }))];

  function closeDialog() {
    setDialog(null);
    operations.clearFeedback();
  }

  function openNewAccount() {
    setAccountForm({ id: '', name: '', accountType: 'bank', openingBalance: '0', status: 'active' });
    operations.clearFeedback();
    setDialog('account');
  }

  function openEditAccount(accountId: string) {
    const account = (references?.accounts ?? []).find((item) => item.id === accountId);
    if (!account) return;
    setAccountForm({ id: account.id, name: account.name, accountType: account.accountType, openingBalance: String(account.openingBalance), status: account.status });
    operations.clearFeedback();
    setDialog('account');
  }

  function openTransfer() {
    setTransferForm({ fromAccountId: effectiveAccountId, toAccountId: '', transferOn: today(), amount: '', notes: '' });
    operations.clearFeedback();
    setDialog('transfer');
  }

  async function refreshAll() {
    await operations.loadReferences();
    setRefreshToken((value) => value + 1);
    closeDialog();
  }

  async function saveAccount() {
    try {
      if (accountForm.id) {
        await operations.updateAccount({ id: accountForm.id, name: accountForm.name, accountType: accountForm.accountType, status: accountForm.status });
      } else {
        await operations.createAccount({ name: accountForm.name, accountType: accountForm.accountType, openingBalance: money(accountForm.openingBalance) });
      }
      await refreshAll();
    } catch { /* feedback padronizado permanece no modal */ }
  }

  async function saveTransfer() {
    try {
      await operations.transfer({
        fromAccountId: transferForm.fromAccountId,
        toAccountId: transferForm.toAccountId,
        transferOn: transferForm.transferOn,
        amount: money(transferForm.amount),
        idempotencyKey: key('bank-transfer'),
        notes: transferForm.notes || null,
      });
      await refreshAll();
    } catch { /* feedback padronizado permanece no modal */ }
  }

  return <section className="finance-overview" aria-labelledby="banks-title">
    <div className="finance-overview__heading">
      <div><span className="ui-muted">Saldos, extratos e transferências</span><h1 id="banks-title">Bancos</h1></div>
      <div className="finance-actions"><Button onClick={openNewAccount}>Novo banco</Button><Button variant="secondary" onClick={openTransfer} disabled={activeAccounts.length < 2}>Nova transferência</Button></div>
    </div>

    {operations.state.errorMessage && dialog === null && <Feedback tone="danger" title="Operação não concluída" message={operations.state.errorMessage} />}
    {operations.state.successMessage && dialog === null && <Feedback tone="success" title="Concluído" message={operations.state.successMessage} />}

    <div className="finance-overview__cards">
      <Card title="Saldo atual total"><strong className="balance-card__value">{currency.format(totalCurrent)}</strong></Card>
      <Card title="Saldo no dashboard"><strong className="balance-card__value">{currency.format(dashboardCurrent)}</strong></Card>
    </div>

    <Card title="Contas" description="Selecione uma conta para abrir o extrato">
      {activeBalances.length === 0 ? <p className="ui-muted">Nenhuma conta ativa cadastrada.</p> : <div className="finance-list">
        {activeBalances.map((item) => <div className="finance-list__group" key={item.accountId}>
          <button type="button" className="finance-list__row finance-list__row--button" onClick={() => setSelectedAccountId(item.accountId)} aria-pressed={effectiveAccountId === item.accountId}>
            <span><strong>{item.name}</strong><small>{item.accountType === 'bank' ? 'Banco' : item.accountType === 'cash' ? 'Dinheiro' : 'Outra conta'}</small></span>
            <strong>{currency.format(item.currentBalance)}</strong>
          </button>
          <div className="finance-list__row"><span>Saldo inicial {currency.format(item.openingBalance)}</span><span>Movimentos {currency.format(item.movementTotal)}</span></div>
          <div className="finance-actions"><Button size="sm" variant="secondary" onClick={() => setSelectedAccountId(item.accountId)}>Extrato</Button><Button size="sm" variant="tertiary" onClick={() => openEditAccount(item.accountId)}>Editar</Button></div>
        </div>)}
      </div>}
    </Card>

    {selectedBalance && <Card title={`Extrato · ${selectedBalance.name}`} description={`Movimentações de ${formatDate(rangeStart)} a ${formatDate(rangeEnd)}`}>
      <div className="finance-form-grid">
        <Input label="Data inicial" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        <Input label="Data final" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
      </div>
      <div className="finance-actions"><Button size="sm" variant="secondary" onClick={() => { const current = monthRange(); setStartDate(current.start); setEndDate(current.end); }}>Mês atual</Button><Button size="sm" onClick={openTransfer}>Transferir desta conta</Button></div>
      <div className="finance-overview__cards">
        <Card title="Entradas no período"><strong className="balance-card__value">{currency.format(periodInflow)}</strong></Card>
        <Card title="Saídas no período"><strong className="balance-card__value">{currency.format(periodOutflow)}</strong></Card>
      </div>
      {movementsError && <Feedback tone="danger" title="Extrato indisponível" message={movementsError} />}
      {movementsLoading ? <LoadingState label="Carregando extrato…" /> : accountMovements.length === 0 ? <p className="ui-muted">Nenhuma movimentação neste período.</p> : <div className="finance-list">
        {accountMovements.map((item) => <div className="finance-list__group" key={item.id}>
          <div className="finance-list__row"><strong>{item.description || 'Movimentação'}</strong><strong>{item.direction === 'inflow' ? '+' : '-'} {currency.format(item.amount)}</strong></div>
          <div className="finance-list__row"><span>{formatDate(item.movementOn)}</span><span>{item.direction === 'inflow' ? 'Entrada' : 'Saída'}</span></div>
        </div>)}
      </div>}
    </Card>}

    <Dialog open={dialog === 'account'} title={accountForm.id ? 'Editar conta' : 'Novo banco'} description="Cadastro financeiro isolado pela empresa selecionada." loading={operations.state.busy} confirmLabel="Salvar" onClose={closeDialog} onBack={closeDialog} onConfirm={() => { void saveAccount(); }}>
      {operations.state.errorMessage && <Feedback tone="danger" title="Não foi possível salvar" message={operations.state.errorMessage} />}
      <div className="finance-form-grid">
        <Input label="Nome da conta" value={accountForm.name} onChange={(event) => setAccountForm((current) => ({ ...current, name: event.target.value }))} required />
        <Select label="Tipo" value={accountForm.accountType} onChange={(event) => setAccountForm((current) => ({ ...current, accountType: event.target.value as FinancialAccountType }))} options={[{ value: 'bank', label: 'Banco' }, { value: 'cash', label: 'Dinheiro' }, { value: 'other', label: 'Outra conta' }]} />
        {!accountForm.id && <Input label="Saldo inicial" type="number" step="0.01" value={accountForm.openingBalance} onChange={(event) => setAccountForm((current) => ({ ...current, openingBalance: event.target.value }))} />}
        {accountForm.id && <Select label="Status" value={accountForm.status} onChange={(event) => setAccountForm((current) => ({ ...current, status: event.target.value as RegistryStatus }))} options={[{ value: 'active', label: 'Ativa' }, { value: 'inactive', label: 'Inativa' }]} />}
      </div>
    </Dialog>

    <Dialog open={dialog === 'transfer'} title="Nova transferência" description="A transferência gera a saída e a entrada nas duas contas da mesma empresa." loading={operations.state.busy} confirmLabel="Transferir" onClose={closeDialog} onBack={closeDialog} onConfirm={() => { void saveTransfer(); }}>
      {operations.state.errorMessage && <Feedback tone="danger" title="Não foi possível transferir" message={operations.state.errorMessage} />}
      <div className="finance-form-grid">
        <Select label="Conta de origem" value={transferForm.fromAccountId} onChange={(event) => setTransferForm((current) => ({ ...current, fromAccountId: event.target.value }))} options={accountOptions} required />
        <Select label="Conta de destino" value={transferForm.toAccountId} onChange={(event) => setTransferForm((current) => ({ ...current, toAccountId: event.target.value }))} options={accountOptions} required />
        <Input label="Data" type="date" value={transferForm.transferOn} onChange={(event) => setTransferForm((current) => ({ ...current, transferOn: event.target.value }))} required />
        <Input label="Valor" type="number" min="0.01" step="0.01" value={transferForm.amount} onChange={(event) => setTransferForm((current) => ({ ...current, amount: event.target.value }))} required />
        <Input label="Observação" value={transferForm.notes} onChange={(event) => setTransferForm((current) => ({ ...current, notes: event.target.value }))} />
      </div>
    </Dialog>
  </section>;
}
