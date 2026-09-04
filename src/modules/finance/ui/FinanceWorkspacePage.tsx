import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import { FinancePage } from './FinancePage';
import { useFinanceOperations } from './useFinanceOperations';
import { useFinanceOverview } from './useFinanceOverview';
import './finance-workspace.css';

interface FinanceWorkspacePageProps {
  companies: readonly CompanySummary[];
  initialCompanyId?: string;
}

type WorkspaceTab = 'resumo' | 'lancamentos' | 'contas';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function companyLabel(company: CompanySummary): string {
  const raw = `${company.tradeName ?? ''} ${company.legalName}`.toLocaleUpperCase('pt-BR');
  if (raw.includes('PESSOAL')) return 'Pessoal';
  if (raw.includes('PR-HIST') || /(^|\s)PR(\s|$)/.test(raw)) return 'PR';
  if (raw.includes('CR-HIST') || /(^|\s)CR(\s|$)/.test(raw)) return 'CR';
  return company.tradeName ?? company.legalName;
}

function companySubtitle(company: CompanySummary): string {
  const label = companyLabel(company);
  if (label === 'CR') return 'Engenharia';
  if (label === 'PR') return 'Instalações';
  if (label === 'Pessoal') return 'Uso pessoal';
  return company.tradeName ?? company.legalName;
}

function monthLabel(monthStart: string): string {
  const [year = '', month = ''] = monthStart.split('-');
  return `${month}/${year}`;
}

function longMonthLabel(monthStart: string): string {
  const [year = 0, month = 1] = monthStart.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, (value) => value.toUpperCase());
}

function Icon({ name }: { name: 'company' | 'person' | 'summary' | 'list' | 'bank' | 'balance' | 'calendar' | 'income' | 'expense' | 'late' | 'plus' | 'transfer' | 'document' | 'card' }) {
  const common = { viewBox: '0 0 24 24', 'aria-hidden': true } as const;
  if (name === 'person') return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>;
  if (name === 'summary') return <svg {...common}><path d="M4 20V10M9 20V4M14 20v-7M19 20V7"/><path d="M2 20h20"/></svg>;
  if (name === 'list') return <svg {...common}><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>;
  if (name === 'bank') return <svg {...common}><path d="M3 9h18M5 9v8M9.5 9v8M14.5 9v8M19 9v8M3 19h18M12 3l9 4H3z"/></svg>;
  if (name === 'balance') return <svg {...common}><path d="M4 5v7h7"/><path d="M4 12l5-5 4 4 7-7"/></svg>;
  if (name === 'calendar') return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h2M14 14h2M8 18h2M14 18h2"/></svg>;
  if (name === 'income') return <svg {...common}><path d="M5 19 19 5M10 5h9v9"/></svg>;
  if (name === 'expense') return <svg {...common}><path d="M12 3v18M5 14l7 7 7-7"/></svg>;
  if (name === 'late') return <svg {...common}><circle cx="12" cy="13" r="8"/><path d="M12 9v5l3 2M8 3h8M5 5 3 7M19 5l2 2"/></svg>;
  if (name === 'plus') return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10"/></svg>;
  if (name === 'transfer') return <svg {...common}><path d="M5 7h14l-4-4M19 17H5l4 4"/></svg>;
  if (name === 'document') return <svg {...common}><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/></svg>;
  if (name === 'card') return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></svg>;
  return <svg {...common}><path d="M5 21V7h6v14M13 21V3h6v18M3 21h18"/><path d="M7 10h2M7 14h2M15 7h2M15 11h2M15 15h2"/></svg>;
}

export function FinanceWorkspacePage({ companies, initialCompanyId }: FinanceWorkspacePageProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const financeCompanies = useMemo(() => companies.filter((company) => ['CR', 'PR', 'Pessoal'].includes(companyLabel(company))), [companies]);
  const fallback = financeCompanies.find((company) => companyLabel(company) === 'CR') ?? financeCompanies[0] ?? companies[0];
  const initial = companies.find((company) => company.id === initialCompanyId) ?? fallback;
  const [selectedCompanyId, setSelectedCompanyId] = useState(initial?.id ?? '');

  useEffect(() => {
    if (initialCompanyId && companies.some((company) => company.id === initialCompanyId)) setSelectedCompanyId(initialCompanyId);
  }, [companies, initialCompanyId]);

  const selectedCompany = companies.find((company) => company.id === selectedCompanyId) ?? fallback;
  const requestedTab = searchParams.get('tab');
  const activeTab: WorkspaceTab = requestedTab === 'lancamentos' || requestedTab === 'contas' ? requestedTab : 'resumo';
  const scope = useMemo(() => ({ tenantId: selectedCompany?.tenantId ?? '', companyId: selectedCompany?.id ?? '' }), [selectedCompany]);
  const overview = useFinanceOverview(scope);
  const operations = useFinanceOperations(scope);

  if (!selectedCompany) return null;
  if (activeTab !== 'resumo') return <FinancePage company={selectedCompany} allowDirectAction={false} />;

  const data = overview.data;
  const income = data?.summary.find((item) => item.entryType === 'income');
  const expense = data?.summary.find((item) => item.entryType === 'expense');
  const incomeRealized = income?.realizedAmount ?? 0;
  const expenseRealized = expense?.realizedAmount ?? 0;
  const balance = incomeRealized - expenseRealized;
  const balances = operations.state.references?.installmentBalances ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const overdueCount = data?.entries.filter((entry) => {
    const item = balances.find((balanceItem) => balanceItem.installmentId === entry.installmentId);
    return entry.dueDate < today && (item?.remainingAmount ?? entry.amount) > 0;
  }).length ?? 0;

  function changeTab(tab: WorkspaceTab) {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  }

  return <section className="finance-workspace" aria-label="Fluxo do mês">
    <div className="finance-workspace__company-block">
      <strong className="finance-workspace__section-label">Empresa</strong>
      <div className="finance-workspace__company-grid">
        {financeCompanies.map((company) => {
          const label = companyLabel(company);
          const active = company.id === selectedCompany.id;
          return <button type="button" key={company.id} className={`finance-workspace__company ${active ? 'finance-workspace__company--active' : ''}`} onClick={() => setSelectedCompanyId(company.id)}>
            <span className="finance-workspace__company-icon"><Icon name={label === 'Pessoal' ? 'person' : 'company'} /></span>
            <span><strong>{label}</strong><small>{companySubtitle(company)}</small></span>
          </button>;
        })}
      </div>
    </div>

    <header className="finance-workspace__header">
      <span>Financeiro · Competência {data ? monthLabel(data.month) : '--/----'}</span>
      <h1>Fluxo do mês</h1>
      <p>Resumo operacional de receitas e despesas da empresa selecionada.</p>
    </header>

    <nav className="finance-workspace__tabs" aria-label="Seções do financeiro">
      <button type="button" className="finance-workspace__tab finance-workspace__tab--active" onClick={() => changeTab('resumo')}><Icon name="summary" />Resumo</button>
      <button type="button" className="finance-workspace__tab" onClick={() => changeTab('lancamentos')}><Icon name="list" />Lançamentos</button>
      <button type="button" className="finance-workspace__tab" onClick={() => changeTab('contas')}><Icon name="bank" />Contas e bancos</button>
    </nav>

    <div className="finance-workspace__top-cards">
      <article className="finance-workspace__mini finance-workspace__mini--balance">
        <span className="finance-workspace__mini-icon"><Icon name="balance" /></span>
        <div><small>Saldo do mês</small><strong>{money.format(balance)}</strong><span>Receitas - Despesas</span></div>
      </article>
      <article className="finance-workspace__mini finance-workspace__mini--month">
        <span className="finance-workspace__mini-icon"><Icon name="calendar" /></span>
        <div><small>Competência</small><strong>{data ? monthLabel(data.month) : '--/----'}</strong><span>{data ? longMonthLabel(data.month) : 'Carregando...'}</span></div>
      </article>
    </div>

    <div className="finance-workspace__summary-grid">
      <article className="finance-workspace__summary finance-workspace__summary--income">
        <div className="finance-workspace__summary-head"><span className="finance-workspace__summary-icon"><Icon name="income" /></span><div><h2>Receitas</h2><p>Planejado × realizado no mês</p></div></div>
        <dl><div><dt>Planejado</dt><dd>{money.format(income?.plannedAmount ?? 0)}</dd></div><div><dt>Realizado</dt><dd>{money.format(incomeRealized)}</dd></div><div><dt>Pendente</dt><dd>{money.format(income?.pendingAmount ?? 0)}</dd></div></dl>
        <footer><span>Total de lançamentos</span><strong>{income?.itemCount ?? 0}</strong></footer>
      </article>
      <article className="finance-workspace__summary finance-workspace__summary--expense">
        <div className="finance-workspace__summary-head"><span className="finance-workspace__summary-icon"><Icon name="expense" /></span><div><h2>Despesas</h2><p>Inclui parcelas de cartão na competência</p></div></div>
        <dl><div><dt>Planejado</dt><dd>{money.format(expense?.plannedAmount ?? 0)}</dd></div><div><dt>Realizado</dt><dd>{money.format(expenseRealized)}</dd></div><div><dt>Pendente</dt><dd>{money.format(expense?.pendingAmount ?? 0)}</dd></div></dl>
        <footer><span>Total de lançamentos</span><strong>{expense?.itemCount ?? 0}</strong></footer>
      </article>
    </div>

    <button type="button" className="finance-workspace__late" onClick={() => { const next = new URLSearchParams(searchParams); next.set('tab', 'lancamentos'); setSearchParams(next); }}>
      <span className="finance-workspace__late-icon"><Icon name="late" /></span>
      <span className="finance-workspace__late-copy"><strong>Contas em atraso</strong><small>Lançamentos vencidos e não pagos</small></span>
      <b>{overdueCount}</b><i>›</i>
    </button>

    <div className="finance-workspace__quick">
      <h2>Ações rápidas</h2>
      <div className="finance-workspace__quick-grid">
        <button type="button" onClick={() => void navigate('/financeiro?action=new-entry')}><Icon name="plus" /><span>Novo<br/>lançamento</span></button>
        <button type="button" onClick={() => void navigate('/bancos')}><Icon name="transfer" /><span>Transferência</span></button>
        <button type="button" onClick={() => void navigate('/bancos')}><Icon name="document" /><span>Extrato<br/>bancário</span></button>
        <button type="button" onClick={() => void navigate('/cartoes')}><Icon name="card" /><span>Fatura do<br/>cartão</span></button>
      </div>
    </div>
  </section>;
}
