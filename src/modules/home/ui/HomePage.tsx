import { useNavigate } from 'react-router-dom';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { EmptyState, LoadingState } from '../../../shared/ui/Feedback';
import { useHomeOverview } from './useHomeOverview';
import './home.css';

interface HomePageProps { companies: readonly CompanySummary[]; }

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
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
  const rangeDates = Array.from({ length: 30 }, (_, offset) => { const date = new Date(); date.setDate(date.getDate() - (29 - offset)); return isoDate(date); });
  const movementByDate = new Map<string, number>();
  data.balanceMovements.forEach((item) => movementByDate.set(item.movementOn, (movementByDate.get(item.movementOn) ?? 0) + item.signedAmount));
  const rangeMovementTotal = sum(rangeDates.map((date) => movementByDate.get(date) ?? 0));
  let runningBalance = data.bankBalance - rangeMovementTotal;
  const balanceSeries = rangeDates.map((date) => { runningBalance += movementByDate.get(date) ?? 0; return runningBalance; });
  const dueToday = data.entries.filter((item) => item.dueDate === today && item.entryType === 'expense');
  const receiveToday = data.entries.filter((item) => item.dueDate === today && item.entryType === 'income');
  const overdue = data.entries.filter((item) => item.dueDate < today && item.entryType === 'expense');
  const next7Limit = new Date(); next7Limit.setDate(next7Limit.getDate() + 7);
  const next7 = data.entries.filter((item) => item.dueDate > today && item.dueDate <= next7Limit.toISOString().slice(0, 10) && item.entryType === 'expense');
  const todayResult = sum(receiveToday.map((item) => item.amount)) - sum(dueToday.map((item) => item.amount));
  const budgets = data.budgets.slice(0, 6);
  const accounts = data.bankAccounts.slice(0, 6);
  const upcoming = [...data.entries].filter((item) => item.entryType === 'expense' && item.dueDate >= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 4);
  const flowResult = data.incomeRealized - data.expenseRealized;

  return (
    <section className="home-approved" aria-label="Painel inicial">
      <div className="home-hero">
        <div><strong>Olá! Bom dia</strong><span>{new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date())}</span></div>
        <Button onClick={() => go('/')}>Atualizar</Button>
      </div>

      <Card className="home-quick-card"><div className="home-actions"><Button onClick={() => go('/financeiro?action=new-entry')}>＋ Lançamento</Button><Button variant="secondary" onClick={() => go('/contas-do-mes')}>▣ Contas do mês</Button></div></Card>

      <Card className="home-balance-card">
        <div className="balance-card"><span className="home-eyebrow">Saldo disponível</span><strong className="balance-card__value">{money(data.bankBalance)}</strong><div className="balance-chart-head"><strong>Evolução do saldo</strong><span>Últimos 30 dias</span></div><svg className="balance-chart" viewBox="0 0 620 170" role="img" aria-label="Evolução real do saldo nos últimos 30 dias"><g className="balance-chart__grid"><line x1="0" y1="42" x2="620" y2="42"/><line x1="0" y1="85" x2="620" y2="85"/><line x1="0" y1="128" x2="620" y2="128"/></g><polyline className="balance-chart__line" points={polyline(balanceSeries)} /></svg><div className="balance-legend"><span>● Entradas</span><span>● Saídas</span><span>● Saldo</span></div><div className="balance-range"><Button size="sm">7 dias</Button><Button size="sm">15 dias</Button><Button size="sm" variant="secondary" aria-pressed="true">30 dias</Button><Button size="sm">90 dias</Button><Button size="sm">1 ano</Button></div><div className="balance-card__footer"><span>Saldo atual</span><strong>{money(data.bankBalance)}</strong></div></div>
      </Card>

      <div className="home-two-column">
        <Card title="Orçamento do mês" actions={<Button size="sm" onClick={() => go('/rh?tab=orcamento&action=budget-plan')}>＋ Definir orçamento</Button>}><div className="budget-list">{budgets.length === 0 ? <span className="ui-muted">Nenhum orçamento criado nesta competência.</span> : budgets.map((item) => { const available = item.plannedTotal - item.realizedTotal; return <button className="budget-tile" key={`${item.companyId}-${item.costCenterId ?? 'geral'}`} onClick={() => go('/rh?tab=orcamento')}><div><strong>{item.costCenterName ?? 'Geral'}</strong><small>{item.companyName}</small></div><div><strong>{money(available)}</strong><small>disponível</small></div><span>✎</span></button>; })}</div></Card>

        <Card title="Resumo diário" actions={<Button size="sm" onClick={() => go('/rh?tab=orcamento&action=budget-plan')}>▦ Planejar</Button>}><div className="daily-summary"><div><span>Saldo em contas</span><strong>{money(data.bankBalance)}</strong></div><div className="is-danger"><span>A pagar hoje</span><strong>{money(sum(dueToday.map((item) => item.amount)))}</strong></div><div className="is-success"><span>A receber hoje</span><strong>{money(sum(receiveToday.map((item) => item.amount)))}</strong></div><div className="is-danger"><span>Vencidas</span><strong>{money(sum(overdue.map((item) => item.amount)))}</strong></div><div className="is-info"><span>Próximos 7 dias</span><strong>{money(sum(next7.map((item) => item.amount)))}</strong></div><div className={todayResult < 0 ? 'is-danger' : 'is-success'}><span>Resultado do dia</span><strong>{money(todayResult)}</strong></div></div></Card>
      </div>

      <div className="home-two-column">
        <Card><div className="section-head"><div><span>MOVIMENTAÇÃO</span><h2>Fluxo do mês</h2></div><Button variant="secondary" size="sm" onClick={() => go('/financeiro')}>Ver análise →</Button></div><div className="flow-grid"><div className="is-success"><span>Entradas</span><strong>{money(data.incomeRealized)}</strong></div><div className="is-danger"><span>Saídas</span><strong>{money(data.expenseRealized)}</strong></div><div className="flow-result"><span>Resultado</span><strong>{money(flowResult)}</strong></div></div></Card>
        <Card><div className="section-head"><div><span>DISPONIBILIDADE</span><h2>Contas bancárias</h2></div><Button variant="secondary" size="sm" onClick={() => go('/bancos')}>Ver todas →</Button></div><div className="bank-strip">{accounts.length === 0 ? <span className="ui-muted">Nenhuma conta exibida no painel.</span> : accounts.map((account) => <button key={`${account.companyId}-${account.accountId}`} className="bank-tile" onClick={() => go('/bancos')}><span>▥</span><small>{account.name}</small><strong>{money(account.currentBalance)}</strong></button>)}</div></Card>
      </div>

      <Card><div className="section-head"><div><span>PRÓXIMOS DIAS</span><h2>Vencimentos</h2></div><Button variant="secondary" size="sm" onClick={() => go('/contas-do-mes')}>Ver todos →</Button></div><div className="due-grid">{upcoming.length === 0 ? <span className="ui-muted">Nenhum vencimento próximo.</span> : upcoming.map((item) => { const date = new Date(`${item.dueDate}T12:00:00`); return <button key={`${item.companyName}-${item.installmentId}`} className="due-tile" onClick={() => go('/contas-do-mes')}><div className="due-date"><strong>{date.getDate()}</strong><small>{date.toLocaleDateString('pt-BR',{month:'short'}).replace('.','').toUpperCase()}</small></div><div><strong>{item.description}</strong><small>{item.companyName}</small></div><b>{money(item.amount)}</b></button>; })}</div></Card>

      <div className="home-two-column">
        <Card><div className="section-head"><div><span>CRÉDITO</span><h2>Cartões</h2></div></div><div className="cards-actions"><Button onClick={() => go('/financeiro?tab=cartoes')}>☷ Escolher</Button><Button variant="secondary" onClick={() => go('/financeiro?tab=cartoes')}>Ver todos →</Button></div><div className="cards-empty">▤ <span>Escolha os cartões para acompanhar.</span></div></Card>
        <Card><div className="section-head"><div><span>ATALHOS</span><h2>Ações rápidas</h2></div></div><div className="shortcut-list"><button onClick={() => go('/contas-do-mes')}>▣ <span>Contas do mês</span><b>›</b></button><button onClick={() => go('/engenharia')}>⊕ <span>Nova medição</span><b>›</b></button><button onClick={() => go('/bancos')}>⇄ <span>Transferências</span><b>›</b></button><button onClick={() => go('/financeiro')}>▥ <span>Relatórios</span><b>›</b></button></div></Card>
      </div>
    </section>
  );
}
