import type { CompanySummary } from '../../platform/domain/AccessContext';
import { Card } from '../../../shared/ui/Card';
import { EmptyState, LoadingState } from '../../../shared/ui/Feedback';
import { useEngineeringOverview } from '../../engineering/ui/useEngineeringOverview';
import { useFinanceOverview } from '../../finance/ui/useFinanceOverview';
import { useHrBudgetOverview } from '../../hr/ui/useHrBudgetOverview';
import './home.css';

interface HomePageProps {
  company: CompanySummary;
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function HomePage({ company }: HomePageProps) {
  const scope = { tenantId: company.tenantId, companyId: company.id };
  const finance = useFinanceOverview(scope);
  const hr = useHrBudgetOverview(scope);
  const engineering = useEngineeringOverview(scope);

  if (
    finance.status === 'idle' || finance.status === 'loading' ||
    hr.status === 'idle' || hr.status === 'loading' ||
    engineering.status === 'idle' || engineering.status === 'loading'
  ) {
    return <LoadingState label="Carregando visão geral…" />;
  }

  if (finance.status === 'error') {
    return <EmptyState title="Visão geral indisponível" message={finance.errorMessage} />;
  }
  if (hr.status === 'error') {
    return <EmptyState title="Visão geral indisponível" message={hr.errorMessage} />;
  }
  if (engineering.status === 'error') {
    return <EmptyState title="Visão geral indisponível" message={engineering.errorMessage} />;
  }

  if (finance.status !== 'ready' || hr.status !== 'ready' || engineering.status !== 'ready') {
    return <EmptyState title="Visão geral indisponível" message="Os módulos ainda não concluíram o carregamento." />;
  }

  const financeData = finance.data;
  const hrData = hr.data;
  const engineeringData = engineering.data;

  const income = financeData.summary.find((item) => item.entryType === 'income');
  const expense = financeData.summary.find((item) => item.entryType === 'expense');
  const bankBalance = sum(financeData.accountBalances.filter((item) => item.status === 'active').map((item) => item.currentBalance));

  const monthlyCompany = hrData.monthlyBudget.find((item) => item.costCenterId === null);
  const budgetPlanned = monthlyCompany?.plannedTotal ?? sum(hrData.monthlyBudget.map((item) => item.plannedTotal));
  const budgetRealized = monthlyCompany?.realizedTotal ?? sum(hrData.monthlyBudget.map((item) => item.realizedTotal));

  const contractValue = sum(engineeringData.contracts.map((item) => item.updatedContractValue));
  const measuredValue = sum(engineeringData.contracts.map((item) => item.measuredNet));
  const contractBalance = sum(engineeringData.contracts.map((item) => item.grossBalance));

  return (
    <section className="home-overview" aria-labelledby="home-title">
      <div className="home-overview__heading">
        <div>
          <span className="ui-muted">Empresa ativa</span>
          <h1 id="home-title">Visão geral</h1>
        </div>
        <p className="ui-muted">Financeiro, RH, orçamento e Engenharia consolidados no mesmo contexto empresarial.</p>
      </div>

      <div className="home-overview__grid">
        <Card title="Saldo em contas" description="Contas financeiras ativas">
          <strong className="home-kpi">{currency.format(bankBalance)}</strong>
        </Card>
        <Card title="Entradas do mês" description="Previsto × realizado">
          <div className="home-pair"><span>Prev. {currency.format(income?.plannedAmount ?? 0)}</span><strong>{currency.format(income?.realizedAmount ?? 0)}</strong></div>
        </Card>
        <Card title="Saídas do mês" description="Previsto × realizado">
          <div className="home-pair"><span>Prev. {currency.format(expense?.plannedAmount ?? 0)}</span><strong>{currency.format(expense?.realizedAmount ?? 0)}</strong></div>
        </Card>
        <Card title="Orçamento da competência" description="Planejado × realizado, sem dupla contagem">
          <div className="home-pair"><span>Prev. {currency.format(budgetPlanned)}</span><strong>{currency.format(budgetRealized)}</strong></div>
        </Card>
        <Card title="Contratos de Engenharia" description="Valor atualizado e medido">
          <div className="home-pair"><span>Contratado {currency.format(contractValue)}</span><strong>Medido {currency.format(measuredValue)}</strong></div>
        </Card>
        <Card title="Saldo contratual" description="Saldo bruto dos contratos">
          <strong className="home-kpi">{currency.format(contractBalance)}</strong>
        </Card>
      </div>
    </section>
  );
}
