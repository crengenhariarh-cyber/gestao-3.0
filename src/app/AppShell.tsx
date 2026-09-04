import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { BudgetWorkspacePage } from '../modules/budget/ui/BudgetWorkspacePage';
import { EngineeringPage } from '../modules/engineering/ui/EngineeringPage';
import { AllBanksList } from '../modules/finance/ui/AllBanksList';
import { AllCompaniesMonthlyAccountsPage } from '../modules/finance/ui/AllCompaniesMonthlyAccountsPage';
import { BanksPage } from '../modules/finance/ui/BanksPage';
import { CardsPage } from '../modules/finance/ui/CardsPage';
import { FinanceWorkspacePage } from '../modules/finance/ui/FinanceWorkspacePage';
import { QuickEntryDialog } from '../modules/finance/ui/QuickEntryDialog';
import { HomePage } from '../modules/home/ui/HomePage';
import { HrWorkspacePage } from '../modules/hr/ui/HrWorkspacePage';
import { ALL_COMPANIES_ID, isAllCompanies } from '../modules/platform/application/companyContext';
import type { CompanySummary } from '../modules/platform/domain/AccessContext';
import type { PlatformSession } from '../modules/platform/ui/usePlatformSession';
import { Button } from '../shared/ui/Button';
import { EmptyState } from '../shared/ui/Feedback';
import { Select } from '../shared/ui/Select';
import { CentralMenu } from './CentralMenu';

const navigation = [
  { to: '/', label: 'Início', icon: '⌂', end: true },
  { to: '/financeiro', label: 'Financeiro', icon: 'R$' },
  { to: '/rh', label: 'RH', icon: 'RH' },
  { to: '/engenharia', label: 'Engenharia', icon: '▰' },
] as const;

const quickNavigation = [
  { to: '/', label: 'Início', icon: 'home', end: true },
  { to: '/bancos', label: 'Bancos', icon: 'bank' },
  { to: '/cartoes', label: 'Cartões', icon: 'card' },
] as const;

const COMPANY_ORDER = ['Admin', 'Blaze', 'CR', 'Pessoal', 'PR', 'Sartori'] as const;
function companyLabel(company: CompanySummary): string {
  const raw = `${company.tradeName ?? ''} ${company.legalName}`.toLocaleUpperCase('pt-BR');
  if (raw.includes('SARTORI')) return 'Sartori';
  if (raw.includes('BLAZE')) return 'Blaze';
  if (raw.includes('PESSOAL')) return 'Pessoal';
  if (raw.includes('ADMIN')) return 'Admin';
  if (raw.includes('PR-HIST') || /(^|\s)PR(\s|$)/.test(raw)) return 'PR';
  if (raw.includes('CR-HIST') || /(^|\s)CR(\s|$)/.test(raw)) return 'CR';
  return company.tradeName ?? company.legalName;
}
function visibleCompanies(companies: readonly CompanySummary[]): readonly CompanySummary[] {
  const chosen = new Map<string, CompanySummary>();
  for (const company of companies) {
    const label = companyLabel(company);
    if (!COMPANY_ORDER.includes(label as (typeof COMPANY_ORDER)[number])) continue;
    const current = chosen.get(label);
    const currentHistoric = current ? /HIST/i.test(`${current.tradeName ?? ''} ${current.legalName}`) : true;
    const candidateHistoric = /HIST/i.test(`${company.tradeName ?? ''} ${company.legalName}`);
    if (!current || (currentHistoric && !candidateHistoric)) chosen.set(label, company);
  }
  return COMPANY_ORDER.flatMap((label) => chosen.get(label) ? [chosen.get(label)!] : []);
}

type MobileIcon = 'home' | 'add' | 'bank' | 'card' | 'more';
function MobileNavIcon({ icon }: { icon: MobileIcon }) {
  if (icon === 'home') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-5v-7h-5v7h-5A1.5 1.5 0 0 1 3 19.5z"/></svg>;
  if (icon === 'add') return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/></svg>;
  if (icon === 'bank') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h18M5 9v8M9.5 9v8M14.5 9v8M19 9v8M3 19h18M12 3l9 4H3z"/></svg>;
  if (icon === 'card') return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>;
}

export interface AppShellProps { session: PlatformSession; }

export function AppShell({ session }: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [centralMenuOpen, setCentralMenuOpen] = useState(false);
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);
  const [homeRefreshToken, setHomeRefreshToken] = useState(0);
  const companies = visibleCompanies(session.companies);
  const allCompaniesSelected = isAllCompanies(session.activeCompanyId);
  const activeCompany = allCompaniesSelected ? undefined : companies.find((company) => company.id === session.activeCompanyId);
  const searchParams = new URLSearchParams(location.search);
  const routeEntryRequested = location.pathname === '/financeiro' && searchParams.get('action') === 'new-entry';
  const entryOpen = quickEntryOpen || routeEntryRequested;

  useEffect(() => {
    if (!routeEntryRequested) return;
    setQuickEntryOpen(true);
    const preservedParams = new URLSearchParams(location.search);
    preservedParams.delete('action');
    const preservedSearch = preservedParams.toString();
    void navigate({ pathname: location.pathname, search: preservedSearch ? `?${preservedSearch}` : '' }, { replace: true });
  }, [location.pathname, location.search, navigate, routeEntryRequested]);

  if (companies.length === 0) {
    return <main className="app-page app-page--centered"><EmptyState title="Nenhuma empresa liberada" message="Seu usuário está autenticado, mas ainda não possui uma empresa autorizada."/><Button variant="secondary" onClick={() => void session.signOut()}>Sair</Button></main>;
  }

  const companyOptions = [
    ...(companies.length > 1 ? [{ value: ALL_COMPANIES_ID, label: 'Todas as empresas' }] : []),
    ...companies.map((company) => ({ value: company.id, label: companyLabel(company) })),
  ];
  const selectedCompanies = allCompaniesSelected ? companies : activeCompany ? [activeCompany] : [];
  const financeCompanies = allCompaniesSelected ? companies : selectedCompanies;
  const activeMobileItem = entryOpen ? 'Adicionar' : location.pathname === '/' ? 'Início' : location.pathname === '/bancos' ? 'Bancos' : location.pathname === '/cartoes' ? 'Cartões' : null;

  const allCompaniesBanks = <div className="app-company-sections app-company-sections--banks"><section className="app-company-sections--banks__controls" aria-label="Ações de bancos"><BanksPage company={companies[0]!} companies={companies} showHeader /></section><AllBanksList companies={companies}/></div>;

  return (
    <div className="app-shell">
      <a className="app-skip-link" href="#app-main">Ir para o conteúdo</a>
      <header className="app-header">
        <div className="app-header__top">
          <NavLink to="/" className="app-brand" aria-label="Gestão — Início">
            <img src="/gestao-internal.svg?v=1" alt="" aria-hidden="true" />
            <div><strong>Gestão</strong><span>Sua gestão, mais simples</span></div>
          </NavLink>
          <div className="app-header__actions">
            <Select label="Empresa" value={allCompaniesSelected ? ALL_COMPANIES_ID : activeCompany?.id ?? ALL_COMPANIES_ID} options={companyOptions} onChange={(event) => session.selectCompany(event.target.value)}/>
            <Button variant="tertiary" onClick={() => void session.signOut()}>Sair</Button>
          </div>
        </div>
        <nav className="app-nav" aria-label="Navegação principal">
          {navigation.map((item) => <NavLink key={item.to} to={item.to} end={'end' in item ? item.end : false} className={({ isActive }) => `app-nav__link ${isActive ? 'app-nav__link--active' : ''}`.trim()}><span className="app-nav__icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span></NavLink>)}
          <Button variant="tertiary" size="sm" onClick={() => setCentralMenuOpen(true)}>Mais</Button>
        </nav>
      </header>

      <main className="app-page" id="app-main" tabIndex={-1}>
        {location.pathname !== '/financeiro' && <div className="app-page__context" aria-live="polite"><span>Visão</span><strong>{allCompaniesSelected ? 'Todas as empresas' : activeCompany ? companyLabel(activeCompany) : ''}</strong></div>}
        <Routes>
          <Route path="/" element={<HomePage key={homeRefreshToken} companies={selectedCompanies}/>}/>
          <Route path="/financeiro" element={<FinanceWorkspacePage companies={financeCompanies} {...(activeCompany ? { initialCompanyId: activeCompany.id } : {})}/>}/>
          <Route path="/contas-do-mes" element={<AllCompaniesMonthlyAccountsPage companies={selectedCompanies}/>}/>
          <Route path="/bancos" element={activeCompany ? <BanksPage company={activeCompany} companies={companies}/> : allCompaniesBanks}/>
          <Route path="/cartoes" element={<CardsPage companies={selectedCompanies} availableCompanies={companies}/>}/>
          <Route path="/orcamento" element={<BudgetWorkspacePage companies={companies} initialCompanyId={activeCompany?.id}/>}/>
          <Route path="/rh" element={activeCompany ? <HrWorkspacePage companies={companies} initialCompanyId={activeCompany.id}/> : <HrWorkspacePage companies={companies}/>}/>
          <Route path="/engenharia" element={activeCompany ? <EngineeringPage companies={companies} initialCompanyId={activeCompany.id}/> : <EngineeringPage companies={companies}/>}/>
          <Route path="*" element={<EmptyState title="Página não encontrada" message="A rota informada não existe neste ambiente."/>}/>
        </Routes>
      </main>

      <nav className="app-mobile-nav" aria-label="Atalhos rápidos">
        <NavLink to="/" end className={`app-mobile-nav__link app-mobile-nav__link--home ${activeMobileItem === 'Início' ? 'app-mobile-nav__link--active' : ''}`.trim()}><span className="app-mobile-nav__icon"><MobileNavIcon icon="home"/></span><span>Início</span></NavLink>
        <Button variant="tertiary" className={`app-mobile-nav__button ${activeMobileItem === 'Adicionar' ? 'app-mobile-nav__button--active' : ''}`.trim()} aria-label="Novo lançamento" onClick={() => setQuickEntryOpen(true)}><span className="app-mobile-nav__icon"><MobileNavIcon icon="add"/></span><span>Adicionar</span></Button>
        {quickNavigation.slice(1).map((item) => <NavLink key={item.label} to={item.to} className={`app-mobile-nav__link ${activeMobileItem === item.label ? 'app-mobile-nav__link--active' : ''}`.trim()}><span className="app-mobile-nav__icon"><MobileNavIcon icon={item.icon}/></span><span>{item.label}</span></NavLink>)}
        <Button variant="tertiary" className={`app-mobile-nav__button ${centralMenuOpen ? 'app-mobile-nav__button--active' : ''}`.trim()} aria-label="Abrir Central do Gestão" onClick={() => setCentralMenuOpen(true)}><span className="app-mobile-nav__icon"><MobileNavIcon icon="more"/></span><span>Mais</span></Button>
      </nav>

      <QuickEntryDialog open={entryOpen} companies={companies} initialCompanyId={activeCompany?.id ?? ''} allCompaniesMode={allCompaniesSelected} onClose={() => { setQuickEntryOpen(false); if (location.pathname === '/') setHomeRefreshToken((value) => value + 1); }} />

      <CentralMenu open={centralMenuOpen} onClose={() => setCentralMenuOpen(false)} onNavigate={(to) => { void navigate(to); }} onSignOut={() => { void session.signOut(); }} />
    </div>
  );
}
