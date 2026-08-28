import { NavLink, Route, Routes } from 'react-router-dom';
import type { PlatformSession } from '../modules/platform/ui/usePlatformSession';
import { Button } from '../shared/ui/Button';
import { Card } from '../shared/ui/Card';
import { EmptyState } from '../shared/ui/Feedback';
import { Select } from '../shared/ui/Select';
import { UiLab } from './UiLab';

const navigation = [
  { to: '/', label: 'Início', end: true },
  { to: '/financeiro', label: 'Financeiro' },
  { to: '/rh', label: 'RH' },
  { to: '/engenharia', label: 'Engenharia' },
  { to: '/ui-lab', label: 'UI Lab' },
] as const;

interface ModulePlaceholderProps {
  title: string;
  description: string;
}

function ModulePlaceholder({ title, description }: ModulePlaceholderProps) {
  return (
    <Card title={title} description={description}>
      <p className="ui-muted">
        Fundação pronta. As regras deste módulo serão conectadas por casos de uso e repositórios próprios.
      </p>
    </Card>
  );
}

export interface AppShellProps {
  session: PlatformSession;
}

export function AppShell({ session }: AppShellProps) {
  const activeCompany = session.companies.find(
    (company) => company.id === session.activeCompanyId,
  );

  if (session.companies.length === 0) {
    return (
      <main className="app-page app-page--centered">
        <EmptyState
          title="Nenhuma empresa liberada"
          message="Seu usuário está autenticado, mas ainda não possui uma empresa autorizada."
        />
        <Button variant="secondary" onClick={() => void session.signOut()}>
          Sair
        </Button>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__top">
          <div className="app-brand">
            <strong>Gestão 3.0</strong>
            <span>{session.user?.email ?? 'Usuário autenticado'}</span>
          </div>

          <div className="app-header__actions">
            <Select
              label="Empresa"
              value={session.activeCompanyId ?? ''}
              options={session.companies.map((company) => ({
                value: company.id,
                label: company.tradeName ?? company.legalName,
              }))}
              onChange={(event) => session.selectCompany(event.target.value)}
            />
            <Button variant="ghost" onClick={() => void session.signOut()}>
              Sair
            </Button>
          </div>
        </div>

        <nav className="app-nav" aria-label="Navegação principal">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              className={({ isActive }) =>
                `app-nav__link ${isActive ? 'app-nav__link--active' : ''}`.trim()
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="app-page">
        <div className="app-page__context">
          <span>Empresa ativa</span>
          <strong>{activeCompany?.tradeName ?? activeCompany?.legalName}</strong>
        </div>

        <Routes>
          <Route
            path="/"
            element={
              <ModulePlaceholder
                title="Visão geral"
                description="Shell oficial do Gestão 3.0 conectado ao contexto autorizado."
              />
            }
          />
          <Route
            path="/financeiro"
            element={
              <ModulePlaceholder
                title="Financeiro"
                description="Entradas, saídas, bancos, cartões e contas com isolamento por empresa."
              />
            }
          />
          <Route
            path="/rh"
            element={
              <ModulePlaceholder
                title="RH"
                description="Colaboradores, fechamento e incidências trabalhistas por empresa."
              />
            }
          />
          <Route
            path="/engenharia"
            element={
              <ModulePlaceholder
                title="Engenharia"
                description="Contratos, medições, produção, provisórios e aditivos."
              />
            }
          />
          <Route path="/ui-lab" element={<UiLab />} />
          <Route
            path="*"
            element={
              <EmptyState
                title="Página não encontrada"
                message="A rota informada não existe neste ambiente."
              />
            }
          />
        </Routes>
      </main>
    </div>
  );
}
