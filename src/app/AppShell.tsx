import { NavLink, Route, Routes } from 'react-router-dom';
import { EngineeringPage } from '../modules/engineering/ui/EngineeringPage';
import { FinancePage } from '../modules/finance/ui/FinancePage';
import { HomePage } from '../modules/home/ui/HomePage';
import { HrBudgetPage } from '../modules/hr/ui/HrBudgetPage';
import { ALL_COMPANIES_ID, isAllCompanies } from '../modules/platform/application/companyContext';
import type { PlatformSession } from '../modules/platform/ui/usePlatformSession';
import { Button } from '../shared/ui/Button';
import { Card } from '../shared/ui/Card';
import { EmptyState } from '../shared/ui/Feedback';
import { Select } from '../shared/ui/Select';

const navigation = [
  { to: '/', label: 'Início', shortLabel: 'Início', icon: '⌂', end: true },
  { to: '/financeiro', label: 'Financeiro', shortLabel: 'Financeiro', icon: 'R$' },
  { to: '/rh', label: 'RH', shortLabel: 'RH', icon: 'RH' },
  { to: '/engenharia', label: 'Engenharia', shortLabel: 'Engenharia', icon: '▰' },
  { to: '/mais', label: 'Mais', shortLabel: 'Mais', icon: '•••' },
] as const;

export interface AppShellProps { session: PlatformSession; }

export function AppShell({ session }: AppShellProps) {
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

  const morePage = (
    <section className="app-more" aria-labelledby="more-title">
      <div className="app-section-heading">
        <div><span className="ui-muted">Gestão</span><h1 id="more-title">Mais</h1></div>
        <p className="ui-muted">Configurações e informações do ambiente.</p>
      </div>
      <div className="app-more__grid">
        <Card title="Empresa ativa" description="Altere o contexto sem misturar os dados de origem.">
          <Select label="Empresa" value={session.activeCompanyId ?? ''} options={companyOptions} onChange={(event) => session.selectCompany(event.target.value)}/>
        </Card>
        <Card title="Sua conta" description={session.user?.email ?? 'Usuário autenticado'}>
          <Button variant="secondary" onClick={() => void session.signOut()}>Sair do Gestão</Button>
        </Card>
      </div>
    </section>
  );

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
        </nav>
      </header>

      <main className="app-page" id="app-main" tabIndex={-1}>
        <div className="app-page__context" aria-live="polite"><span>Visão</span><strong>{allCompaniesSelected ? 'Todas as empresas' : activeCompany?.tradeName ?? activeCompany?.legalName}</strong></div>
        <Routes>
          <Route path="/" element={<HomePage companies={selectedCompanies}/>}/>
          <Route path="/financeiro" element={activeCompany ? <FinancePage company={activeCompany}/> : requiresSpecificCompany}/>
          <Route path="/rh" element={activeCompany ? <HrBudgetPage company={activeCompany}/> : allCompaniesRh}/>
          <Route path="/engenharia" element={activeCompany ? <EngineeringPage company={activeCompany}/> : allCompaniesEngineering}/>
          <Route path="/mais" element={morePage}/>
          <Route path="*" element={<EmptyState title="Página não encontrada" message="A rota informada não existe neste ambiente."/>}/>
        </Routes>
      </main>

      <nav className="app-mobile-nav" aria-label="Navegação móvel">
        {navigation.map((item) => <NavLink key={item.to} to={item.to} end={'end' in item ? item.end : false} className={({ isActive }) => `app-mobile-nav__link ${isActive ? 'app-mobile-nav__link--active' : ''}`.trim()}><span className="app-mobile-nav__icon" aria-hidden="true">{item.icon}</span><span>{item.shortLabel}</span></NavLink>)}
      </nav>
    </div>
  );
}
