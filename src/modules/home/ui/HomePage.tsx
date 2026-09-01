import { useNavigate } from 'react-router-dom';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { EmptyState, LoadingState } from '../../../shared/ui/Feedback';
import { useHomeOverview } from './useHomeOverview';
import './home.css';

interface HomePageProps { companies: readonly CompanySummary[]; }

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
function money(value: number): string { return currency.format(value); }
function sum(values: readonly number[]): number { return values.reduce((total, value) => total + value, 0); }
function isoDate(value: Date): string { return value.toISOString().slice(0, 10); }
function polyline(values: readonly number[], width = 620, height = 170): string {
  const min = Math.min(0, ...values); const max = Math.max(0, ...values); const range = Math.max(1, max - min);
  return values.map((value, index) => `${((index / Math.max(1, values.length - 1)) * width).toFixed(1)},${(height - ((value - min) / range) * height).toFixed(1)}`).join(' ');
}

export function HomePage({ companies }: HomePageProps) {
  const navigate = useNavigate();
  const go = (path: string): void => { void navigate(path); };
  const overview = useHomeOverview(companies);

  if (overview.status === 'idle' || overview.status === 'loading') return <LoadingState label="Carregando painel…" />;
  if (overview.status === 'error') return <EmptyState title="Painel indisponível" message={overview.errorMessage} />;
  if (!overview.data) return <EmptyState title="Painel indisponível" message="Os dados da visão consolidada ainda não estão disponíveis." />;

  const data = overview.data;
  const today = new Date().toISOString().slice(0, 10);
  const rangeDates = Array.from({ length: 30 }, (_, offset) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - offset));
    return isoDate(date);
  });
  const movementByDate = new Map<string, number>();
  data.balanceMovements.forEach((item) => movementByDate.set(item.movementOn, (movementByDate.get(item.movementOn) ?? 0) + item.signedAmount));
  const rangeMovementTotal = sum(rangeDates.map((date) => movementByDate.get(date) ?? 0));
  let runningBalance = data.bankBalance - rangeMovementTotal;
  const balanceSeries = rangeDates.map((date) => {
    runningBalance += movementByDate.get(date) ?? 0;
    return runningBalance;
  });
  const dueToday = data.entries.filter((item) => item.dueDate === today && item.entryType === 'expense');
  const receiveToday = data.entries.filter((item) => item.dueDate === today && item.entryType === 'income');
  const overdue = data.entries.filter((item) => item.dueDate < today && item.entryType === 'expense');
  const next7Limit = new Date(); next7Limit.setDate(next7Limit.getDate() + 7);
  const next7 = data.entries.filter((item) => item.dueDate > today && item.dueDate <= next7Limit.toISOString().slice(0, 10) && item.entryType === 'expense');
  const todayResult = sum(receiveToday.map((item) => item.amount)) - sum(dueToday.map((item) => item.amount));
  const costCenterBudgets = data.budgets.slice(0, 6);
  const recent = [...data.entries].sort((a, b) => b.dueDate.localeCompare(a.dueDate)).slice(0, 5);

  return (
    <section className="home-sequence" aria-label="Painel inicial">
      <div className="home-sequence__toolbar">
        <div><span className="ui-muted">Competência</span><strong>{monthLabel.format(new Date(`${data.month}T12:00:00`))}</strong></div>
        <Button size="sm" onClick={() => go('/')}>Atualizar</Button>
      </div>

      <Card>
        <div className="home-actions">
          <Button onClick={() => go('/financeiro?action=new-entry')}>＋ Lançamento</Button>
          <Button variant="secondary" onClick={() => go('/financeiro?tab=lancamentos')}>Contas do mês</Button>
        </div>
      </Card>

      <Card>
        <div className="balance-card">
          <span className="ui-muted">Saldo disponível</span>
          <strong className="balance-card__value">{money(data.bankBalance)}</strong>
          <div className="balance-chart-head"><div><strong>Evolução do saldo</strong><span>Últimos 30 dias</span></div></div>
          <svg className="balance-chart" viewBox="0 0 620 170" role="img" aria-label="Evolução real do saldo nos últimos 30 dias">
            <g className="balance-chart__grid"><line x1="0" y1="42" x2="620" y2="42"/><line x1="0" y1="85" x2="620" y2="85"/><line x1="0" y1="128" x2="620" y2="128"/></g>
            <polyline className="balance-chart__line" points={polyline(balanceSeries)} />
          </svg>
          <div className="balance-range" aria-label="Período do gráfico">
            <Button size="sm" variant="secondary">7 dias</Button>
            <Button size="sm" variant="secondary">15 dias</Button>
            <Button size="sm" aria-pressed="true">30 dias</Button>
            <Button size="sm" variant="secondary">90 dias</Button>
            <Button size="sm" variant="secondary">1 ano</Button>
          </div>
          <div className="balance-card__footer"><span>Saldo atual</span><strong>{money(data.bankBalance)}</strong></div>
        </div>
      </Card>

      <Card title="Orçamento do mês" actions={<Button size="sm" onClick={() => go('/rh?tab=orcamento&action=budget-plan')}>＋ Definir orçamento</Button>}>
        <div className="budget-list">
          {costCenterBudgets.length === 0 ? <span className="ui-muted">Nenhum orçamento criado nesta competência.</span> : costCenterBudgets.map((item) => {
            const available = item.plannedTotal - item.realizedTotal;
            return <Button variant="secondary" className="budget-item" key={`${item.companyId}-${item.costCenterId ?? 'geral'}`} onClick={() => go('/rh?tab=orcamento')}><div><strong>{item.costCenterName ?? 'Geral'}</strong><small>{companies.length > 1 ? item.companyName : 'Orçamento mensal'}</small></div><div><strong>{money(available)}</strong><small>disponível</small></div><span aria-hidden="true">›</span></Button>;
          })}
        </div>
      </Card>

      <Card title="Resumo diário" actions={<Button size="sm" variant="secondary" onClick={() => go('/rh?tab=orcamento&action=budget-plan')}>Planejar</Button>}>
        <div className="daily-summary">
          <div><span>Saldo em contas</span><strong>{money(data.bankBalance)}</strong></div>
          <div className="is-danger"><span>A pagar hoje</span><strong>{money(sum(dueToday.map((item) => item.amount)))}</strong></div>
          <div className="is-success"><span>A receber hoje</span><strong>{money(sum(receiveToday.map((item) => item.amount)))}</strong></div>
          <div className="is-danger"><span>Vencidas</span><strong>{money(sum(overdue.map((item) => item.amount)))}</strong></div>
          <div className="is-info"><span>Próximos 7 dias</span><strong>{money(sum(next7.map((item) => item.amount)))}</strong></div>
          <div className={todayResult < 0 ? 'is-danger' : 'is-success'}><span>Resultado do dia</span><strong>{money(todayResult)}</strong></div>
        </div>
      </Card>

      <Card title="Lançamentos recentes" actions={<Button variant="tertiary" size="sm" onClick={() => go('/financeiro?tab=lancamentos')}>Ver todos</Button>}>
        <div className="recent-list">{recent.length === 0 ? <span className="ui-muted">Nenhum lançamento nesta competência.</span> : recent.map((item) => <div className="recent-item" key={`${item.companyName}-${item.installmentId}`}><span className={item.entryType === 'income' ? 'recent-icon income' : 'recent-icon expense'}>{item.entryType === 'income' ? '↑' : '↓'}</span><div><strong>{item.description}</strong><small>{companies.length > 1 ? item.companyName : item.counterpartyName ?? 'Lançamento financeiro'}</small></div><b className={item.entryType === 'income' ? 'is-income' : 'is-expense'}>{money(item.amount)}</b></div>)}</div>
      </Card>
    </section>
  );
}
