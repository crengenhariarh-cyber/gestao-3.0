import { useState } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { EngineeringPage } from '../modules/engineering/ui/EngineeringPage';
import { BanksPage } from '../modules/finance/ui/BanksPage';
import { FinancePage } from '../modules/finance/ui/FinancePage';
import { MonthlyAccountsPage } from '../modules/finance/ui/MonthlyAccountsPage';
import { QuickEntryPage } from '../modules/finance/ui/QuickEntryPage';
import { HomePage } from '../modules/home/ui/HomePage';
import { HrBudgetPage } from '../modules/hr/ui/HrBudgetPage';
import { ALL_COMPANIES_ID, isAllCompanies } from '../modules/platform/application/companyContext';
import type { PlatformSession } from '../modules/platform/ui/usePlatformSession';
import { Button } from '../shared/ui/Button';
import { Dialog } from '../shared/ui/Dialog';
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
  { to: '/adicionar', label: 'Adicionar', icon: 'add' },
  { to: '/bancos', label: 'Bancos', icon: 'bank' },
  { to: '/financeiro?tab=cartoes', label: 'Cartões', icon: 'card' },
] as const;

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
  const [entryCompanyId, setEntryCompanyId] = useState('');
  const allCompaniesSelected = isAllCompanies(session.activeCompanyId);
  const activeCompany = allCompaniesSelected ? undefined : session.companies.find((company) => company.id === session.activeCompanyId);

  if (session.companies.length === 0) {
    return <main className="app-page app-page--centered"><EmptyState title="Nenhuma empresa liberada" message="Seu usuário está autenticado, mas ainda não possui uma empresa autorizada."/><Button variant="secondary" onClick={() => void session.signOut()}>Sair</Button></main>;
  }

  const companyOptions = [
    ...(session.companies.length > 1 ? [{ value: ALL_COMPANIES_ID, label: 'Todas as empresas' }] : []),
    ...session.companies.map((company) => ({ value: company.id, label: company.tradeName ?? company.legalName })),
  ];
  const directCompanyOptions = session.companies.map((company) => ({ value: company.id, label: company.tradeName ?? company.legalName }));
  const selectedCompanies = allCompaniesSelected ? session.companies : activeCompany ? [activeCompany] : [];
  const searchParams = new URLSearchParams(location.search);
  const newEntryRequested = location.pathname === '/financeiro' && searchParams.get('action') === 'new-entry';
  const chooseCompanyForEntry = allCompaniesSelected && newEntryRequested;
  const effectiveEntryCompanyId = entryCompanyId || session.companies[0]?.id || '';
  const activeMobileItem = location.pathname === '/' ? 'Início' : location.pathname === '/adicionar' ? 'Adicionar' : location.pathname === '/bancos' ? 'Bancos' : location.pathname === '/financeiro' && searchParams.get('tab') === 'cartoes' ? 'Cartões' : newEntryRequested ? 'Adicionar' : null;

  const allCompaniesFinance = <div className="app-company-sections">{session.companies.map((company) => <section key={company.id} aria-label={`Financeiro ${company.tradeName ?? company.legalName}`}><div className="app-section-heading"><div><span className="ui-muted">Empresa</span><h2>{company.tradeName ?? company.legalName}</h2></div></div><FinancePage company={company}/></section>)}</div>;
  const allCompaniesMonthlyAccounts = <div className="app-company-sections">{session.companies.map((company) => <section key={company.id} aria-label={`Contas do mês ${company.tradeName ?? company.legalName}`}><div className="app-section-heading"><div><span className="ui-muted">Empresa</span><h2>{company.tradeName ?? company.legalName}</h2></div></div><MonthlyAccountsPage company={company}/></section>)}</div>;
  const allCompaniesBanks = <div className="app-company-sections">{session.companies.map((company) => <section key={company.id} aria-label={`Bancos ${company.tradeName ?? company.legalName}`}><div className="app-section-heading"><div><span className="ui-muted">Empresa</span><h2>{company.tradeName ?? company.legalName}</h2></div></div><BanksPage company={company}/></section>)}</div>;
  const allCompaniesRh = <div>{session.companies.map((company) => <section key={company.id} aria-label={`RH ${company.tradeName ?? company.legalName}`}><div className="app-section-heading"><div><span className="ui-muted">Empresa</span><h2>{company.tradeName ?? company.legalName}</h2></div></div><HrBudgetPage company={company}/></section>)}</div>;
  const allCompaniesEngineering = <div>{session.companies.map((company) => <section key={company.id} aria-label={`Engenharia ${company.tradeName ?? company.legalName}`}><div className="app-section-heading"><div><span className="ui-muted">Empresa</span><h2>{company.tradeName ?? company.legalName}</h2></div></div><EngineeringPage company={company}/></section>)}</div>;

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
            <Select label="Empresa" value={session.activeCompanyId ?? ''} options={companyOptions} onChange={(event) => session.selectCompany(event.target.value)}/>
            <Button variant="tertiary" onClick={() => void session.signOut()}>Sair</Button>
          </div>
        </div>
        <nav className="app-nav" aria-label="Navegação principal">
          {navigation.map((item) => <NavLink key={item.to} to={item.to} end={'end' in item ? item.end : false} className={({ isActive }) => `app-nav__link ${isActive ? 'app-nav__link--active' : ''}`.trim()}><span className="app-nav__icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span></NavLink>)}
          <Button variant="tertiary" size="sm" onClick={() => setCentralMenuOpen(true)}>Mais</Button>
        </nav>
      </header>

      <main className="app-page" id="app-main" tabIndex={-1}>
        <div className="app-page__context" aria-live="polite"><span>Visão</span><strong>{allCompaniesSelected ? 'Todas as empresas' : activeCompany?.tradeName ?? activeCompany?.legalName}</strong></div>
        <Routes>
          <Route path="/" element={<HomePage companies={selectedCompanies}/>}/>
          <Route path="/adicionar" element={<QuickEntryPage companies={session.companies} preferredCompanyId={activeCompany?.id ?? null}/>}/>
          <Route path="/financeiro" element={activeCompany ? <FinancePage company={activeCompany} allowDirectAction/> : allCompaniesFinance}/>
          <Route path="/contas-do-mes" element={activeCompany ? <MonthlyAccountsPage company={activeCompany}/> : allCompaniesMonthlyAccounts}/>
          <Route path="/bancos" element={activeCompany ? <BanksPage company={activeCompany}/> : allCompaniesBanks}/>
          <Route path="/rh" element={activeCompany ? <HrBudgetPage company={activeCompany}/> : allCompaniesRh}/>
          <Route path="/engenharia" element={activeCompany ? <EngineeringPage company={activeCompany}/> : allCompaniesEngineering}/>
          <Route path="*" element={<EmptyState title="Página não encontrada" message="A rota informada não existe neste ambiente."/>}/>
        </Routes>
      </main>

      <nav className="app-mobile-nav" aria-label="Atalhos rápidos">
        {quickNavigation.map((item) => <NavLink key={item.label} to={item.to} end={'end' in item ? item.end : false} className={`app-mobile-nav__link ${activeMobileItem === item.label ? 'app-mobile-nav__link--active' : ''}`.trim()}><span className="app-mobile-nav__icon"><MobileNavIcon icon={item.icon}/></span><span>{item.label}</span></NavLink>)}
        <Button variant="tertiary" className={`app-mobile-nav__button ${centralMenuOpen ? 'app-mobile-nav__button--active' : ''}`.trim()} aria-label="Abrir Central do Gestão" onClick={() => setCentralMenuOpen(true)}><span className="app-mobile-nav__icon"><MobileNavIcon icon="more"/></span><span>Mais</span></Button>
      </nav>

      <Dialog
        open={chooseCompanyForEntry}
        title="Escolher empresa"
        description="O lançamento precisa pertencer a uma empresa específica."
        confirmLabel="Continuar para lançamento"
        onClose={() => { setEntryCompanyId(''); void navigate('/'); }}
        onBack={() => { setEntryCompanyId(''); void navigate('/'); }}
        onConfirm={() => {
          if (!effectiveEntryCompanyId) return;
          session.selectCompany(effectiveEntryCompanyId);
          setEntryCompanyId('');
        }}
      >
        <Select label="Empresa do lançamento" value={effectiveEntryCompanyId} options={directCompanyOptions} onChange={(event) => setEntryCompanyId(event.target.value)} />
      </Dialog>

      <CentralMenu
        open={centralMenuOpen}
        onClose={() => setCentralMenuOpen(false)}
        onNavigate={(to) => { void navigate(to); }}
        onSignOut={() => { void session.signOut(); }}
      />
    </div>
  );
}
