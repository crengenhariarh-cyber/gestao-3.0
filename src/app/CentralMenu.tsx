import { useMemo, useState } from 'react';
import { Button } from '../shared/ui/Button';
import { Input } from '../shared/ui/Input';

interface CentralMenuProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (to: string) => void;
  onSignOut: () => void;
}

type MenuItem = { label: string; to?: string; disabled?: boolean };
type MenuSection = { id: string; label: string; items: readonly MenuItem[] };

const sections: readonly MenuSection[] = [
  {
    id: 'financeiro',
    label: 'Financeiro',
    items: [
      { label: 'Lançamentos', to: '/financeiro?tab=lancamentos' },
      { label: 'Contas do mês', to: '/financeiro?tab=lancamentos' },
      { label: 'Bancos', to: '/financeiro?tab=contas' },
      { label: 'Cartões', to: '/financeiro?tab=cartoes' },
      { label: 'Limites', to: '/financeiro?tab=cartoes' },
      { label: 'Dashboard financeiro', to: '/financeiro?tab=resumo' },
    ],
  },
  {
    id: 'engenharia',
    label: 'Engenharia',
    items: [
      { label: 'Contratos', to: '/engenharia' },
      { label: 'Produção', to: '/engenharia' },
      { label: 'Orçamentos', to: '/engenharia' },
    ],
  },
  {
    id: 'rh',
    label: 'Recursos Humanos',
    items: [
      { label: 'Recursos Humanos', to: '/rh' },
    ],
  },
  {
    id: 'relatorios',
    label: 'Relatórios',
    items: [
      { label: 'Central de relatórios', disabled: true },
    ],
  },
  {
    id: 'administracao',
    label: 'Administração',
    items: [
      { label: 'Usuários e permissões', disabled: true },
      { label: 'Empresas do tenant', disabled: true },
      { label: 'Cadastros e configurações', disabled: true },
      { label: 'Clientes atendidos', disabled: true },
      { label: 'Minhas empresas', disabled: true },
      { label: 'Auditoria', disabled: true },
      { label: 'Saúde do sistema', disabled: true },
      { label: 'Clientes SaaS e permissões', disabled: true },
      { label: 'Planos e módulos', disabled: true },
    ],
  },
  {
    id: 'particular',
    label: 'Área particular',
    items: [
      { label: 'Acertos pessoais', disabled: true },
    ],
  },
];

export function CentralMenu({ open, onClose, onNavigate, onSignOut }: CentralMenuProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const query = search.trim().toLocaleLowerCase('pt-BR');

  const visibleSections = useMemo(() => {
    if (!query) return sections;
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => `${section.label} ${item.label}`.toLocaleLowerCase('pt-BR').includes(query)),
      }))
      .filter((section) => section.items.length > 0);
  }, [query]);

  if (!open) return null;

  function go(to: string) {
    onNavigate(to);
    onClose();
  }

  return (
    <div className="central-menu-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="central-menu" role="dialog" aria-modal="true" aria-labelledby="central-menu-title">
        <header className="central-menu__header">
          <div className="central-menu__brand">
            <img src="/gestao-icon.svg?v=3" alt="" aria-hidden="true" />
            <div><h2 id="central-menu-title">Central do Gestão</h2><p>Todos os módulos e cadastros</p></div>
          </div>
          <Button variant="tertiary" className="central-menu__close" aria-label="Fechar Central do Gestão" onClick={onClose}>×</Button>
        </header>

        <div className="central-menu__body">
          <Button variant="secondary" className="central-menu__home" onClick={() => go('/')}>⌂ <span>Voltar ao início</span></Button>
          <div className="central-menu__search"><Input label="Buscar" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar módulo, cadastro ou relatório" /></div>

          <div className="central-menu__sections">
            {visibleSections.map((section) => {
              const isExpanded = query ? true : expanded === section.id;
              return <div className="central-menu__section" key={section.id}>
                <Button
                  variant="primary"
                  className="central-menu__section-toggle"
                  aria-expanded={isExpanded}
                  onClick={() => setExpanded((current) => current === section.id ? null : section.id)}
                >
                  <span>{section.label}</span><span aria-hidden="true">{isExpanded ? '⌃' : '⌄'}</span>
                </Button>
                {isExpanded && <div className="central-menu__items">
                  {section.items.map((item) => <Button
                    key={item.label}
                    variant="secondary"
                    className="central-menu__item"
                    disabled={item.disabled}
                    title={item.disabled ? 'Tela será migrada nas próximas etapas' : undefined}
                    onClick={item.to ? () => go(item.to!) : undefined}
                  >
                    <span>{item.label}</span>{item.disabled && <small>Em migração</small>}
                  </Button>)}
                </div>}
              </div>;
            })}
          </div>
        </div>

        <footer className="central-menu__footer"><Button variant="secondary" onClick={onSignOut}>Sair e deslogar</Button></footer>
      </section>
    </div>
  );
}
