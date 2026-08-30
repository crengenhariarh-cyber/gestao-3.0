import { useMemo, useState } from 'react';
import { Card } from '../../../shared/ui/Card';
import { Tabs } from '../../../shared/ui/Tabs';

export function EngineeringPage() {
  const [activeTab, setActiveTab] = useState('contratos');
  const tabs = useMemo(() => [
    { id: 'contratos', label: 'Contratos' },
    { id: 'medicoes', label: 'Medições' },
    { id: 'producao', label: 'Produção' },
    { id: 'aditivos', label: 'Aditivos' },
    { id: 'provisorios', label: 'Provisórios' },
  ], []);

  const content = {
    contratos: ['Contratos', 'Contratos por obra, serviços, quantidades e saldo contratual.'],
    medicoes: ['Medições', 'Medições por competência, retenções, fechamento e vínculo financeiro.'],
    producao: ['Produção', 'Produção por colaborador, obra, estrutura e competência.'],
    aditivos: ['Aditivos', 'Aditivos vinculados ao contrato, com rastreabilidade e valores.'],
    provisorios: ['Provisórios', 'Provisórios editáveis com conversão posterior em contrato ou aditivo.'],
  } as const;
  const [title, description] = content[activeTab as keyof typeof content];

  return (
    <section className="engineering-overview" aria-labelledby="engineering-title">
      <div className="engineering-overview__heading">
        <div><span className="ui-muted">Módulo operacional</span><h1 id="engineering-title">Engenharia</h1></div>
        <p className="ui-muted">Contratos, medições, produção, provisórios e aditivos no mesmo padrão de navegação.</p>
      </div>
      <Tabs items={tabs} activeId={activeTab} onChange={setActiveTab} ariaLabel="Seções da engenharia" />
      <div className="engineering-workspace" role="tabpanel" tabIndex={0} aria-label={`${title} — área de trabalho rolável`}>
        <div className="engineering-workspace__canvas">
          <Card title={title} description={description}>
            <p className="ui-muted">A camada visual está preparada para consumir os casos de uso e relatórios já consolidados no domínio da Engenharia.</p>
          </Card>
        </div>
      </div>
    </section>
  );
}
