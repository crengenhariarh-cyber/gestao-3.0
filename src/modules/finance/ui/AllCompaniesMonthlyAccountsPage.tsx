import { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, CalendarDays, CheckCircle2, ChevronRight, List, Search } from 'lucide-react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import type { FinancialEntryListItem } from '../domain/entries';
import type { InstallmentBalance } from '../domain/settlements';
import { Button } from '../../../shared/ui/Button';
import { EmptyState, LoadingState } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { getFinanceRepositories } from '../infrastructure/createFinanceRepositories';
import { MonthlyAccountActionDialog } from './MonthlyAccountActionDialog';
import './finance.css';
import './monthly-accounts.css';

type AccountScope = 'all' | 'payable' | 'receivable' | 'overdue' | 'paid';
type UnifiedEntry = FinancialEntryListItem & { companyId: string; companyLabel: string };
type UnifiedBalance = InstallmentBalance & { companyId: string };

interface Props { companies: readonly CompanySummary[]; }

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
function companyName(company: CompanySummary): string {
  const raw = `${company.tradeName ?? ''} ${company.legalName}`.toLocaleUpperCase('pt-BR');
  if (raw.includes('PESSOAL')) return 'Pessoal';
  if (raw.includes('PR')) return 'PR';
  if (raw.includes('CR')) return 'CR';
  if (raw.includes('BLAZE')) return 'Blaze';
  if (raw.includes('ADMIN')) return 'Admin';
  if (raw.includes('SARTORI')) return 'Sartori';
  return company.tradeName ?? company.legalName;
}

export function AllCompaniesMonthlyAccountsPage({ companies }: Props) {
  const initialRange = useMemo(() => currentMonthRange(), []);
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [filter, setFilter] = useState<AccountScope>('all');
  const [search, setSearch] = useState('');
  const [entries, setEntries] = useState<readonly UnifiedEntry[]>([]);
  const [balances, setBalances] = useState<readonly UnifiedBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [selectedEntry, setSelectedEntry] = useState<UnifiedEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const repositories = getFinanceRepositories();
    void Promise.all(companies.map(async (company) => {
      const scope = { tenantId: company.tenantId, companyId: company.id };
      const [companyEntries, companyBalances] = await Promise.all([
        repositories.entries.list(scope),
        repositories.settlements.listBalances(scope),
      ]);
      return {
        entries: companyEntries.map((entry) => ({ ...entry, companyId: company.id, companyLabel: companyName(company) })),
        balances: companyBalances.map((balance) => ({ ...balance, companyId: company.id })),
      };
    })).then((rows) => {
      if (cancelled) return;
      setEntries(rows.flatMap((row) => row.entries));
      setBalances(rows.flatMap((row) => row.balances));
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setError('Não foi possível carregar as contas de todas as empresas.');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [companies, refreshToken]);

  if (loading) return <LoadingState label="Carregando contas do mês…" />;
  if (error) return <EmptyState title="Contas do mês indisponíveis" message={error} />;

  const rangeStart = startDate <= endDate ? startDate : endDate;
  const rangeEnd = startDate <= endDate ? endDate : startDate;
  const balanceByInstallment = new Map(balances.map((item) => [`${item.companyId}:${item.installmentId}`, item]));
  const periodEntries = entries.filter((item) => item.dueDate >= rangeStart && item.dueDate <= rangeEnd);
  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
  const visibleEntries = periodEntries.filter((item) => {
    const balance = balanceByInstallment.get(`${item.companyId}:${item.installmentId}`);
    const remaining = Math.max(0, balance?.remainingAmount ?? item.amount);
    const paid = balance?.financialStatus === 'paid' || remaining <= 0;
    const overdue = !paid && item.entryType === 'expense' && item.dueDate < today();
    if (filter === 'payable' && (item.entryType !== 'expense' || paid)) return false;
    if (filter === 'receivable' && (item.entryType !== 'income' || paid)) return false;
    if (filter === 'overdue' && !overdue) return false;
    if (filter === 'paid' && !paid) return false;
    if (!normalizedSearch) return true;
    return [item.description, item.counterpartyName ?? '', item.notes ?? '', item.companyLabel].some((value) => value.toLocaleLowerCase('pt-BR').includes(normalizedSearch));
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const totals = periodEntries.reduce((result, item) => {
    const balance = balanceByInstallment.get(`${item.companyId}:${item.installmentId}`);
    const remaining = Math.max(0, balance?.remainingAmount ?? item.amount);
    const paid = balance?.financialStatus === 'paid' || remaining <= 0;
    if (paid) { result.paid += item.amount; result.paidCount += 1; }
    else if (item.entryType === 'income') { result.receivable += remaining; result.receivableCount += 1; }
    else {
      result.payable += remaining; result.payableCount += 1;
      if (item.dueDate < today()) { result.overdue += remaining; result.overdueCount += 1; }
    }
    return result;
  }, { payable: 0, receivable: 0, overdue: 0, paid: 0, payableCount: 0, receivableCount: 0, overdueCount: 0, paidCount: 0 });

  const setCurrentMonth = () => { const current = currentMonthRange(); setStartDate(current.start); setEndDate(current.end); };
  const selectedCompany = selectedEntry ? companies.find((company) => company.id === selectedEntry.companyId) : undefined;
  const selectedBalance = selectedEntry ? balanceByInstallment.get(`${selectedEntry.companyId}:${selectedEntry.installmentId}`) : undefined;

  return <section className="finance-overview monthly-accounts monthly-accounts--all" aria-labelledby="monthly-accounts-all-title">
    <div className="monthly-accounts__title-row"><PageHeader id="monthly-accounts-all-title" title="Contas do mês" /><Button size="sm" variant="secondary" className="monthly-accounts__month-button" onClick={setCurrentMonth}><CalendarDays aria-hidden="true" /> <span>Mês atual</span></Button></div>

    <div className="monthly-accounts__period monthly-accounts__period--app"><Input label="De" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /><Input label="Até" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /><Button className="monthly-accounts__period-search" aria-label="Aplicar período"><Search aria-hidden="true" /></Button></div>

    <div className="monthly-accounts__summary monthly-accounts__summary--app">
      <Button variant="tertiary" className="monthly-kpi monthly-kpi--payable" onClick={() => setFilter('payable')}><span className="monthly-kpi__icon"><ArrowUpRight aria-hidden="true" /></span><span><small>A pagar</small><strong>{currency.format(totals.payable)}</strong><em>{totals.payableCount} títulos</em></span></Button>
      <Button variant="tertiary" className="monthly-kpi monthly-kpi--receivable" onClick={() => setFilter('receivable')}><span className="monthly-kpi__icon"><ArrowDownLeft aria-hidden="true" /></span><span><small>A receber</small><strong>{currency.format(totals.receivable)}</strong><em>{totals.receivableCount} títulos</em></span></Button>
      <Button variant="tertiary" className="monthly-kpi monthly-kpi--overdue" onClick={() => setFilter('overdue')}><span className="monthly-kpi__icon"><CalendarDays aria-hidden="true" /></span><span><small>Vencidas</small><strong>{currency.format(totals.overdue)}</strong><em>{totals.overdueCount} títulos</em></span></Button>
      <Button variant="tertiary" className="monthly-kpi monthly-kpi--paid" onClick={() => setFilter('paid')}><span className="monthly-kpi__icon"><CheckCircle2 aria-hidden="true" /></span><span><small>Baixadas</small><strong>{currency.format(totals.paid)}</strong><em>{totals.paidCount} títulos</em></span></Button>
    </div>

    <div className="monthly-accounts__tabs" role="group" aria-label="Filtrar contas"><Button size="sm" variant="tertiary" className={`monthly-tab ${filter === 'all' ? 'is-selected' : ''}`} onClick={() => setFilter('all')}><List aria-hidden="true" />Todas</Button><Button size="sm" variant="tertiary" className={`monthly-tab monthly-tab--payable ${filter === 'payable' ? 'is-selected' : ''}`} onClick={() => setFilter('payable')}><ArrowUpRight aria-hidden="true" />A pagar</Button><Button size="sm" variant="tertiary" className={`monthly-tab monthly-tab--receivable ${filter === 'receivable' ? 'is-selected' : ''}`} onClick={() => setFilter('receivable')}><ArrowDownLeft aria-hidden="true" />A receber</Button><Button size="sm" variant="tertiary" className={`monthly-tab monthly-tab--overdue ${filter === 'overdue' ? 'is-selected' : ''}`} onClick={() => setFilter('overdue')}><CalendarDays aria-hidden="true" />Vencidas</Button></div>

    <div className="monthly-accounts__search-row"><Input label="Buscar" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por descrição, fornecedor..." /><Button size="sm" variant="secondary" className="monthly-accounts__filters-button" onClick={() => setFilter('all')}><span>Filtros</span><span className="monthly-accounts__filter-count">{filter === 'all' ? 0 : 1}</span></Button></div>

    {visibleEntries.length === 0 ? <div className="monthly-accounts__empty">Nenhuma conta encontrada para este filtro.</div> : <div className="monthly-accounts__app-list">{visibleEntries.map((item) => {
      const balance = balanceByInstallment.get(`${item.companyId}:${item.installmentId}`);
      const remaining = Math.max(0, balance?.remainingAmount ?? item.amount);
      const paid = balance?.financialStatus === 'paid' || remaining <= 0;
      const overdue = !paid && item.entryType === 'expense' && item.dueDate < today();
      const income = item.entryType === 'income';
      return <Button variant="tertiary" className={`monthly-entry ${income ? 'monthly-entry--income' : 'monthly-entry--expense'} ${overdue ? 'monthly-entry--overdue' : ''} ${paid ? 'monthly-entry--paid' : ''}`} key={`${item.companyId}:${item.installmentId}`} onClick={() => setSelectedEntry(item)}><span className="monthly-entry__icon">{income ? <ArrowDownLeft aria-hidden="true" /> : <ArrowUpRight aria-hidden="true" />}</span><span className="monthly-entry__main"><strong>{item.description}</strong><small>{item.counterpartyName || (item.installmentCount > 1 ? `Parcela ${item.installmentNumber}/${item.installmentCount}` : 'Parcela única')}</small></span><span className="monthly-account__company">{item.companyLabel}</span><span className="monthly-entry__amount"><small>{formatDate(item.dueDate)}</small><strong>{currency.format(paid ? item.amount : remaining)}</strong></span><ChevronRight className="monthly-entry__chevron" aria-hidden="true" /></Button>;
    })}</div>}

    {selectedEntry && selectedCompany && <MonthlyAccountActionDialog company={selectedCompany} entry={selectedEntry} {...(selectedBalance ? { balance: selectedBalance } : {})} open onClose={() => setSelectedEntry(null)} onChanged={() => { setSelectedEntry(null); setRefreshToken((value) => value + 1); }} />}
  </section>;
}
