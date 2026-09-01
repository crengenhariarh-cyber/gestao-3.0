import { useMemo, useState } from 'react';
import { Button } from '../shared/ui/Button';
import { Dialog } from '../shared/ui/Dialog';
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
      { label: 'Contas do mês', to: '/contas-do-mes' },
      { label: 'Bancos', to: '/bancos' },
      { label: 'Cartões', to: '/cartoes' },
      { label: 'Limites', disabled: true },
      { label: 'Dashboard financeiro', to: '/financeiro?tab=resumo' },
    ],
  },
  {
    id: 'engenharia',
    label: 'Engenharia',
    items: [
      { label: 'Contratos', to: '/engenharia' },
      { label: 'Produção', disabled: true },
      { label: 'Orçamentos', disabled: true },
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

  function go(to: string) {
    onNavigate(to);
    onClose();
  }

  return (
    <Dialog
      open={open}
      title="Central do Gestão"
      description="Todos os módulos e cadastros"
      backLabel="Voltar ao início"
      onBack={() => go('/')}
      onClose={onClose}
    >
      <div className="central-menu__content">
        <div className="central-menu__identity" aria-hidden="true">
          <img src="/gestao-icon.svg?v=3" alt="" />
        </div>

        <div className="central-menu__search">
          <Input
            label="Buscar"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar módulo, cadastro ou relatório"
          />
        </div>

        <div className="central-menu__sections">
          {visibleSections.map((section) => {
            const isExpanded = query ? true : expanded === section.id;
            return (
              <div className="central-menu__section" key={section.id}>
                <Button
                  variant="primary"
                  className="central-menu__section-toggle"
                  aria-expanded={isExpanded}
                  onClick={() => setExpanded((current) => current === section.id ? null : section.id)}
                >
                  <span>{section.label}</span>
                  <span aria-hidden="true">{isExpanded ? '⌃' : '⌄'}</span>
                </Button>

                {isExpanded && (
                  <div className="central-menu__items">
                    {section.items.map((item) => (
                      <Button
                        key={item.label}
                        variant="secondary"
                        className="central-menu__item"
                        disabled={item.disabled}
                        title={item.disabled ? 'Tela ainda não migrada' : undefined}
                        onClick={item.to ? () => go(item.to!) : undefined}
                      >
                        <span>{item.label}</span>
                        {item.disabled && <small>Em migração</small>}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="central-menu__signout">
          <Button variant="secondary" onClick={onSignOut}>Sair e deslogar</Button>
        </div>
      </div>
    </Dialog>
  );
}
