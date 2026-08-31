import { useState } from 'react';
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { EngineeringPage } from '../modules/engineering/ui/EngineeringPage';
import { FinancePage } from '../modules/finance/ui/FinancePage';
import { HomePage } from '../modules/home/ui/HomePage';
import { HrBudgetPage } from '../modules/hr/ui/HrBudgetPage';
import { ALL_COMPANIES_ID, isAllCompanies } from '../modules/platform/application/companyContext';
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
  { to: '/', label: 'Início', icon: '⌂', end: true },
  { to: '/financeiro?action=new-entry', label: 'Adicionar', icon: '+' },
  { to: '/financeiro?tab=contas', label: 'Bancos', icon: '▥' },
  { to: '/financeiro?tab=cartoes', label: 'Cartões', icon: '▤' },
] as const;

export interface AppShellProps { session: PlatformSession; }

export function AppShell({ session }: AppShellProps) {
  const navigate = useNavigate();
  const [centralMenuOpen, setCentralMenuOpen] = useState(false);
  const allCompaniesSelected = isAllCompanies(session.activeCompanyId);
  const activeCompany = allCompaniesSelected ? undefined : session.companies.find((company) => company.id === session.activeCompanyId);

  if (session.companies.length === 0) {
    return <main className="app-page app-page--centered"><EmptyState title="Nenhuma empresa liberada" message="Seu usuário está autenticado, mas ainda não possui uma empresa autorizada."/><Button variant="secondary" onClick={() => void session.signOut()}>Sair</Button></main>;
  }

  const companyOptions = [
    ...(session.companies.length > 1 ? [{ value: ALL_COMPANIES_ID, label: 'Todas as empresas' }] : []),
    ...session.companies.map((company) => ({ value: company.id, label: company.tradeName ?? company.legalName })),
  ];
  const selectedCompanies = allCompaniesSelected ? session.companies : activeCompany ? [activeCompany] : [];

  const requiresSpecificCompany = <EmptyState title="Selecione uma empresa" message="O Financeiro operacional exige uma empresa específica. A opção Todas as empresas permanece disponível nas visões consolidadas."/>;
  const allCompaniesRh = <div>{session.companies.map((company) => <section key={company.id} aria-label={`RH ${company.tradeName ?? company.legalName}`}><div className="app-section-heading"><div><span className="ui-muted">Empresa</span><h2>{company.tradeName ?? company.legalName}</h2></div></div><HrBudgetPage company={company}/></section>)}</div>;
  const allCompaniesEngineering = <div>{session.companies.map((company) => <section key={company.id} aria-label={`Engenharia ${company.tradeName ?? company.legalName}`}><div className="app-section-heading"><div><span className="ui-muted">Empresa</span><h2>{company.tradeName ?? company.legalName}</h2></div></div><EngineeringPage company={company}/></section>)}</div>;

  return (
    <div className="app-shell">
      <a className="app-skip-link" href="#app-main">Ir para o conteúdo</a>
      <header className="app-header">
        <div className="app-header__top">
          <NavLink to="/" className="app-brand" aria-label="Gestão — Início">
            <img src="/gestao-icon.svg?v=3" alt="" aria-hidden="true" />
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
          <Route path="/financeiro" element={activeCompany ? <FinancePage company={activeCompany}/> : requiresSpecificCompany}/>
          <Route path="/rh" element={activeCompany ? <HrBudgetPage company={activeCompany}/> : allCompaniesRh}/>
          <Route path="/engenharia" element={activeCompany ? <EngineeringPage company={activeCompany}/> : allCompaniesEngineering}/>
          <Route path="*" element={<EmptyState title="Página não encontrada" message="A rota informada não existe neste ambiente."/>}/>
        </Routes>
      </main>

      <nav className="app-mobile-nav" aria-label="Atalhos rápidos">
        {quickNavigation.map((item) => <NavLink key={item.label} to={item.to} end={'end' in item ? item.end : false} className={({ isActive }) => `app-mobile-nav__link ${isActive && item.label === 'Início' ? 'app-mobile-nav__link--active' : ''}`.trim()}><span className="app-mobile-nav__icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span></NavLink>)}
        <Button variant="tertiary" className={`app-mobile-nav__button ${centralMenuOpen ? 'app-mobile-nav__button--active' : ''}`.trim()} aria-label="Abrir Central do Gestão" onClick={() => setCentralMenuOpen(true)}><span className="app-mobile-nav__icon" aria-hidden="true">•••</span><span>Mais</span></Button>
      </nav>

      <CentralMenu
        open={centralMenuOpen}
        onClose={() => setCentralMenuOpen(false)}
        onNavigate={(to) => navigate(to)}
        onSignOut={() => void session.signOut()}
      />
    </div>
  );
}
