import { useMemo, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import { Card } from '../../../shared/ui/Card';
import { EmptyState, LoadingState } from '../../../shared/ui/Feedback';
import { Tabs } from '../../../shared/ui/Tabs';
import { useHrBudgetOverview } from './useHrBudgetOverview';
import './hr.css';

interface HrBudgetPageProps {
  company: CompanySummary;
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function HrBudgetPage({ company }: HrBudgetPageProps) {
  const [activeTab, setActiveTab] = useState('rh');
  const overview = useHrBudgetOverview({ tenantId: company.tenantId, companyId: company.id });

  const tabs = useMemo(() => [
    { id: 'rh', label: 'RH' },
    { id: 'orcamento', label: 'Orçamento' },
  ], []);

  if (overview.status === 'idle' || overview.status === 'loading') {
    return <LoadingState label="Carregando RH e orçamento…" />;
  }

  if (overview.status === 'error' || overview.data === null) {
    return <EmptyState title="RH indisponível" message={overview.errorMessage ?? 'Não foi possível carregar o módulo.'} />;
  }

  const { salaryProjection, monthlyBudget, annualBudget, competenceMonth } = overview.data;
  const plannedSalary = sum(salaryProjection.map((item) => item.plannedSalary));
  const realizedSalary = sum(salaryProjection.map((item) => item.realizedSalary));
  const monthlyPlanned = sum(monthlyBudget.map((item) => item.plannedTotal));
  const monthlyRealized = sum(monthlyBudget.map((item) => item.realizedTotal));
  const annualPlanned = sum(annualBudget.map((item) => item.plannedTotal));
  const annualRealized = sum(annualBudget.map((item) => item.realizedTotal));

  return (
    <section className="hr-overview" aria-labelledby="hr-title">
      <div className="hr-overview__heading">
        <div>
          <span className="ui-muted">Competência {competenceMonth.slice(5, 7)}/{competenceMonth.slice(0, 4)}</span>
          <h1 id="hr-title">RH + Orçamento</h1>
        </div>
        <p className="ui-muted">Folha e planejamento da empresa ativa, com Previsto × Realizado.</p>
      </div>

      <Tabs items={tabs} activeId={activeTab} onChange={setActiveTab} ariaLabel="RH e orçamento" />

      {activeTab === 'rh' ? (
        <div className="hr-overview__content" role="tabpanel">
          <div className="hr-overview__cards">
            <Card title="Salário previsto" description="Remuneração vigente × alocação">
              <strong className="hr-kpi">{currency.format(plannedSalary)}</strong>
            </Card>
            <Card title="Salário realizado" description="Fechamentos concluídos na competência">
              <strong className="hr-kpi">{currency.format(realizedSalary)}</strong>
            </Card>
            <Card title="Vínculos projetados" description="Contratos presentes na competência">
              <strong className="hr-kpi">{salaryProjection.length}</strong>
            </Card>
          </div>

          <Card title="Colaboradores na competência" description="Previsto × Realizado por vínculo e alocação">
            {salaryProjection.length === 0 ? (
              <p className="ui-muted">Nenhum vínculo projetado para esta competência.</p>
            ) : (
              <div className="hr-list">
                {salaryProjection.map((item) => (
                  <div className="hr-list__row" key={`${item.employmentContractId}-${item.costCenterId ?? 'geral'}`}>
                    <div>
                      <strong>{item.employeeName}</strong>
                      <span className="ui-muted">Alocação {item.allocationPercent}%</span>
                    </div>
                    <div className="hr-list__values">
                      <span>Prev. {currency.format(item.plannedSalary)}</span>
                      <span>Real. {currency.format(item.realizedSalary)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : (
        <div className="hr-overview__content" role="tabpanel">
          <div className="hr-overview__cards">
            <Card title="Planejado no mês" description="Manual + salários previstos">
              <strong className="hr-kpi">{currency.format(monthlyPlanned)}</strong>
            </Card>
            <Card title="Realizado no mês" description="Financeiro + folha, sem dupla contagem">
              <strong className="hr-kpi">{currency.format(monthlyRealized)}</strong>
            </Card>
            <Card title="Disponível no mês" description="Planejado menos realizado">
              <strong className="hr-kpi">{currency.format(monthlyPlanned - monthlyRealized)}</strong>
            </Card>
          </div>

          <Card title="Orçamento por obra / centro de custo" description="Resumo da competência atual">
            {monthlyBudget.length === 0 ? (
              <p className="ui-muted">Nenhum orçamento encontrado para esta competência.</p>
            ) : (
              <div className="hr-list">
                {monthlyBudget.map((item, index) => (
                  <div className="hr-list__row" key={item.costCenterId ?? `geral-${index}`}>
                    <div><strong>{item.costCenterName ?? 'Geral da empresa'}</strong></div>
                    <div className="hr-list__values">
                      <span>Prev. {currency.format(item.plannedTotal)}</span>
                      <span>Real. {currency.format(item.realizedTotal)}</span>
                      <span>Saldo {currency.format(item.varianceAmount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Consolidado anual" description="Competências do ano da empresa ativa">
            <dl className="hr-summary">
              <div><dt>Previsto</dt><dd>{currency.format(annualPlanned)}</dd></div>
              <div><dt>Realizado</dt><dd>{currency.format(annualRealized)}</dd></div>
              <div><dt>Saldo</dt><dd>{currency.format(annualPlanned - annualRealized)}</dd></div>
            </dl>
          </Card>
        </div>
      )}
    </section>
  );
}
