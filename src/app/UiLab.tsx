import { useState } from 'react';
import { Badge } from '../shared/ui/Badge';
import { Button } from '../shared/ui/Button';
import { Card } from '../shared/ui/Card';
import { Dialog } from '../shared/ui/Dialog';
import { EmptyState, Feedback, LoadingState } from '../shared/ui/Feedback';
import { Input } from '../shared/ui/Input';

export function UiLab() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <main className="ui-lab">
      <header className="ui-lab__hero">
        <Badge tone="info">Design System · Fase 3</Badge>
        <h1>Gestão 3.0 UI Lab</h1>
        <p>Referência visual e comportamental oficial do sistema.</p>
      </header>

      <section className="ui-lab__grid">
        <Card title="Botões" description="Hierarquia única de ações.">
          <div className="ui-row">
            <Button>Salvar</Button><Button variant="secondary">Cancelar</Button><Button variant="danger">Excluir</Button><Button variant="ghost">Mais opções</Button><Button loading>Salvando</Button>
          </div>
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

        <Card title="Modal" description="Cabeçalho, conteúdo e ações padronizados." actions={<Button size="sm" onClick={() => setDialogOpen(true)}>Abrir modal</Button>}>
          <p className="ui-muted">O mesmo contrato será usado em desktop e mobile.</p>
        </Card>
      </section>

      <Dialog open={dialogOpen} title="Novo lançamento" description="Exemplo do modal oficial." onClose={() => setDialogOpen(false)} onConfirm={() => setDialogOpen(false)}>
        <div className="ui-stack"><Input label="Descrição do lançamento" placeholder="Digite a descrição" /><Input label="Valor do lançamento" placeholder="R$ 0,00" /></div>
      </Dialog>
    </main>
  );
}
