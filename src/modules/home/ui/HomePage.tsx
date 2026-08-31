import { useNavigate } from 'react-router-dom';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { EmptyState, LoadingState } from '../../../shared/ui/Feedback';
import { useEngineeringOverview } from '../../engineering/ui/useEngineeringOverview';
import { useFinanceOverview } from '../../finance/ui/useFinanceOverview';
import { useHrBudgetOverview } from '../../hr/ui/useHrBudgetOverview';
import './home.css';

interface HomePageProps { company: CompanySummary; }

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });

function sum(values: readonly number[]): number { return values.reduce((total, value) => total + value, 0); }
function shortMoney(value: number): string { return currency.format(value); }
function dayOf(value: string): number { return Number(value.slice(8, 10)); }

function makePolyline(values: readonly number[], width = 620, height = 190): string {
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = Math.max(1, max - min);
  return values.map((value, index) => {
    const x = (index / Math.max(1, values.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function accumulate(values: number[]): void {
  for (let index = 1; index < values.length; index += 1) {
    values[index] = (values[index] ?? 0) + (values[index - 1] ?? 0);
  }
}

export function HomePage({ company }: HomePageProps) {
  const navigate = useNavigate();
  const go = (path: string): void => { void navigate(path); };
  const scope = { tenantId: company.tenantId, companyId: company.id };
  const finance = useFinanceOverview(scope);
  const hr = useHrBudgetOverview(scope);
  const engineering = useEngineeringOverview(scope);

  if (finance.status === 'idle' || finance.status === 'loading' || hr.status === 'idle' || hr.status === 'loading' || engineering.status === 'idle' || engineering.status === 'loading') return <LoadingState label="Carregando painel…" />;
  if (finance.status === 'error') return <EmptyState title="Painel indisponível" message={finance.errorMessage} />;
  if (hr.status === 'error') return <EmptyState title="Painel indisponível" message={hr.errorMessage} />;
  if (engineering.status === 'error') return <EmptyState title="Painel indisponível" message={engineering.errorMessage} />;
  if (finance.status !== 'ready' || hr.status !== 'ready' || engineering.status !== 'ready') return <EmptyState title="Painel indisponível" message="Os módulos ainda não concluíram o carregamento." />;

  const data = finance.data;
  const income = data.summary.find((item) => item.entryType === 'income');
  const expense = data.summary.find((item) => item.entryType === 'expense');
  const incomePlanned = income?.plannedAmount ?? 0;
  const incomeRealized = income?.realizedAmount ?? 0;
  const expensePlanned = expense?.plannedAmount ?? 0;
  const expenseRealized = expense?.realizedAmount ?? 0;
  const resultRealized = incomeRealized - expenseRealized;
  const bankBalance = sum(data.accountBalances.filter((item) => item.status === 'active').map((item) => item.currentBalance));
  const projectedBalance = bankBalance + incomePlanned - expensePlanned;

  const currentMonth = data.month.slice(0, 7);
  const monthEntries = data.entries.filter((item) => item.competenceMonth.slice(0, 7) === currentMonth);
  const incoming = Array.from({ length: 31 }, () => 0);
  const outgoing = Array.from({ length: 31 }, () => 0);
  monthEntries.forEach((item) => {
    const dayIndex = Math.max(0, Math.min(30, dayOf(item.dueDate) - 1));
    if (item.entryType === 'income') incoming[dayIndex] = (incoming[dayIndex] ?? 0) + item.amount;
    else outgoing[dayIndex] = (outgoing[dayIndex] ?? 0) + item.amount;
  });
  accumulate(incoming);
  accumulate(outgoing);
  const series = { incoming, outgoing, result: incoming.map((value, index) => value - (outgoing[index] ?? 0)) };

  const monthlyCompany = hr.data.monthlyBudget.find((item) => item.costCenterId === null);
  const budgetPlanned = monthlyCompany?.plannedTotal ?? sum(hr.data.monthlyBudget.map((item) => item.plannedTotal));
  const budgetRealized = monthlyCompany?.realizedTotal ?? sum(hr.data.monthlyBudget.map((item) => item.realizedTotal));
  const budgetPercent = budgetPlanned > 0 ? Math.min(100, Math.round((budgetRealized / budgetPlanned) * 100)) : 0;

  const recent = [...monthEntries].sort((a, b) => b.dueDate.localeCompare(a.dueDate)).slice(0, 5);
  const today = new Date().toISOString().slice(0, 10);
  const overdue = monthEntries.filter((item) => item.dueDate < today);
  const dueToday = monthEntries.filter((item) => item.dueDate === today);
  const overdueTotal = sum(overdue.map((item) => item.amount));
  const dueTodayTotal = sum(dueToday.map((item) => item.amount));

  return (
    <section className="dashboard-home" aria-label="Painel inicial">
      <div className="dashboard-toolbar">
        <div className="dashboard-period"><span aria-hidden="true">▣</span><strong>{monthLabel.format(new Date(`${data.month}T12:00:00`))}</strong></div>
        <div className="dashboard-updated">↻ Atualizado agora</div>
        <Button size="sm" onClick={() => go('/financeiro')}>Filtros</Button>
      </div>

      <Card>
        <div className="cashflow-card">
          <div className="cashflow-card__heading"><div><h1>Fluxo de caixa</h1><p>Entradas − Saídas − Resultado</p></div><div className="cashflow-segment"><button>Dia</button><button>Semana</button><button className="is-active">Mês</button></div></div>
          <div className="cashflow-content">
            <svg className="cashflow-chart" viewBox="0 0 620 190" role="img" aria-label="Evolução acumulada de entradas, saídas e resultado no mês">
              <g className="cashflow-grid"><line x1="0" y1="38" x2="620" y2="38"/><line x1="0" y1="95" x2="620" y2="95"/><line x1="0" y1="152" x2="620" y2="152"/></g>
              <polyline className="line-income" points={makePolyline(series.incoming)} />
              <polyline className="line-expense" points={makePolyline(series.outgoing)} />
              <polyline className="line-result" points={makePolyline(series.result)} />
            </svg>
            <div className="cashflow-legend"><span className="income">Entradas<strong>{shortMoney(incomeRealized)}</strong></span><span className="expense">Saídas<strong>{shortMoney(expenseRealized)}</strong></span><span className="result">Resultado<strong>{shortMoney(resultRealized)}</strong></span></div>
          </div>
        </div>
      </Card>

      <div className="dashboard-kpis">
        <Card><div className="kpi-card"><span>Saldo atual</span><small>Em contas</small><strong className="is-income">{shortMoney(bankBalance)}</strong><small>Disponível</small></div></Card>
        <Card><div className="kpi-card"><span>A receber</span><small>Previsto</small><strong className="is-income">{shortMoney(incomePlanned)}</strong><small>Competência atual</small></div></Card>
        <Card><div className="kpi-card"><span>A pagar</span><small>Previsto</small><strong className="is-expense">{shortMoney(expensePlanned)}</strong><small>Competência atual</small></div></Card>
        <Card><div className="kpi-card"><span>Saldo projetado</span><small>Após previstos</small><strong className="is-result">{shortMoney(projectedBalance)}</strong><small>Projeção do período</small></div></Card>
      </div>

      <Card><div className="result-strip"><div><span>↑</span><p>Receitas<strong>{shortMoney(incomeRealized)}</strong><small>Prev. {shortMoney(incomePlanned)}</small></p></div><div><span>↓</span><p>Despesas<strong>{shortMoney(expenseRealized)}</strong><small>Prev. {shortMoney(expensePlanned)}</small></p></div><div><span>=</span><p>Resultado<strong className={resultRealized < 0 ? 'is-expense' : 'is-income'}>{shortMoney(resultRealized)}</strong><small>Realizado</small></p></div></div></Card>

      <div className="dashboard-two-col">
        <Card title="Planejamento financeiro" description={monthLabel.format(new Date(`${data.month}T12:00:00`))}>
          <div className="planning"><div><span>Orçamento</span><strong>{shortMoney(budgetRealized)} / {shortMoney(budgetPlanned)}</strong><b>{budgetPercent}%</b></div><div className="planning-track"><i style={{ width: `${budgetPercent}%` }} /></div><Button onClick={() => go('/rh')} size="sm">Ver planejamento completo</Button></div>
        </Card>
        <Card title="Lançamentos recentes" actions={<Button variant="tertiary" size="sm" onClick={() => go('/financeiro')}>Ver todos</Button>}>
          <div className="recent-list">{recent.length === 0 ? <span className="ui-muted">Nenhum lançamento nesta competência.</span> : recent.map((item) => <div className="recent-item" key={item.installmentId}><span className={item.entryType === 'income' ? 'recent-icon income' : 'recent-icon expense'}>{item.entryType === 'income' ? '↑' : '↓'}</span><div><strong>{item.description}</strong><small>{item.installmentCount > 1 ? `Parcela ${item.installmentNumber}/${item.installmentCount}` : item.counterpartyName ?? 'Lançamento financeiro'}</small></div><b className={item.entryType === 'income' ? 'is-income' : 'is-expense'}>{shortMoney(item.amount)}</b></div>)}</div>
        </Card>
      </div>

      <div className="dashboard-two-col dashboard-bottom">
        <Card title="Acesso rápido"><div className="quick-actions"><button onClick={() => go('/financeiro')}>＋<span>Nova entrada</span></button><button onClick={() => go('/financeiro')}>−<span>Nova saída</span></button><button onClick={() => go('/financeiro')}>⇄<span>Transferência</span></button><button onClick={() => go('/financeiro')}>▤<span>Contas do mês</span></button><button onClick={() => go('/financeiro')}>•••<span>Mais opções</span></button></div></Card>
        <Card title="Notificações" actions={<Button variant="tertiary" size="sm" onClick={() => go('/financeiro')}>Ver todas</Button>}><div className="notification-list"><button onClick={() => go('/financeiro')}><span>▣</span><div><strong>{overdue.length} títulos com vencimento anterior</strong><small>{shortMoney(overdueTotal)}</small></div><b>›</b></button><button onClick={() => go('/financeiro')}><span>◷</span><div><strong>{dueToday.length} títulos vencem hoje</strong><small>{shortMoney(dueTodayTotal)}</small></div><b>›</b></button></div></Card>
      </div>
    </section>
  );
}
