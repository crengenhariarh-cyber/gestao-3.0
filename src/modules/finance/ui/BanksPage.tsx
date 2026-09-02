import { useEffect, useMemo, useState } from 'react';
import type { FinancialAccountMovement } from '../domain/accounts';
import type { FinancialEntryListItem } from '../domain/entries';
import type { FinancialAccountType, RegistryStatus } from '../domain/registries';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Dialog } from '../../../shared/ui/Dialog';
import { EmptyState, Feedback, LoadingState } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Select } from '../../../shared/ui/Select';
import { SortableHandle } from '../../../shared/ui/SortableHandle';
import { Tabs } from '../../../shared/ui/Tabs';
import { getFinanceRepositories } from '../infrastructure/createFinanceRepositories';
import { useFinanceOperations } from './useFinanceOperations';
import { useFinanceOverview } from './useFinanceOverview';
import './finance.css';
import './banks-page.css';
import '../../home/ui/bank-brand.css';

interface BanksPageProps { company: CompanySummary; showHeader?: boolean; }
type DialogKind = 'account' | 'accountDelete' | 'transfer' | 'plan' | 'extract' | null;
type ExtractTab = 'realized' | 'forecast';
type BankTone = 'itau' | 'nubank' | 'inter' | 'santander' | 'caixa' | 'sicoob' | 'bradesco' | 'bb' | 'sicredi' | 'c6' | 'generic';

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
function bankVisual(value: string | null, fallbackName: string): { tone: BankTone; mark: string; bank: string } {
  const raw = `${value ?? ''} ${fallbackName}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase('pt-BR');
  if (raw.includes('NUBANK')) return { tone: 'nubank', mark: 'nu', bank: 'Nubank' };
  if (raw.includes('ITAU')) return { tone: 'itau', mark: 'itaú', bank: 'Itaú' };
  if (raw.includes('INTER')) return { tone: 'inter', mark: 'inter', bank: 'Inter' };
  if (raw.includes('SANTANDER')) return { tone: 'santander', mark: 'Santander', bank: 'Santander' };
  if (raw.includes('CAIXA')) return { tone: 'caixa', mark: 'CAIXA', bank: 'Caixa' };
  if (raw.includes('SICOOB')) return { tone: 'sicoob', mark: 'SICOOB', bank: 'Sicoob' };
  if (raw.includes('BRADESCO')) return { tone: 'bradesco', mark: 'bradesco', bank: 'Bradesco' };
  if (raw.includes('BANCO DO BRASIL') || /(^|\s)BB(\s|$)/.test(raw)) return { tone: 'bb', mark: 'BB', bank: 'Banco do Brasil' };
  if (raw.includes('SICREDI')) return { tone: 'sicredi', mark: 'Sicredi', bank: 'Sicredi' };
  if (raw.includes('C6')) return { tone: 'c6', mark: 'C6', bank: 'C6 Bank' };
  return { tone: 'generic', mark: '', bank: 'Banco' };
}

export function BanksPage({ company, showHeader = true }: BanksPageProps) {
  const scope = useMemo(() => ({ tenantId: company.tenantId, companyId: company.id }), [company.id, company.tenantId]);
  const repositories = useMemo(() => getFinanceRepositories(), []);
  const initialRange = useMemo(() => monthRange(), []);
  const [refreshToken, setRefreshToken] = useState(0);
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [menuAccountId, setMenuAccountId] = useState<string | null>(null);
  const [extractTab, setExtractTab] = useState<ExtractTab>('realized');
  const [movements, setMovements] = useState<readonly FinancialAccountMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(true);
  const [movementsError, setMovementsError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [accountForm, setAccountForm] = useState({ id: '', name: '', accountType: 'bank' as FinancialAccountType, openingBalance: '0', status: 'active' as RegistryStatus });
  const [transferForm, setTransferForm] = useState({ fromAccountId: '', toAccountId: '', transferOn: today(), amount: '', notes: '' });
  const [planForm, setPlanForm] = useState({ entryId: '', plannedAccountId: '' });
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

  useEffect(() => {
    const refreshOrder = () => setRefreshToken((value) => value + 1);
    window.addEventListener('finance-bank-order-changed', refreshOrder);
    return () => window.removeEventListener('finance-bank-order-changed', refreshOrder);
  }, []);

  if (overview.status === 'idle' || overview.status === 'loading') return <LoadingState label="Carregando bancos…" />;
  if (overview.status === 'error') return <EmptyState title="Bancos indisponíveis" message={overview.errorMessage} />;
  if (!overview.data) return <LoadingState label="Carregando bancos…" />;

  const data = overview.data;
  const activeBalances = data.accountBalances.filter((item) => item.status === 'active').sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const activeAccounts = (references?.accounts ?? []).filter((item) => item.status === 'active');
  const selectedBalance = activeBalances.find((item) => item.accountId === selectedAccountId) ?? null;
  const effectiveAccountId = selectedBalance?.accountId ?? '';
  const balanceByInstallment = new Map((references?.installmentBalances ?? []).map((item) => [item.installmentId, item]));
  const openEntries = data.entries.filter((item) => {
    const balance = balanceByInstallment.get(item.installmentId);
    return (balance?.remainingAmount ?? item.amount) > 0 && balance?.financialStatus !== 'paid';
  });
  const accountMovements = movements.filter((item) => item.accountId === effectiveAccountId).sort((a, b) => `${b.movementOn}:${b.id}`.localeCompare(`${a.movementOn}:${a.id}`));
  const projectedItems = openEntries.filter((item) => item.plannedAccountId === effectiveAccountId).map((item) => ({ item, remaining: Math.max(0, balanceByInstallment.get(item.installmentId)?.remainingAmount ?? item.amount) })).sort((a, b) => `${a.item.dueDate}:${a.item.installmentId}`.localeCompare(`${b.item.dueDate}:${b.item.installmentId}`));
  const projectedByAccount = new Map(activeBalances.map((account) => [account.accountId, { inflow: 0, outflow: 0 }]));
  openEntries.forEach((item) => {
    if (!item.plannedAccountId) return;
    const target = projectedByAccount.get(item.plannedAccountId);
    if (!target) return;
    const remaining = Math.max(0, balanceByInstallment.get(item.installmentId)?.remainingAmount ?? item.amount);
    if (item.entryType === 'income') target.inflow += remaining;
    else target.outflow += remaining;
  });
  const selectedProjection = projectedByAccount.get(effectiveAccountId) ?? { inflow: 0, outflow: 0 };
  const selectedExpected = (selectedBalance?.currentBalance ?? 0) + selectedProjection.inflow - selectedProjection.outflow;
  const periodInflow = accountMovements.filter((item) => item.direction === 'inflow').reduce((sum, item) => sum + item.amount, 0);
  const periodOutflow = accountMovements.filter((item) => item.direction === 'outflow').reduce((sum, item) => sum + item.amount, 0);
  const accountOptions = [{ value: '', label: 'Selecione…' }, ...activeAccounts.map((item) => ({ value: item.id, label: item.name }))];
  const plannedAccountOptions = [{ value: '', label: 'Sem conta prevista' }, ...activeAccounts.map((item) => ({ value: item.id, label: item.name }))];
  const uniqueOpenEntries = Array.from(new Map(openEntries.map((item) => [item.entryId, item])).values());
  const entryOptions = [{ value: '', label: 'Selecione…' }, ...uniqueOpenEntries.map((item) => ({ value: item.entryId, label: `${item.description} · ${item.entryType === 'income' ? 'Receber' : 'Pagar'}` }))];

  function closeDialog() { setDialog(null); operations.clearFeedback(); }
  function openExtract(accountId: string) { setMenuAccountId(null); setSelectedAccountId(accountId); setExtractTab('realized'); operations.clearFeedback(); setDialog('extract'); }
  function openNewAccount() { setMenuAccountId(null); setAccountForm({ id: '', name: '', accountType: 'bank', openingBalance: '0', status: 'active' }); operations.clearFeedback(); setDialog('account'); }
  function openEditAccount(accountId: string) {
    setMenuAccountId(null);
    const account = (references?.accounts ?? []).find((item) => item.id === accountId);
    if (!account) return;
    setAccountForm({ id: account.id, name: account.name, accountType: account.accountType, openingBalance: String(account.openingBalance), status: account.status });
    operations.clearFeedback();
    setDialog('account');
  }
  function openDeleteAccount(accountId: string) { setMenuAccountId(null); setSelectedAccountId(accountId); operations.clearFeedback(); setDialog('accountDelete'); }
  function openTransfer(accountId = effectiveAccountId) { setMenuAccountId(null); setTransferForm({ fromAccountId: accountId, toAccountId: '', transferOn: today(), amount: '', notes: '' }); operations.clearFeedback(); setDialog('transfer'); }
  function openPlan(item?: FinancialEntryListItem) { setPlanForm({ entryId: item?.entryId ?? '', plannedAccountId: item?.plannedAccountId ?? effectiveAccountId }); operations.clearFeedback(); setDialog('plan'); }
  async function reorderAccounts(orderedIds: readonly string[]) {
    try {
      setOrderError(null);
      await repositories.accounts.reorder(scope.tenantId, orderedIds);
      window.dispatchEvent(new Event('finance-bank-order-changed'));
    } catch {
      setOrderError('Não foi possível salvar a nova ordem das contas.');
    }
  }
  async function refreshAll() { await operations.loadReferences(); setRefreshToken((value) => value + 1); closeDialog(); }
  async function saveAccount() {
    try {
      if (accountForm.id) await operations.updateAccount({ id: accountForm.id, name: accountForm.name, accountType: accountForm.accountType, status: accountForm.status });
      else await operations.createAccount({ name: accountForm.name, accountType: accountForm.accountType, openingBalance: money(accountForm.openingBalance) });
      await refreshAll();
    } catch { /* feedback padronizado permanece no modal */ }
  }
  async function deleteAccount() {
    const account = (references?.accounts ?? []).find((item) => item.id === selectedAccountId);
    if (!account) return;
    try {
      await operations.updateAccount({ id: account.id, name: account.name, accountType: account.accountType, status: 'inactive' });
      setSelectedAccountId('');
      await refreshAll();
    } catch { /* feedback padronizado permanece no modal */ }
  }
  async function saveTransfer() {
    try {
      await operations.transfer({ fromAccountId: transferForm.fromAccountId, toAccountId: transferForm.toAccountId, transferOn: transferForm.transferOn, amount: money(transferForm.amount), idempotencyKey: key('bank-transfer'), notes: transferForm.notes || null });
      await refreshAll();
    } catch { /* feedback padronizado permanece no modal */ }
  }
  async function savePlan() {
    try {
      await operations.setEntryPlannedAccount(planForm.entryId, planForm.plannedAccountId || null);
      await refreshAll();
    } catch { /* feedback padronizado permanece no modal */ }
  }

  return <section className={`finance-overview banks-page${showHeader ? '' : ' banks-page--embedded'}`} aria-label={`Bancos ${company.tradeName ?? company.legalName}`}>
    {showHeader && <PageHeader id="banks-title" title="Bancos" actions={<div className="banks-page__top-actions"><Button onClick={openNewAccount}>Novo banco</Button><Button onClick={() => openTransfer('')}>Nova transferência</Button></div>} />}
    {orderError && <Feedback tone="danger" title="Ordem não salva" message={orderError} />}
    {operations.state.errorMessage && dialog === null && <Feedback tone="danger" title="Operação não concluída" message={operations.state.errorMessage} />}
    {operations.state.successMessage && dialog === null && <Feedback tone="success" title="Concluído" message={operations.state.successMessage} />}

    {activeBalances.length === 0 ? null : <div className="banks-page__accounts">
      {activeBalances.map((item) => {
        const brand = bankVisual(item.bankInstitution, item.name);
        return <div key={item.accountId} className={`banks-page__account-wrap bank-brand bank-brand--${brand.tone}`} data-sort-group="bank-account" data-sort-tenant={scope.tenantId} data-sort-id={item.accountId}>
          <SortableHandle itemId={item.accountId} tenantId={scope.tenantId} group="bank-account" label={`Arrastar ${item.name} para reorganizar`} onReorder={reorderAccounts} />
          <Button variant="tertiary" className="banks-page__menu-trigger" aria-label={`Ações de ${item.name}`} aria-expanded={menuAccountId===item.accountId} onClick={()=>setMenuAccountId(menuAccountId===item.accountId?null:item.accountId)}>⋯</Button>
          {menuAccountId===item.accountId&&<div className="banks-page__menu" role="menu"><Button variant="tertiary" onClick={()=>openEditAccount(item.accountId)}>Editar</Button><Button variant="tertiary" className="is-danger" onClick={()=>openDeleteAccount(item.accountId)}>Excluir</Button></div>}
          <Button variant="tertiary" className="banks-page__account-card" onClick={() => openExtract(item.accountId)} aria-label={`Abrir extrato de ${item.name}, ${brand.bank}, saldo ${currency.format(item.currentBalance)}`}>
            {brand.mark && <span className="bank-brand__mark" aria-hidden="true">{brand.mark}</span>}
            <span className="banks-page__account-copy"><strong>{item.name}</strong><small>{brand.bank}</small></span>
            <strong className="banks-page__account-balance">{currency.format(item.currentBalance)}</strong>
            <small className="banks-page__account-hint">Toque para abrir o extrato ›</small>
          </Button>
        </div>;
      })}
    </div>}

    <Dialog open={dialog === 'extract'} title={selectedBalance ? selectedBalance.name : 'Extrato'} description={selectedBalance ? `Saldo ${currency.format(selectedBalance.currentBalance)}` : undefined} onClose={closeDialog} onBack={closeDialog}>
      {selectedBalance && <div className="banks-page__extract">
        <div className="banks-page__extract-balance"><span>Saldo atual</span><strong>{currency.format(selectedBalance.currentBalance)}</strong></div>
        <Tabs items={[{ id: 'realized', label: 'Extrato' }, { id: 'forecast', label: 'Previsto' }]} activeId={extractTab} onChange={(id) => setExtractTab(id as ExtractTab)} ariaLabel="Tipo de extrato" />
        {extractTab === 'realized' ? <>
          <div className="finance-form-grid"><Input label="Data inicial" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /><Input label="Data final" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></div>
          <div className="finance-actions"><Button size="sm" onClick={() => { const current = monthRange(); setStartDate(current.start); setEndDate(current.end); }}>Mês atual</Button><Button size="sm" onClick={() => openTransfer(selectedBalance.accountId)}>Nova transferência</Button><Button size="sm" onClick={() => openEditAccount(selectedBalance.accountId)}>Editar banco</Button></div>
          <div className="banks-page__extract-totals"><Card title="Entradas"><strong>{currency.format(periodInflow)}</strong></Card><Card title="Saídas"><strong>{currency.format(periodOutflow)}</strong></Card></div>
          {movementsError && <Feedback tone="danger" title="Extrato indisponível" message={movementsError} />}
          {movementsLoading ? <LoadingState label="Carregando extrato…" /> : accountMovements.length === 0 ? <p className="ui-muted">Nenhuma movimentação neste período.</p> : <div className="finance-list">{accountMovements.map((item) => <div className="finance-list__group" key={item.id}><div className="finance-list__row"><strong>{item.description || 'Movimentação'}</strong><strong>{item.direction === 'inflow' ? '+' : '-'} {currency.format(item.amount)}</strong></div><div className="finance-list__row"><span>{formatDate(item.movementOn)}</span><span>{item.direction === 'inflow' ? 'Entrada' : 'Saída'}</span></div></div>)}</div>}
        </> : <>
          <div className="banks-page__extract-totals"><Card title="A receber"><strong>{currency.format(selectedProjection.inflow)}</strong></Card><Card title="A pagar"><strong>{currency.format(selectedProjection.outflow)}</strong></Card><Card title="Saldo previsto"><strong>{currency.format(selectedExpected)}</strong></Card></div>
          <div className="finance-actions"><Button size="sm" onClick={() => openPlan()}>Planejar conta</Button></div>
          {projectedItems.length === 0 ? <p className="ui-muted">Nenhum título aberto está planejado para esta conta.</p> : <div className="finance-list">{projectedItems.map(({ item, remaining }) => <div className="finance-list__group" key={item.installmentId}><div className="finance-list__row"><strong>{item.description}</strong><strong>{item.entryType === 'income' ? '+' : '-'} {currency.format(remaining)}</strong></div><div className="finance-list__row"><span>{item.installmentCount > 1 ? `Parcela ${item.installmentNumber}/${item.installmentCount}` : 'Parcela única'}</span><span>{formatDate(item.dueDate)}</span></div><div className="finance-actions"><Button size="sm" onClick={() => openPlan(item)}>Alterar conta prevista</Button></div></div>)}</div>}
        </>}
      </div>}
    </Dialog>

    <Dialog open={dialog === 'account'} title={accountForm.id ? 'Editar banco' : 'Novo banco'} loading={operations.state.busy} confirmLabel="Salvar" onClose={closeDialog} onBack={closeDialog} onConfirm={() => { void saveAccount(); }}>
      {operations.state.errorMessage && <Feedback tone="danger" title="Não foi possível salvar" message={operations.state.errorMessage} />}
      <div className="finance-form-grid"><Input label="Nome da conta" value={accountForm.name} onChange={(event) => setAccountForm((current) => ({ ...current, name: event.target.value }))} required /><Select label="Tipo" value={accountForm.accountType} onChange={(event) => setAccountForm((current) => ({ ...current, accountType: event.target.value as FinancialAccountType }))} options={[{ value: 'bank', label: 'Banco' }, { value: 'cash', label: 'Dinheiro' }, { value: 'other', label: 'Outra conta' }]} />{!accountForm.id && <Input label="Saldo inicial" type="number" step="0.01" value={accountForm.openingBalance} onChange={(event) => setAccountForm((current) => ({ ...current, openingBalance: event.target.value }))} />}{accountForm.id && <Select label="Status" value={accountForm.status} onChange={(event) => setAccountForm((current) => ({ ...current, status: event.target.value as RegistryStatus }))} options={[{ value: 'active', label: 'Ativa' }, { value: 'inactive', label: 'Inativa' }]} />}</div>
    </Dialog>

    <Dialog open={dialog === 'accountDelete'} title="Excluir banco" loading={operations.state.busy} onClose={closeDialog} onBack={closeDialog} footer={<><Button variant="secondary" onClick={closeDialog}>Cancelar</Button><Button variant="danger" onClick={()=>{void deleteAccount();}}>Excluir banco</Button></>}>
      {operations.state.errorMessage && <Feedback tone="danger" title="Não foi possível excluir" message={operations.state.errorMessage} />}
      <p>O banco será desativado para preservar o extrato e o histórico financeiro já registrado.</p>
    </Dialog>

    <Dialog open={dialog === 'transfer'} title="Nova transferência" loading={operations.state.busy} confirmLabel="Transferir" onClose={closeDialog} onBack={closeDialog} onConfirm={() => { void saveTransfer(); }}>
      {operations.state.errorMessage && <Feedback tone="danger" title="Não foi possível transferir" message={operations.state.errorMessage} />}
      <div className="finance-form-grid"><Select label="Conta de origem" value={transferForm.fromAccountId} onChange={(event) => setTransferForm((current) => ({ ...current, fromAccountId: event.target.value }))} options={accountOptions} required /><Select label="Conta de destino" value={transferForm.toAccountId} onChange={(event) => setTransferForm((current) => ({ ...current, toAccountId: event.target.value }))} options={accountOptions} required /><Input label="Data" type="date" value={transferForm.transferOn} onChange={(event) => setTransferForm((current) => ({ ...current, transferOn: event.target.value }))} required /><Input label="Valor" type="number" min="0.01" step="0.01" value={transferForm.amount} onChange={(event) => setTransferForm((current) => ({ ...current, amount: event.target.value }))} required /><Input label="Observação" value={transferForm.notes} onChange={(event) => setTransferForm((current) => ({ ...current, notes: event.target.value }))} /></div>
    </Dialog>

    <Dialog open={dialog === 'plan'} title="Planejar conta do título" loading={operations.state.busy} confirmLabel="Salvar" onClose={closeDialog} onBack={closeDialog} onConfirm={() => { void savePlan(); }}>
      {operations.state.errorMessage && <Feedback tone="danger" title="Não foi possível salvar" message={operations.state.errorMessage} />}
      <div className="finance-form-grid"><Select label="Lançamento" value={planForm.entryId} onChange={(event) => { const entry = uniqueOpenEntries.find((item) => item.entryId === event.target.value); setPlanForm({ entryId: event.target.value, plannedAccountId: entry?.plannedAccountId ?? effectiveAccountId }); }} options={entryOptions} required /><Select label="Conta prevista" value={planForm.plannedAccountId} onChange={(event) => setPlanForm((current) => ({ ...current, plannedAccountId: event.target.value }))} options={plannedAccountOptions} /></div>
    </Dialog>
  </section>;
}
