import { useEffect, useMemo, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import type { FinancialEntryListItem } from '../domain/entries';
import type { InstallmentBalance } from '../domain/settlements';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { EmptyState, LoadingState } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Select } from '../../../shared/ui/Select';
import { getFinanceRepositories } from '../infrastructure/createFinanceRepositories';
import './finance.css';
import './monthly-accounts.css';

type AccountScope = 'all' | 'payable' | 'receivable' | 'paid';
type UnifiedEntry = FinancialEntryListItem & { companyId: string; companyLabel: string };
type UnifiedBalance = InstallmentBalance & { companyId: string };

interface Props {
  companies: readonly CompanySummary[];
  onSelectCompany: (companyId: string) => void;
}

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

export function AllCompaniesMonthlyAccountsPage({ companies, onSelectCompany }: Props) {
  const initialRange = useMemo(() => currentMonthRange(), []);
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [filter, setFilter] = useState<AccountScope>('all');
  const [search, setSearch] = useState('');
  const [entries, setEntries] = useState<readonly UnifiedEntry[]>([]);
  const [balances, setBalances] = useState<readonly UnifiedBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, [companies]);

  if (loading) return <LoadingState label="Carregando contas do mês…" />;
  if (error) return <EmptyState title="Contas do mês indisponíveis" message={error} />;

  const rangeStart = startDate <= endDate ? startDate : endDate;
  const rangeEnd = startDate <= endDate ? endDate : startDate;
  const balanceByInstallment = new Map(balances.map((item) => [`${item.companyId}:${item.installmentId}`, item]));
  const periodEntries = entries.filter((item) => item.dueDate >= rangeStart && item.dueDate <= rangeEnd);
  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
  const visibleEntries = periodEntries.filter((item) => {
    const balance = balanceByInstallment.get(`${item.companyId}:${item.installmentId}`);
    const paid = balance?.financialStatus === 'paid' || (balance?.remainingAmount ?? item.amount) <= 0;
    if (filter === 'payable' && (item.entryType !== 'expense' || paid)) return false;
    if (filter === 'receivable' && (item.entryType !== 'income' || paid)) return false;
    if (filter === 'paid' && !paid) return false;
    if (!normalizedSearch) return true;
    return [item.description, item.counterpartyName ?? '', item.notes ?? '', item.companyLabel].some((value) => value.toLocaleLowerCase('pt-BR').includes(normalizedSearch));
  });
  const totals = periodEntries.reduce((result, item) => {
    const balance = balanceByInstallment.get(`${item.companyId}:${item.installmentId}`);
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

  return <section className="finance-overview monthly-accounts monthly-accounts--all" aria-labelledby="monthly-accounts-all-title">
    <PageHeader id="monthly-accounts-all-title" title="Contas do mês" />

    <Card className="monthly-accounts__period monthly-accounts__period--compact">
      <div className="finance-form-grid"><Input label="Data inicial" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /><Input label="Data final" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></div>
      <div className="finance-actions"><Button size="sm" variant="secondary" onClick={() => { const current = currentMonthRange(); setStartDate(current.start); setEndDate(current.end); }}>Mês atual</Button></div>
    </Card>

    <div className="finance-overview__cards monthly-accounts__summary">
      <Card title="A pagar"><strong className="balance-card__value">{currency.format(totals.payable)}</strong></Card>
      <Card title="A receber"><strong className="balance-card__value">{currency.format(totals.receivable)}</strong></Card>
      <Card className="monthly-accounts__kpi--alert" title="Vencidas"><strong className="balance-card__value">{currency.format(totals.overdue)}</strong></Card>
      <Card title="Pagas"><strong className="balance-card__value">{currency.format(totals.paid)}</strong></Card>
    </div>

    <Card className="monthly-accounts__list-card" title="Contas">
      <div className="finance-form-grid"><Input label="Buscar" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Descrição, empresa ou fornecedor" /><Select label="Mostrar" value={filter} onChange={(event) => setFilter(event.target.value as AccountScope)} options={[{ value: 'all', label: 'Todas' }, { value: 'payable', label: 'A pagar' }, { value: 'receivable', label: 'A receber' }, { value: 'paid', label: 'Pagas / recebidas' }]} /></div>
      {visibleEntries.length === 0 ? <p className="ui-muted">Nenhuma conta encontrada para este filtro.</p> : <div className="finance-list monthly-accounts__list">
        {visibleEntries.map((item) => {
          const balance = balanceByInstallment.get(`${item.companyId}:${item.installmentId}`);
          const remaining = Math.max(0, balance?.remainingAmount ?? item.amount);
          const paid = balance?.financialStatus === 'paid' || remaining <= 0;
          const overdue = !paid && item.entryType === 'expense' && item.dueDate < today();
          return <div className={`finance-list__group monthly-account ${overdue ? 'monthly-account--overdue' : ''} ${paid ? 'monthly-account--paid' : ''}`} key={`${item.companyId}:${item.installmentId}`}>
            <div className="finance-list__row"><strong>{item.description}</strong><strong>{currency.format(item.amount)}</strong></div>
            <div className="finance-list__row"><span className="monthly-account__company">{item.companyLabel}</span><span>Vence {formatDate(item.dueDate)}</span></div>
            <div className="finance-list__row"><span>{item.entryType === 'income' ? 'A receber' : 'A pagar'}{overdue ? ' · Vencida' : ''}</span><span>{paid ? 'Baixada' : `Saldo ${currency.format(remaining)}`}</span></div>
            <div className="finance-actions"><Button size="sm" variant="secondary" onClick={() => onSelectCompany(item.companyId)}>Abrir empresa</Button></div>
          </div>;
        })}
      </div>}
    </Card>
  </section>;
}
