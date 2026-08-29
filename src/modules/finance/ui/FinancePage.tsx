import type { CompanySummary } from '../../platform/domain/AccessContext';
import { Card } from '../../../shared/ui/Card';
import { EmptyState, LoadingState } from '../../../shared/ui/Feedback';
import { useFinanceOverview } from './useFinanceOverview';

interface FinancePageProps {
  company: CompanySummary;
}

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function formatMonth(value: string): string {
  const [year, month] = value.split('-');
  return `${month}/${year}`;
}

export function FinancePage({ company }: FinancePageProps) {
  const overview = useFinanceOverview({
    tenantId: company.tenantId,
    companyId: company.id,
  });

  if (overview.status === 'idle' || overview.status === 'loading') {
    return <LoadingState label="Carregando financeiro…" />;
  }

  if (overview.status === 'error') {
    return (
      <EmptyState
        title="Financeiro indisponível"
        message={overview.errorMessage}
      />
    );
  }

  const income = overview.data.summary.find((item) => item.entryType === 'income');
  const expense = overview.data.summary.find((item) => item.entryType === 'expense');

  return (
    <section className="finance-overview" aria-labelledby="finance-title">
      <div className="finance-overview__heading">
        <div>
          <span className="ui-muted">Competência {formatMonth(overview.data.month)}</span>
          <h1 id="finance-title">Financeiro</h1>
        </div>
        <p className="ui-muted">
          Resumo operacional, contas e cartões da empresa selecionada.
        </p>
      </div>

      <div className="finance-overview__cards">
        <Card title="Receitas" description="Planejado × realizado no mês">
          <dl className="finance-metrics">
            <div><dt>Planejado</dt><dd>{currency.format(income?.plannedAmount ?? 0)}</dd></div>
            <div><dt>Realizado</dt><dd>{currency.format(income?.realizedAmount ?? 0)}</dd></div>
            <div><dt>Pendente</dt><dd>{currency.format(income?.pendingAmount ?? 0)}</dd></div>
          </dl>
        </Card>

        <Card title="Despesas" description="Inclui parcelas de cartão na competência">
          <dl className="finance-metrics">
            <div><dt>Planejado</dt><dd>{currency.format(expense?.plannedAmount ?? 0)}</dd></div>
            <div><dt>Realizado</dt><dd>{currency.format(expense?.realizedAmount ?? 0)}</dd></div>
            <div><dt>Pendente</dt><dd>{currency.format(expense?.pendingAmount ?? 0)}</dd></div>
          </dl>
        </Card>
      </div>

      <div className="finance-overview__cards">
        <Card title="Contas e bancos" description="Saldo atual derivado do razão financeiro">
          {overview.data.accountBalances.length === 0 ? (
            <p className="ui-muted">Nenhuma conta financeira cadastrada.</p>
          ) : (
            <div className="finance-list">
              {overview.data.accountBalances.map((account) => (
                <div className="finance-list__row" key={account.accountId}>
                  <span>{account.name}</span>
                  <strong>{currency.format(account.currentBalance)}</strong>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Cartões" description="Limite total, comprometido e disponível">
          {overview.data.cardLimits.length === 0 ? (
            <p className="ui-muted">Nenhum cartão cadastrado.</p>
          ) : (
            <div className="finance-list">
              {overview.data.cardLimits.map((card) => (
                <div className="finance-list__group" key={card.cardId}>
                  <strong>{card.name}</strong>
                  <div className="finance-list__row"><span>Limite</span><span>{currency.format(card.creditLimit)}</span></div>
                  <div className="finance-list__row"><span>Comprometido</span><span>{currency.format(card.committedAmount)}</span></div>
                  <div className="finance-list__row"><span>Disponível</span><span>{currency.format(card.availableLimit)}</span></div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
