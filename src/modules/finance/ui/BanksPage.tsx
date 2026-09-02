import { useEffect, useMemo, useState } from 'react';
import type { FinancialAccountMovement } from '../domain/accounts';
import type { FinancialEntryListItem } from '../domain/entries';
import type { FinancialAccountType, FinancialBankInstitution, RegistryStatus } from '../domain/registries';
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
import './statement-view.css';
import '../../home/ui/bank-brand.css';

interface BanksPageProps { company: CompanySummary; companies?: readonly CompanySummary[]; showHeader?: boolean; }
type DialogKind = 'account' | 'accountDelete' | 'transfer' | 'plan' | 'extract' | 'movementEdit' | 'movementDelete' | null;
type ExtractTab = 'realized' | 'forecast';
type MovementFilter = 'all' | 'inflow' | 'outflow';
type BankTone = 'itau' | 'nubank' | 'inter' | 'santander' | 'caixa' | 'sicoob' | 'bradesco' | 'bb' | 'sicredi' | 'c6' | 'generic';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const bankInstitutionOptions = [
  { value: '', label: 'Selecione…' },
  { value: 'itau', label: 'Itaú' }, { value: 'nubank', label: 'Nubank' }, { value: 'inter', label: 'Inter' },
  { value: 'santander', label: 'Santander' }, { value: 'caixa', label: 'Caixa' }, { value: 'sicoob', label: 'Sicoob' },
  { value: 'bradesco', label: 'Bradesco' }, { value: 'bb', label: 'Banco do Brasil' }, { value: 'sicredi', label: 'Sicredi' }, { value: 'c6', label: 'C6 Bank' },
];
function companyName(company: CompanySummary): string { return company.tradeName ?? company.legalName; }
function today(): string { return new Date().toISOString().slice(0, 10); }
function monthKey(date = new Date()): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; }
function monthRange(value = monthKey()) { const parts = value.split('-'); const year = Number(parts[0] ?? 0); const month = Number(parts[1] ?? 1); const last = new Date(year, month, 0).getDate(); return { start: `${value}-01`, end: `${value}-${String(last).padStart(2, '0')}` }; }
function monthLabel(value: string): string { const parts = value.split('-'); return `${parts[1] ?? ''}/${parts[0] ?? ''}`; }
function shiftMonth(value: string, delta: number): string { const parts = value.split('-'); const year = Number(parts[0] ?? 0); const month = Number(parts[1] ?? 1); return monthKey(new Date(year, month - 1 + delta, 1)); }
function formatDate(value: string): string { const [year, month, day] = value.split('-'); return `${day}/${month}/${year}`; }
function money(value: string): number { return Number(value.replace(',', '.')); }
function key(prefix: string): string { return `${prefix}:${crypto.randomUUID()}`; }
function csvCell(value: string | number): string { return `"${String(value).replaceAll('"', '""')}"`; }
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

export function BanksPage({ company, companies = [company], showHeader = true }: BanksPageProps) {
  const availableCompanies = useMemo(() => [...new Map(companies.map((item) => [item.id, item])).values()], [companies]);
  const scope = useMemo(() => ({ tenantId: company.tenantId, companyId: company.id }), [company.id, company.tenantId]);
  const repositories = useMemo(() => getFinanceRepositories(), []);
  const [refreshToken, setRefreshToken] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(monthKey());
  const selectedRange = useMemo(() => monthRange(selectedMonth), [selectedMonth]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [menuAccountId, setMenuAccountId] = useState<string | null>(null);
  const [extractTab, setExtractTab] = useState<ExtractTab>('realized');
  const [movementFilter, setMovementFilter] = useState<MovementFilter>('all');
  const [movements, setMovements] = useState<readonly FinancialAccountMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(true);
  const [movementsError, setMovementsError] = useState<string | null>(null);
  const [selectedMovement, setSelectedMovement] = useState<FinancialAccountMovement | null>(null);
  const [movementForm, setMovementForm] = useState({ date: '', description: '', amount: '' });
  const [orderError, setOrderError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [accountForm, setAccountForm] = useState({ id: '', companyId: company.id, sourceCompanyId: company.id, name: '', accountType: 'bank' as FinancialAccountType, bankInstitution: '' as FinancialBankInstitution | '', openingBalance: '0', status: 'active' as RegistryStatus });
  const [transferForm, setTransferForm] = useState({ fromAccountId: '', toAccountId: '', transferOn: today(), amount: '', notes: '' });
  const [planForm, setPlanForm] = useState({ entryId: '', plannedAccountId: '' });
  const overview = useFinanceOverview(scope, refreshToken);
  const operations = useFinanceOperations(scope);
  const references = operations.state.references;

  useEffect(() => {
    let cancelled = false;
    setMovementsLoading(true); setMovementsError(null);
    void repositories.accounts.listMovements(scope, selectedRange.start, selectedRange.end)
      .then((items) => { if (!cancelled) setMovements(items); })
      .catch(() => { if (!cancelled) setMovementsError('Não foi possível carregar o extrato deste período.'); })
      .finally(() => { if (!cancelled) setMovementsLoading(false); });
    return () => { cancelled = true; };
  }, [repositories.accounts, refreshToken, scope, selectedRange.end, selectedRange.start]);

  useEffect(() => { const refreshOrder = () => setRefreshToken((value) => value + 1); window.addEventListener('finance-bank-order-changed', refreshOrder); return () => window.removeEventListener('finance-bank-order-changed', refreshOrder); }, []);

  if (overview.status === 'idle' || overview.status === 'loading') return <LoadingState label="Carregando bancos…" />;
  if (overview.status === 'error') return <EmptyState title="Bancos indisponíveis" message={overview.errorMessage} />;
  if (!overview.data) return <LoadingState label="Carregando bancos…" />;

  const data = overview.data;
  const activeBalances = data.accountBalances.filter((item) => item.status === 'active').sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const activeAccounts = (references?.accounts ?? []).filter((item) => item.status === 'active');
  const selectedBalance = activeBalances.find((item) => item.accountId === selectedAccountId) ?? null;
  const effectiveAccountId = selectedBalance?.accountId ?? '';
  const accountMovements = movements.filter((item) => item.accountId === effectiveAccountId).sort((a, b) => `${b.movementOn}:${b.id}`.localeCompare(`${a.movementOn}:${a.id}`));
  const filteredMovements = accountMovements.filter((item) => movementFilter === 'all' || item.direction === movementFilter);
  const periodInflow = accountMovements.filter((item) => item.direction === 'inflow').reduce((sum, item) => sum + item.amount, 0);
  const periodOutflow = accountMovements.filter((item) => item.direction === 'outflow').reduce((sum, item) => sum + item.amount, 0);
  const balanceByInstallment = new Map((references?.installmentBalances ?? []).map((item) => [item.installmentId, item]));
  const openEntries = data.entries.filter((item) => { const balance = balanceByInstallment.get(item.installmentId); return (balance?.remainingAmount ?? item.amount) > 0 && balance?.financialStatus !== 'paid'; });
  const projectedItems = openEntries.filter((item) => item.plannedAccountId === effectiveAccountId).map((item) => ({ item, remaining: Math.max(0, balanceByInstallment.get(item.installmentId)?.remainingAmount ?? item.amount) })).sort((a, b) => `${a.item.dueDate}:${a.item.installmentId}`.localeCompare(`${b.item.dueDate}:${b.item.installmentId}`));
  const projectedByAccount = new Map(activeBalances.map((account) => [account.accountId, { inflow: 0, outflow: 0 }]));
  openEntries.forEach((item) => { if (!item.plannedAccountId) return; const target = projectedByAccount.get(item.plannedAccountId); if (!target) return; const remaining = Math.max(0, balanceByInstallment.get(item.installmentId)?.remainingAmount ?? item.amount); if (item.entryType === 'income') target.inflow += remaining; else target.outflow += remaining; });
  const selectedProjection = projectedByAccount.get(effectiveAccountId) ?? { inflow: 0, outflow: 0 };
  const selectedExpected = (selectedBalance?.currentBalance ?? 0) + selectedProjection.inflow - selectedProjection.outflow;
  const accountOptions = [{ value: '', label: 'Selecione…' }, ...activeAccounts.map((item) => ({ value: item.id, label: item.name }))];
  const plannedAccountOptions = [{ value: '', label: 'Sem conta prevista' }, ...activeAccounts.map((item) => ({ value: item.id, label: item.name }))];
  const companyOptions = availableCompanies.map((item) => ({ value: item.id, label: companyName(item) }));
  const uniqueOpenEntries = Array.from(new Map(openEntries.map((item) => [item.entryId, item])).values());
  const entryOptions = [{ value: '', label: 'Selecione…' }, ...uniqueOpenEntries.map((item) => ({ value: item.entryId, label: `${item.description} · ${item.entryType === 'income' ? 'Receber' : 'Pagar'}` }))];
  const monthOptions = Array.from({ length: 36 }, (_, index) => { const value = shiftMonth(monthKey(), -index); return { value, label: monthLabel(value) }; });

  function closeDialog() { setDialog(null); setSelectedMovement(null); operations.clearFeedback(); }
  function openExtract(accountId: string) { setMenuAccountId(null); setSelectedAccountId(accountId); setExtractTab('realized'); setMovementFilter('all'); setSelectedMonth(monthKey()); operations.clearFeedback(); setDialog('extract'); }
  function openNewAccount() { setMenuAccountId(null); setAccountForm({ id: '', companyId: company.id, sourceCompanyId: company.id, name: '', accountType: 'bank', bankInstitution: '', openingBalance: '0', status: 'active' }); operations.clearFeedback(); setDialog('account'); }
  function openEditAccount(accountId: string) { const account = (references?.accounts ?? []).find((item) => item.id === accountId); if (!account) return; setMenuAccountId(null); setAccountForm({ id: account.id, companyId: account.companyId, sourceCompanyId: account.companyId, name: account.name, accountType: account.accountType, bankInstitution: account.bankInstitution ?? '', openingBalance: String(account.openingBalance), status: account.status }); operations.clearFeedback(); setDialog('account'); }
  function openDeleteAccount(accountId: string) { setMenuAccountId(null); setSelectedAccountId(accountId); operations.clearFeedback(); setDialog('accountDelete'); }
  function openTransfer(accountId = effectiveAccountId) { setMenuAccountId(null); setTransferForm({ fromAccountId: accountId, toAccountId: '', transferOn: today(), amount: '', notes: '' }); operations.clearFeedback(); setDialog('transfer'); }
  function openPlan(item?: FinancialEntryListItem) { setPlanForm({ entryId: item?.entryId ?? '', plannedAccountId: item?.plannedAccountId ?? effectiveAccountId }); operations.clearFeedback(); setDialog('plan'); }
  function openMovementEdit(item: FinancialAccountMovement) { setSelectedMovement(item); setMovementForm({ date: item.movementOn, description: item.description ?? '', amount: String(item.amount) }); setDialog('movementEdit'); }
  function openMovementDelete(item: FinancialAccountMovement) { setSelectedMovement(item); setDialog('movementDelete'); }

  async function reorderAccounts(orderedIds: readonly string[]) { try { setOrderError(null); await repositories.accounts.reorder(scope.tenantId, orderedIds); window.dispatchEvent(new Event('finance-bank-order-changed')); } catch { setOrderError('Não foi possível salvar a nova ordem das contas.'); } }
  async function refreshAll() { await operations.loadReferences(); setRefreshToken((value) => value + 1); closeDialog(); }
  async function saveAccount() { const targetCompany = availableCompanies.find((item) => item.id === accountForm.companyId); if (!targetCompany) return; try { if (accountForm.id) await repositories.registries.updateAccount({ tenantId: targetCompany.tenantId, companyId: targetCompany.id, sourceCompanyId: accountForm.sourceCompanyId, id: accountForm.id, name: accountForm.name, accountType: accountForm.accountType, bankInstitution: accountForm.bankInstitution || null, status: accountForm.status }); else await repositories.registries.createAccount({ tenantId: targetCompany.tenantId, companyId: targetCompany.id, name: accountForm.name, accountType: accountForm.accountType, bankInstitution: accountForm.bankInstitution || null, openingBalance: money(accountForm.openingBalance) }); window.dispatchEvent(new Event('finance-bank-order-changed')); await refreshAll(); } catch { /* feedback no modal */ } }
  async function deleteAccount() { const account = (references?.accounts ?? []).find((item) => item.id === selectedAccountId); if (!account) return; try { await operations.updateAccount({ id: account.id, name: account.name, accountType: account.accountType, bankInstitution: account.bankInstitution, status: 'inactive' }); setSelectedAccountId(''); await refreshAll(); } catch { /* feedback no modal */ } }
  async function saveTransfer() { try { await operations.transfer({ fromAccountId: transferForm.fromAccountId, toAccountId: transferForm.toAccountId, transferOn: transferForm.transferOn, amount: money(transferForm.amount), idempotencyKey: key('bank-transfer'), notes: transferForm.notes || null }); await refreshAll(); } catch { /* feedback no modal */ } }
  async function savePlan() { try { await operations.setEntryPlannedAccount(planForm.entryId, planForm.plannedAccountId || null); await refreshAll(); } catch { /* feedback no modal */ } }
  async function saveMovement() { if (!selectedMovement) return; try { await repositories.accounts.updateMovement({ tenantId: selectedMovement.tenantId, companyId: selectedMovement.companyId, movementId: selectedMovement.id, movementOn: movementForm.date, amount: money(movementForm.amount), description: movementForm.description || null }); setSelectedMovement(null); setDialog('extract'); setRefreshToken((value) => value + 1); } catch { setMovementsError('Não foi possível editar esta movimentação.'); } }
  async function deleteMovement() { if (!selectedMovement) return; try { await repositories.accounts.deleteMovement({ tenantId: selectedMovement.tenantId, companyId: selectedMovement.companyId, movementId: selectedMovement.id }); setSelectedMovement(null); setDialog('extract'); setRefreshToken((value) => value + 1); } catch { setMovementsError('Não foi possível excluir esta movimentação.'); } }
  function exportCsv() { if (!selectedBalance) return; const rows = [['Data','Descrição','Tipo','Valor'], ...filteredMovements.map((item) => [formatDate(item.movementOn), item.description ?? 'Movimentação', item.direction === 'inflow' ? 'Entrada' : 'Saída', (item.direction === 'inflow' ? item.amount : -item.amount).toFixed(2)])]; const csv = '\ufeff' + rows.map((row) => row.map(csvCell).join(';')).join('\n'); const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `extrato-${selectedBalance.name}-${selectedMonth}.csv`; anchor.click(); URL.revokeObjectURL(url); }

  return <section className={`finance-overview banks-page${showHeader ? '' : ' banks-page--embedded'}`} aria-label={`Bancos ${company.tradeName ?? company.legalName}`}>
    {showHeader && <PageHeader id="banks-title" title="Bancos" actions={<div className="banks-page__top-actions"><Button onClick={openNewAccount}>Novo banco</Button><Button onClick={() => openTransfer('')}>Nova transferência</Button></div>} />}
    {orderError && <Feedback tone="danger" title="Ordem não salva" message={orderError} />}
    {activeBalances.length > 0 && <div className="banks-page__accounts">{activeBalances.map((item) => { const brand = bankVisual(item.bankInstitution, item.name); return <div key={item.accountId} className={`banks-page__account-wrap bank-brand bank-brand--${brand.tone}`} data-sort-group="bank-account" data-sort-tenant={scope.tenantId} data-sort-id={item.accountId}><SortableHandle itemId={item.accountId} tenantId={scope.tenantId} group="bank-account" label={`Arrastar ${item.name} para reorganizar`} onReorder={reorderAccounts} /><Button variant="tertiary" className="banks-page__menu-trigger" aria-label={`Ações de ${item.name}`} onClick={() => setMenuAccountId(menuAccountId === item.accountId ? null : item.accountId)}>⋯</Button>{menuAccountId === item.accountId && <div className="banks-page__menu"><Button variant="tertiary" onClick={() => openEditAccount(item.accountId)}>Editar</Button><Button variant="tertiary" className="is-danger" onClick={() => openDeleteAccount(item.accountId)}>Excluir</Button></div>}<Button variant="tertiary" className="banks-page__account-card" onClick={() => openExtract(item.accountId)}>{brand.mark && <span className="bank-brand__mark">{brand.mark}</span>}<span className="banks-page__account-copy"><strong>{item.name}</strong><small>{brand.bank}</small><small>{companyName(company)}</small></span><strong className="banks-page__account-balance">{currency.format(item.currentBalance)}</strong><small className="banks-page__account-hint">Toque para abrir o extrato ›</small></Button></div>; })}</div>}

    <Dialog open={dialog === 'extract'} title={selectedBalance ? selectedBalance.name : 'Extrato'} description={selectedBalance ? companyName(company) : undefined} onClose={closeDialog} onBack={closeDialog}>{selectedBalance && <div className="statement-view statement-print-surface"><div className="statement-view__hero"><div><strong>{selectedBalance.name}</strong><span>{bankVisual(selectedBalance.bankInstitution, selectedBalance.name).bank}</span><span>{companyName(company)}</span></div><div><small>Saldo atual</small><strong>{currency.format(selectedBalance.currentBalance)}</strong></div><div><small>Entradas no mês</small><strong className="statement-view__positive">{currency.format(periodInflow)}</strong></div><div><small>Saídas no mês</small><strong className="statement-view__negative">{currency.format(periodOutflow)}</strong></div></div><Tabs items={[{ id: 'realized', label: 'Extrato' }, { id: 'forecast', label: 'Previsto' }]} activeId={extractTab} onChange={(id) => setExtractTab(id as ExtractTab)} ariaLabel="Tipo de extrato" />{extractTab === 'realized' ? <><div className="statement-view__period"><Button variant="secondary" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}>‹</Button><Select label="Período" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} options={monthOptions} /><Button variant="secondary" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))} disabled={selectedMonth >= monthKey()}>›</Button></div><div className="statement-view__filters"><Button variant={movementFilter === 'all' ? 'primary' : 'secondary'} size="sm" onClick={() => setMovementFilter('all')}>Todas {accountMovements.length}</Button><Button variant={movementFilter === 'inflow' ? 'primary' : 'secondary'} size="sm" onClick={() => setMovementFilter('inflow')}>Entradas {accountMovements.filter((x) => x.direction === 'inflow').length}</Button><Button variant={movementFilter === 'outflow' ? 'primary' : 'secondary'} size="sm" onClick={() => setMovementFilter('outflow')}>Saídas {accountMovements.filter((x) => x.direction === 'outflow').length}</Button></div>{movementsError && <Feedback tone="danger" title="Extrato" message={movementsError} />}{movementsLoading ? <LoadingState label="Carregando extrato…" /> : filteredMovements.length === 0 ? <EmptyState title="Nenhuma movimentação" message="Não há movimentações neste período." /> : <div className="statement-view__list">{filteredMovements.map((item) => <div key={item.id} className="statement-view__row"><div className={`statement-view__icon statement-view__icon--${item.direction}`}>{item.direction === 'inflow' ? '↑' : '↓'}</div><div className="statement-view__copy"><strong>{item.description || 'Movimentação'}</strong><span>{formatDate(item.movementOn)} · {item.direction === 'inflow' ? 'Entrada' : 'Saída'}</span></div><strong className={item.direction === 'inflow' ? 'statement-view__positive' : 'statement-view__negative'}>{item.direction === 'inflow' ? '+' : '-'} {currency.format(item.amount)}</strong><div className="statement-view__actions"><Button variant="tertiary" size="sm" aria-label="Editar movimentação" onClick={() => openMovementEdit(item)}>✎</Button><Button variant="tertiary" size="sm" className="is-danger" aria-label="Excluir movimentação" onClick={() => openMovementDelete(item)}>⌫</Button></div></div>)}</div>}<div className="statement-view__footer-actions"><Button variant="secondary" onClick={exportCsv}>Baixar extrato (Excel)</Button><Button onClick={() => window.print()}>Imprimir</Button></div></> : <><div className="statement-view__totals"><Card title="A receber"><strong>{currency.format(selectedProjection.inflow)}</strong></Card><Card title="A pagar"><strong>{currency.format(selectedProjection.outflow)}</strong></Card><Card title="Saldo previsto"><strong>{currency.format(selectedExpected)}</strong></Card></div><div className="finance-actions"><Button size="sm" onClick={() => openPlan()}>Planejar conta</Button></div>{projectedItems.length === 0 ? <p className="ui-muted">Nenhum título aberto está planejado para esta conta.</p> : <div className="finance-list">{projectedItems.map(({ item, remaining }) => <div className="finance-list__group" key={item.installmentId}><div className="finance-list__row"><strong>{item.description}</strong><strong>{item.entryType === 'income' ? '+' : '-'} {currency.format(remaining)}</strong></div><div className="finance-list__row"><span>{item.installmentCount > 1 ? `Parcela ${item.installmentNumber}/${item.installmentCount}` : 'Parcela única'}</span><span>{formatDate(item.dueDate)}</span></div><div className="finance-actions"><Button size="sm" onClick={() => openPlan(item)}>Alterar conta prevista</Button></div></div>)}</div>}</>}</div>}</Dialog>

    <Dialog open={dialog === 'movementEdit' && selectedMovement !== null} title="Editar movimentação" onClose={() => setDialog('extract')} onBack={() => setDialog('extract')} footer={<><Button variant="secondary" onClick={() => setDialog('extract')}>Cancelar</Button><Button onClick={() => { void saveMovement(); }}>Salvar</Button></>}><div className="finance-form-grid"><Input label="Data" type="date" value={movementForm.date} onChange={(event) => setMovementForm((current) => ({ ...current, date: event.target.value }))} required /><Input label="Descrição" value={movementForm.description} onChange={(event) => setMovementForm((current) => ({ ...current, description: event.target.value }))} /><Input label="Valor" type="number" min="0.01" step="0.01" value={movementForm.amount} onChange={(event) => setMovementForm((current) => ({ ...current, amount: event.target.value }))} required /></div></Dialog>
    <Dialog open={dialog === 'movementDelete' && selectedMovement !== null} title="Excluir movimentação" onClose={() => setDialog('extract')} onBack={() => setDialog('extract')} footer={<><Button variant="secondary" onClick={() => setDialog('extract')}>Cancelar</Button><Button variant="danger" onClick={() => { void deleteMovement(); }}>Excluir</Button></>}><p>A exclusão será refletida no saldo da conta e no lançamento financeiro relacionado.</p></Dialog>

    <Dialog open={dialog === 'account'} title={accountForm.id ? 'Editar banco' : 'Novo banco'} description="Selecione a empresa responsável por esta conta." loading={operations.state.busy} confirmLabel="Salvar" onClose={closeDialog} onBack={closeDialog} onConfirm={() => { void saveAccount(); }}><div className="finance-form-grid"><Select label="Empresa" value={accountForm.companyId} onChange={(event) => setAccountForm((current) => ({ ...current, companyId: event.target.value }))} options={companyOptions} required /><Input label="Nome da conta" value={accountForm.name} onChange={(event) => setAccountForm((current) => ({ ...current, name: event.target.value }))} required /><Select label="Instituição" value={accountForm.bankInstitution} onChange={(event) => setAccountForm((current) => ({ ...current, bankInstitution: event.target.value as FinancialBankInstitution | '' }))} options={bankInstitutionOptions} required /><Select label="Tipo" value={accountForm.accountType} onChange={(event) => setAccountForm((current) => ({ ...current, accountType: event.target.value as FinancialAccountType }))} options={[{ value: 'bank', label: 'Banco' }, { value: 'cash', label: 'Dinheiro' }, { value: 'other', label: 'Outra conta' }]} /><Select label="Status" value={accountForm.status} disabled={!accountForm.id} onChange={(event) => setAccountForm((current) => ({ ...current, status: event.target.value as RegistryStatus }))} options={[{ value: 'active', label: 'Ativa' }, { value: 'inactive', label: 'Inativa' }]} />{!accountForm.id && <Input label="Saldo inicial da conta" type="number" step="0.01" value={accountForm.openingBalance} onChange={(event) => setAccountForm((current) => ({ ...current, openingBalance: event.target.value }))} />}</div></Dialog>
    <Dialog open={dialog === 'accountDelete'} title="Excluir banco" loading={operations.state.busy} onClose={closeDialog} onBack={closeDialog} footer={<><Button variant="secondary" onClick={closeDialog}>Cancelar</Button><Button variant="danger" onClick={() => { void deleteAccount(); }}>Excluir banco</Button></>}><p>O banco será desativado para preservar o extrato e o histórico financeiro.</p></Dialog>
    <Dialog open={dialog === 'transfer'} title="Nova transferência" loading={operations.state.busy} confirmLabel="Transferir" onClose={closeDialog} onBack={closeDialog} onConfirm={() => { void saveTransfer(); }}><div className="finance-form-grid"><Select label="Conta de origem" value={transferForm.fromAccountId} onChange={(event) => setTransferForm((current) => ({ ...current, fromAccountId: event.target.value }))} options={accountOptions} required /><Select label="Conta de destino" value={transferForm.toAccountId} onChange={(event) => setTransferForm((current) => ({ ...current, toAccountId: event.target.value }))} options={accountOptions} required /><Input label="Data" type="date" value={transferForm.transferOn} onChange={(event) => setTransferForm((current) => ({ ...current, transferOn: event.target.value }))} required /><Input label="Valor" type="number" min="0.01" step="0.01" value={transferForm.amount} onChange={(event) => setTransferForm((current) => ({ ...current, amount: event.target.value }))} required /><Input label="Observação" value={transferForm.notes} onChange={(event) => setTransferForm((current) => ({ ...current, notes: event.target.value }))} /></div></Dialog>
    <Dialog open={dialog === 'plan'} title="Planejar conta do título" loading={operations.state.busy} confirmLabel="Salvar" onClose={closeDialog} onBack={closeDialog} onConfirm={() => { void savePlan(); }}><div className="finance-form-grid"><Select label="Lançamento" value={planForm.entryId} onChange={(event) => { const entry = uniqueOpenEntries.find((item) => item.entryId === event.target.value); setPlanForm({ entryId: event.target.value, plannedAccountId: entry?.plannedAccountId ?? effectiveAccountId }); }} options={entryOptions} required /><Select label="Conta prevista" value={planForm.plannedAccountId} onChange={(event) => setPlanForm((current) => ({ ...current, plannedAccountId: event.target.value }))} options={plannedAccountOptions} /></div></Dialog>
  </section>;
}
