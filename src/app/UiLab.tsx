import { useState } from 'react';
import { Badge } from '../shared/ui/Badge';
import { Button } from '../shared/ui/Button';
import { Card } from '../shared/ui/Card';
import { Dialog } from '../shared/ui/Dialog';
import { EmptyState, Feedback, LoadingState } from '../shared/ui/Feedback';
import { Input } from '../shared/ui/Input';
import { Tabs } from '../shared/ui/Tabs';

const tabItems = [
  { id: 'overview', label: 'Visão Geral' },
  { id: 'employees', label: 'Colaboradores', count: 128 },
  { id: 'closings', label: 'Fechamentos', count: 8 },
  { id: 'benefits', label: 'Benefícios' },
  { id: 'reports', label: 'Relatórios', disabled: true },
];

export function UiLab() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <main className="ui-lab">
      <header className="ui-lab__hero">
        <Badge tone="info">Design System · Oficial</Badge>
        <h1>Gestão 3.0 UI Lab</h1>
        <p>Referência visual e comportamental obrigatória do sistema.</p>
      </header>

      <section className="ui-lab__grid">
        <Card title="Botões" description="Variantes e hierarquia únicas de ações.">
          <div className="ui-row">
            <Button>Principal</Button>
            <Button variant="secondary">Secundário</Button>
            <Button variant="tertiary">Terciário</Button>
            <Button variant="success">Sucesso</Button>
            <Button variant="danger">Excluir</Button>
            <Button disabled>Desabilitado</Button>
            <Button loading>Salvando</Button>
          </div>
        </Card>

        <Card title="Abas" description="Ativa, inativa, contador, desabilitada e rolagem horizontal.">
          <Tabs items={tabItems} activeId={activeTab} onChange={setActiveTab} ariaLabel="Exemplo de abas" />
          <p className="ui-muted" style={{ marginTop: 14 }}>Conteúdo ativo: {tabItems.find((item) => item.id === activeTab)?.label}</p>
        </Card>

        <Card title="Campos" description="Label, ajuda, erro e estado desabilitado padronizados.">
          <div className="ui-stack">
            <Input label="Descrição" placeholder="Ex.: Café da manhã" hint="Informe uma descrição objetiva." />
            <Input label="Valor" placeholder="R$ 0,00" error="Valor obrigatório." />
            <Input label="Empresa" value="Empresa selecionada" disabled readOnly />
          </div>
        </Card>

        <Card title="Status" description="Semântica de status consistente em todo o sistema.">
          <div className="ui-row"><Badge>Neutro</Badge><Badge tone="success">Pago</Badge><Badge tone="warning">Pendente</Badge><Badge tone="danger">Vencido</Badge><Badge tone="info">Em análise</Badge></div>
        </Card>

        <Card title="Feedback" description="Mensagens sem expor detalhes internos.">
          <div className="ui-stack"><Feedback tone="success" title="Salvo com sucesso" message="Os dados foram atualizados." /><Feedback tone="warning" title="Atenção" message="Revise os campos antes de continuar." /><Feedback tone="danger" title="Não foi possível salvar" message="Tente novamente ou contate o administrador." /></div>
        </Card>

        <Card title="Estados de conteúdo" description="Loading e vazio com padrão único.">
          <div className="ui-stack"><LoadingState /><EmptyState title="Nenhum registro encontrado" message="Ajuste os filtros ou cadastre um novo item." /></div>
        </Card>

        <Card title="Modal fullscreen" description="Voltar e Fechar fixos no topo; Salvar fixo quando necessário." actions={<Button size="sm" onClick={() => setDialogOpen(true)}>Abrir modal</Button>}>
          <p className="ui-muted">O mesmo contrato é obrigatório em celular, tablet e computador.</p>
        </Card>
      </section>

      <Dialog open={dialogOpen} title="Novo lançamento" description="Exemplo do modal fullscreen oficial." onClose={() => setDialogOpen(false)} onConfirm={() => setDialogOpen(false)}>
        <div className="ui-stack"><Input label="Descrição do lançamento" placeholder="Digite a descrição" /><Input label="Valor do lançamento" placeholder="R$ 0,00" /></div>
      </Dialog>
    </main>
  );
}
