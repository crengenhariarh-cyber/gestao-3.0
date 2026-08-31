import { NavLink, Route, Routes } from 'react-router-dom';
import { EngineeringPage } from '../modules/engineering/ui/EngineeringPage';
import { FinancePage } from '../modules/finance/ui/FinancePage';
import { HomePage } from '../modules/home/ui/HomePage';
import { HrBudgetPage } from '../modules/hr/ui/HrBudgetPage';
import type { PlatformSession } from '../modules/platform/ui/usePlatformSession';
import { Button } from '../shared/ui/Button';
import { EmptyState } from '../shared/ui/Feedback';
import { Select } from '../shared/ui/Select';

const navigation = [
  { to: '/', label: 'Início', shortLabel: 'Início', icon: '⌂', end: true },
  { to: '/financeiro', label: 'Financeiro', shortLabel: 'Financeiro', icon: 'R$' },
  { to: '/rh', label: 'RH', shortLabel: 'RH', icon: 'RH' },
  { to: '/engenharia', label: 'Engenharia', shortLabel: 'Engenharia', icon: 'E' },
] as const;

export interface AppShellProps { session: PlatformSession; }

export function AppShell({ session }: AppShellProps) {
  const activeCompany = session.companies.find((company) => company.id === session.activeCompanyId);

  if (session.companies.length === 0) {
    return <main className="app-page app-page--centered"><EmptyState title="Nenhuma empresa liberada" message="Seu usuário está autenticado, mas ainda não possui uma empresa autorizada."/><Button variant="secondary" onClick={() => void session.signOut()}>Sair</Button></main>;
  }

  return (
    <div className="app-shell">
      <a className="app-skip-link" href="#app-main">Ir para o conteúdo</a>
      <header className="app-header">
        <div className="app-header__top">
          <div className="app-brand"><strong>Gestão</strong><span>{session.user?.email ?? 'Usuário autenticado'}</span></div>
          <div className="app-header__actions">
            <Select label="Empresa" value={session.activeCompanyId ?? ''} options={session.companies.map((company) => ({ value: company.id, label: company.tradeName ?? company.legalName }))} onChange={(event) => session.selectCompany(event.target.value)}/>
            <Button variant="tertiary" onClick={() => void session.signOut()}>Sair</Button>
          </div>
        </div>
        <nav className="app-nav" aria-label="Navegação principal">
          {navigation.map((item) => <NavLink key={item.to} to={item.to} end={'end' in item ? item.end : false} className={({ isActive }) => `app-nav__link ${isActive ? 'app-nav__link--active' : ''}`.trim()}><span className="app-nav__icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span></NavLink>)}
        </nav>
      </header>

      <main className="app-page" id="app-main" tabIndex={-1}>
        <div className="app-page__context" aria-live="polite"><span>Empresa ativa</span><strong>{activeCompany?.tradeName ?? activeCompany?.legalName}</strong></div>
        <Routes>
          <Route path="/" element={activeCompany ? <HomePage company={activeCompany}/> : <EmptyState title="Selecione uma empresa" message="A visão geral precisa de uma empresa ativa autorizada."/>}/>
          <Route path="/financeiro" element={activeCompany ? <FinancePage company={activeCompany}/> : <EmptyState title="Selecione uma empresa" message="O Financeiro precisa de uma empresa ativa autorizada."/>}/>
          <Route path="/rh" element={activeCompany ? <HrBudgetPage company={activeCompany}/> : <EmptyState title="Selecione uma empresa" message="RH e Orçamento precisam de uma empresa ativa autorizada."/>}/>
          <Route path="/engenharia" element={activeCompany ? <EngineeringPage company={activeCompany}/> : <EmptyState title="Selecione uma empresa" message="A Engenharia precisa de uma empresa ativa autorizada."/>}/>
          <Route path="*" element={<EmptyState title="Página não encontrada" message="A rota informada não existe neste ambiente."/>}/>
        </Routes>
      </main>

      <nav className="app-mobile-nav" aria-label="Navegação móvel">
        {navigation.map((item) => <NavLink key={item.to} to={item.to} end={'end' in item ? item.end : false} className={({ isActive }) => `app-mobile-nav__link ${isActive ? 'app-mobile-nav__link--active' : ''}`.trim()}><span className="app-mobile-nav__icon" aria-hidden="true">{item.icon}</span><span>{item.shortLabel}</span></NavLink>)}
      </nav>
    </div>
  );
}
