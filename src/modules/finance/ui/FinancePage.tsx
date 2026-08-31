import { useMemo, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Dialog } from '../../../shared/ui/Dialog';
import { EmptyState, Feedback, LoadingState } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';
import { Tabs } from '../../../shared/ui/Tabs';
import { useFinanceOperations } from './useFinanceOperations';
import { useFinanceOverview } from './useFinanceOverview';
import './finance.css';

interface FinancePageProps { company: CompanySummary; }
type ModalKind = 'entry' | 'settlement' | 'recurrence' | 'category' | 'costCenter' | 'account' | 'transfer' | 'cardPurchase' | 'cardClose' | 'cardPayment' | null;

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function formatMonth(value: string): string { const [year, month] = value.split('-'); return `${month}/${year}`; }
function formatDate(value: string): string { const [year, month, day] = value.split('-'); return `${day}/${month}/${year}`; }
function today(): string { return new Date().toISOString().slice(0, 10); }
function monthInput(): string { return today().slice(0, 7); }
function monthStart(value: string): string { return `${value}-01`; }
function money(value: string): number { return Number(value.replace(',', '.')); }
function key(prefix: string): string { return `${prefix}:${crypto.randomUUID()}`; }

export function FinancePage({ company }: FinancePageProps) {
  const [activeTab, setActiveTab] = useState('resumo');
  const [refreshToken, setRefreshToken] = useState(0);
  const [modal, setModal] = useState<ModalKind>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const scope = useMemo(() => ({ tenantId: company.tenantId, companyId: company.id }), [company.id, company.tenantId]);
  const tabs = useMemo(() => [
    { id: 'resumo', label: 'Resumo' },
    { id: 'lancamentos', label: 'Lançamentos' },
    { id: 'contas', label: 'Contas e bancos' },
    { id: 'cartoes', label: 'Cartões' },
  ], []);
  const overview = useFinanceOverview(scope, refreshToken);
  const operations = useFinanceOperations(scope);
  const references = operations.state.references;

  if (overview.status === 'idle' || overview.status === 'loading') return <LoadingState label="Carregando financeiro…" />;
  if (overview.status === 'error') return <EmptyState title="Financeiro indisponível" message={overview.errorMessage} />;
  if (overview.data === null) return <LoadingState label="Carregando financeiro…" />;

  const data = overview.data;
  const income = data.summary.find((item) => item.entryType === 'income');
  const expense = data.summary.find((item) => item.entryType === 'expense');
  const activeAccounts = (references?.accounts ?? []).filter((item) => item.status === 'active');
  const activeCards = (references?.cards ?? []).filter((item) => item.status === 'active');
  const openBalances = (references?.installmentBalances ?? []).filter((item) => item.financialStatus !== 'paid');
  const openStatements = (references?.statements ?? []).filter((item) => item.remainingAmount > 0);
  const entryType = form.entryType === 'income' ? 'income' : 'expense';
  const recurrenceType = form.recurrenceType === 'income' ? 'income' : 'expense';
  const entryCategories = (references?.categories ?? []).filter((item) => item.status === 'active' && (item.kind === 'both' || item.kind === entryType));
  const recurrenceCategories = (references?.categories ?? []).filter((item) => item.status === 'active' && (item.kind === 'both' || item.kind === recurrenceType));
  const expenseCategories = (references?.categories ?? []).filter((item) => item.status === 'active' && (item.kind === 'both' || item.kind === 'expense'));
  const activeCostCenters = (references?.costCenters ?? []).filter((item) => item.status === 'active');

  function field(name: string, value: string) { setForm((current) => ({ ...current, [name]: value })); }

  function open(kind: Exclude<ModalKind, null>) {
    operations.clearFeedback();
    const base = { date: today(), month: monthInput() };
    const defaults: Record<Exclude<ModalKind, null>, Record<string, string>> = {
      entry: { entryType: 'expense', description: '', counterparty: '', categoryId: '', costCenterId: '', competenceMonth: base.month, dueDate: base.date, amount: '', installmentCount: '1', notes: '' },
      settlement: { installmentId: '', accountId: '', settledOn: base.date, amount: '', notes: '' },
      recurrence: { recurrenceType: 'expense', description: '', counterparty: '', categoryId: '', costCenterId: '', amount: '', startDate: base.date, endDate: '', notes: '' },
      category: { name: '', kind: 'expense' },
      costCenter: { name: '', code: '' },
      account: { name: '', accountType: 'bank', openingBalance: '0' },
      transfer: { fromAccountId: '', toAccountId: '', transferOn: base.date, amount: '', notes: '' },
      cardPurchase: { cardId: '', purchaseDate: base.date, description: '', counterparty: '', categoryId: '', costCenterId: '', totalAmount: '', installmentCount: '1', notes: '' },
      cardClose: { cardId: '', statementMonth: base.month },
      cardPayment: { statementId: '', accountId: '', paidOn: base.date, amount: '', notes: '' },
    };
    setForm(defaults[kind]);
    setModal(kind);
  }

  function close() {
    setModal(null);
    operations.clearFeedback();
  }

  async function complete(action: () => Promise<unknown>) {
    await action();
    await operations.loadReferences();
    setRefreshToken((value) => value + 1);
    setModal(null);
  }

  async function submitModal() {
    try {
      switch (modal) {
        case 'entry':
          await complete(() => operations.createEntry({ entryType, description: form.description ?? '', counterpartyName: form.counterparty || null, categoryId: form.categoryId ?? '', costCenterId: form.costCenterId || null, competenceMonth: monthStart(form.competenceMonth ?? monthInput()), dueDate: form.dueDate ?? today(), amount: money(form.amount ?? '0'), installmentCount: Number(form.installmentCount ?? '1'), notes: form.notes || null }));
          break;
        case 'settlement':
          await complete(() => operations.settleInstallment({ installmentId: form.installmentId ?? '', accountId: form.accountId ?? '', settledOn: form.settledOn ?? today(), amount: money(form.amount ?? '0'), idempotencyKey: key('settlement'), notes: form.notes || null }));
          break;
        case 'recurrence':
          await complete(() => operations.createRecurrence({ entryType: recurrenceType, description: form.description ?? '', counterpartyName: form.counterparty || null, categoryId: form.categoryId ?? '', costCenterId: form.costCenterId || null, amount: money(form.amount ?? '0'), frequency: 'monthly', intervalCount: 1, startDate: form.startDate ?? today(), endDate: form.endDate || null, notes: form.notes || null }));
          break;
        case 'category':
          await complete(() => operations.createCategory({ name: form.name ?? '', kind: form.kind === 'income' || form.kind === 'both' ? form.kind : 'expense' }));
          break;
        case 'costCenter':
          await complete(() => operations.createCostCenter({ name: form.name ?? '', code: form.code || null }));
          break;
        case 'account':
          await complete(() => operations.createAccount({ name: form.name ?? '', accountType: form.accountType === 'cash' || form.accountType === 'other' ? form.accountType : 'bank', openingBalance: money(form.openingBalance ?? '0') }));
          break;
        case 'transfer':
          await complete(() => operations.transfer({ fromAccountId: form.fromAccountId ?? '', toAccountId: form.toAccountId ?? '', transferOn: form.transferOn ?? today(), amount: money(form.amount ?? '0'), idempotencyKey: key('transfer'), notes: form.notes || null }));
          break;
        case 'cardPurchase':
          await complete(() => operations.createCardPurchase({ cardId: form.cardId ?? '', purchaseDate: form.purchaseDate ?? today(), description: form.description ?? '', counterpartyName: form.counterparty || null, categoryId: form.categoryId ?? '', costCenterId: form.costCenterId || null, totalAmount: money(form.totalAmount ?? '0'), installmentCount: Number(form.installmentCount ?? '1'), idempotencyKey: key('card-purchase'), notes: form.notes || null }));
          break;
        case 'cardClose':
          await complete(() => operations.closeCardStatement({ cardId: form.cardId ?? '', statementMonth: monthStart(form.statementMonth ?? monthInput()) }));
          break;
        case 'cardPayment':
          await complete(() => operations.payCardStatement({ statementId: form.statementId ?? '', accountId: form.accountId ?? '', paidOn: form.paidOn ?? today(), amount: money(form.amount ?? '0'), idempotencyKey: key('card-payment'), notes: form.notes || null }));
          break;
        default:
          break;
      }
    } catch {
      // A mensagem normalizada permanece visível no modal.
    }
  }

  const modalTitles: Record<Exclude<ModalKind, null>, string> = {
    entry: 'Novo lançamento', settlement: 'Pagamento ou recebimento', recurrence: 'Nova recorrência', category: 'Nova categoria', costCenter: 'Novo centro de custo', account: 'Nova conta', transfer: 'Transferência entre contas', cardPurchase: 'Nova compra no cartão', cardClose: 'Fechar fatura', cardPayment: 'Pagar fatura',
  };

  const selectPlaceholder = [{ value: '', label: 'Selecione…' }];
  const accountOptions = [...selectPlaceholder, ...activeAccounts.map((item) => ({ value: item.id, label: item.name }))];
  const cardOptions = [...selectPlaceholder, ...activeCards.map((item) => ({ value: item.id, label: item.name }))];
  const costCenterOptions = [{ value: '', label: 'Sem centro de custo' }, ...activeCostCenters.map((item) => ({ value: item.id, label: item.code ? `${item.code} · ${item.name}` : item.name }))];
  const entryCategoryOptions = [...selectPlaceholder, ...entryCategories.map((item) => ({ value: item.id, label: item.name }))];
  const recurrenceCategoryOptions = [...selectPlaceholder, ...recurrenceCategories.map((item) => ({ value: item.id, label: item.name }))];
  const expenseCategoryOptions = [...selectPlaceholder, ...expenseCategories.map((item) => ({ value: item.id, label: item.name }))];
  const balanceOptions = [...selectPlaceholder, ...openBalances.map((item) => {
    const entry = data.entries.find((candidate) => candidate.installmentId === item.installmentId);
    const description = entry?.description ?? `Título ${item.entryId.slice(0, 8)}`;
    return { value: item.installmentId, label: `${description} · Parcela ${item.installmentNumber}/${item.installmentCount} · saldo ${currency.format(item.remainingAmount)}` };
  })];
  const statementOptions = [...selectPlaceholder, ...openStatements.map((item) => {
    const card = activeCards.find((candidate) => candidate.id === item.cardId);
    return { value: item.statementId, label: `${card?.name ?? 'Cartão'} · ${formatMonth(item.statementMonth)} · saldo ${currency.format(item.remainingAmount)}` };
  })];

  let modalContent = null;
  if (modal === 'entry') modalContent = <div className="finance-form-grid"><Select label="Tipo" value={entryType} onChange={(event) => field('entryType', event.target.value)} options={[{ value: 'expense', label: 'Despesa' }, { value: 'income', label: 'Receita' }]} /><Input label="Descrição" value={form.description ?? ''} onChange={(event) => field('description', event.target.value)} required /><Input label="Fornecedor / pagador" value={form.counterparty ?? ''} onChange={(event) => field('counterparty', event.target.value)} /><Select label="Categoria" value={form.categoryId ?? ''} onChange={(event) => field('categoryId', event.target.value)} options={entryCategoryOptions} required /><Select label="Centro de custo" value={form.costCenterId ?? ''} onChange={(event) => field('costCenterId', event.target.value)} options={costCenterOptions} /><Input label="Competência inicial" type="month" value={form.competenceMonth ?? monthInput()} onChange={(event) => field('competenceMonth', event.target.value)} required /><Input label="Primeiro vencimento" type="date" value={form.dueDate ?? today()} onChange={(event) => field('dueDate', event.target.value)} required /><Input label="Valor total" type="number" min="0.01" step="0.01" value={form.amount ?? ''} onChange={(event) => field('amount', event.target.value)} required /><Input label="Parcelas" type="number" min="1" max="120" step="1" value={form.installmentCount ?? '1'} onChange={(event) => field('installmentCount', event.target.value)} required /><Input label="Observação" value={form.notes ?? ''} onChange={(event) => field('notes', event.target.value)} /></div>;
  if (modal === 'settlement') modalContent = <div className="finance-form-grid"><Select label="Título" value={form.installmentId ?? ''} onChange={(event) => { const selected = openBalances.find((item) => item.installmentId === event.target.value); field('installmentId', event.target.value); if (selected) field('amount', String(selected.remainingAmount)); }} options={balanceOptions} required /><Select label="Conta" value={form.accountId ?? ''} onChange={(event) => field('accountId', event.target.value)} options={accountOptions} required /><Input label="Data" type="date" value={form.settledOn ?? today()} onChange={(event) => field('settledOn', event.target.value)} required /><Input label="Valor" type="number" min="0.01" step="0.01" value={form.amount ?? ''} onChange={(event) => field('amount', event.target.value)} required /><Input label="Observação" value={form.notes ?? ''} onChange={(event) => field('notes', event.target.value)} /></div>;
  if (modal === 'recurrence') modalContent = <div className="finance-form-grid"><Select label="Tipo" value={recurrenceType} onChange={(event) => field('recurrenceType', event.target.value)} options={[{ value: 'expense', label: 'Despesa' }, { value: 'income', label: 'Receita' }]} /><Input label="Descrição" value={form.description ?? ''} onChange={(event) => field('description', event.target.value)} required /><Input label="Fornecedor / pagador" value={form.counterparty ?? ''} onChange={(event) => field('counterparty', event.target.value)} /><Select label="Categoria" value={form.categoryId ?? ''} onChange={(event) => field('categoryId', event.target.value)} options={recurrenceCategoryOptions} required /><Select label="Centro de custo" value={form.costCenterId ?? ''} onChange={(event) => field('costCenterId', event.target.value)} options={costCenterOptions} /><Input label="Valor" type="number" min="0.01" step="0.01" value={form.amount ?? ''} onChange={(event) => field('amount', event.target.value)} required /><Input label="Início" type="date" value={form.startDate ?? today()} onChange={(event) => field('startDate', event.target.value)} required /><Input label="Término" type="date" value={form.endDate ?? ''} onChange={(event) => field('endDate', event.target.value)} /><Input label="Observação" value={form.notes ?? ''} onChange={(event) => field('notes', event.target.value)} /></div>;
  if (modal === 'category') modalContent = <div className="finance-form-grid"><Input label="Nome" value={form.name ?? ''} onChange={(event) => field('name', event.target.value)} required /><Select label="Tipo" value={form.kind ?? 'expense'} onChange={(event) => field('kind', event.target.value)} options={[{ value: 'expense', label: 'Despesa' }, { value: 'income', label: 'Receita' }, { value: 'both', label: 'Ambos' }]} /></div>;
  if (modal === 'costCenter') modalContent = <div className="finance-form-grid"><Input label="Nome" value={form.name ?? ''} onChange={(event) => field('name', event.target.value)} required /><Input label="Código" value={form.code ?? ''} onChange={(event) => field('code', event.target.value)} /></div>;
  if (modal === 'account') modalContent = <div className="finance-form-grid"><Input label="Nome da conta" value={form.name ?? ''} onChange={(event) => field('name', event.target.value)} required /><Select label="Tipo" value={form.accountType ?? 'bank'} onChange={(event) => field('accountType', event.target.value)} options={[{ value: 'bank', label: 'Banco' }, { value: 'cash', label: 'Dinheiro' }, { value: 'other', label: 'Outra' }]} /><Input label="Saldo inicial" type="number" step="0.01" value={form.openingBalance ?? '0'} onChange={(event) => field('openingBalance', event.target.value)} /></div>;
  if (modal === 'transfer') modalContent = <div className="finance-form-grid"><Select label="Conta de origem" value={form.fromAccountId ?? ''} onChange={(event) => field('fromAccountId', event.target.value)} options={accountOptions} required /><Select label="Conta de destino" value={form.toAccountId ?? ''} onChange={(event) => field('toAccountId', event.target.value)} options={accountOptions} required /><Input label="Data" type="date" value={form.transferOn ?? today()} onChange={(event) => field('transferOn', event.target.value)} required /><Input label="Valor" type="number" min="0.01" step="0.01" value={form.amount ?? ''} onChange={(event) => field('amount', event.target.value)} required /><Input label="Observação" value={form.notes ?? ''} onChange={(event) => field('notes', event.target.value)} /></div>;
  if (modal === 'cardPurchase') modalContent = <div className="finance-form-grid"><Select label="Cartão" value={form.cardId ?? ''} onChange={(event) => field('cardId', event.target.value)} options={cardOptions} required /><Input label="Data da compra" type="date" value={form.purchaseDate ?? today()} onChange={(event) => field('purchaseDate', event.target.value)} required /><Input label="Descrição" value={form.description ?? ''} onChange={(event) => field('description', event.target.value)} required /><Input label="Fornecedor" value={form.counterparty ?? ''} onChange={(event) => field('counterparty', event.target.value)} /><Select label="Categoria" value={form.categoryId ?? ''} onChange={(event) => field('categoryId', event.target.value)} options={expenseCategoryOptions} required /><Select label="Centro de custo" value={form.costCenterId ?? ''} onChange={(event) => field('costCenterId', event.target.value)} options={costCenterOptions} /><Input label="Valor total" type="number" min="0.01" step="0.01" value={form.totalAmount ?? ''} onChange={(event) => field('totalAmount', event.target.value)} required /><Input label="Parcelas" type="number" min="1" max="120" step="1" value={form.installmentCount ?? '1'} onChange={(event) => field('installmentCount', event.target.value)} required /><Input label="Observação" value={form.notes ?? ''} onChange={(event) => field('notes', event.target.value)} /></div>;
  if (modal === 'cardClose') modalContent = <div className="finance-form-grid"><Select label="Cartão" value={form.cardId ?? ''} onChange={(event) => field('cardId', event.target.value)} options={cardOptions} required /><Input label="Competência da fatura" type="month" value={form.statementMonth ?? monthInput()} onChange={(event) => field('statementMonth', event.target.value)} required /></div>;
  if (modal === 'cardPayment') modalContent = <div className="finance-form-grid"><Select label="Fatura" value={form.statementId ?? ''} onChange={(event) => { const selected = openStatements.find((item) => item.statementId === event.target.value); field('statementId', event.target.value); if (selected) field('amount', String(selected.remainingAmount)); }} options={statementOptions} required /><Select label="Conta" value={form.accountId ?? ''} onChange={(event) => field('accountId', event.target.value)} options={accountOptions} required /><Input label="Data" type="date" value={form.paidOn ?? today()} onChange={(event) => field('paidOn', event.target.value)} required /><Input label="Valor" type="number" min="0.01" step="0.01" value={form.amount ?? ''} onChange={(event) => field('amount', event.target.value)} required /><Input label="Observação" value={form.notes ?? ''} onChange={(event) => field('notes', event.target.value)} /></div>;

  return (
    <section className="finance-overview" aria-labelledby="finance-title">
      <div className="finance-overview__heading"><div><span className="ui-muted">Competência {formatMonth(data.month)}</span><h1 id="finance-title">Financeiro</h1></div><p className="ui-muted">Resumo operacional, lançamentos, contas, cartões e recorrências da empresa selecionada.</p></div>
      <Tabs items={tabs} activeId={activeTab} onChange={setActiveTab} ariaLabel="Seções do financeiro" />
      {operations.state.errorMessage && modal === null && <Feedback tone="danger" title="Operação não concluída" message={operations.state.errorMessage} />}
      {operations.state.successMessage && modal === null && <Feedback tone="success" title="Concluído" message={operations.state.successMessage} />}

      {activeTab === 'resumo' && <div className="finance-overview__cards" role="tabpanel">
        <Card title="Receitas" description="Planejado × realizado no mês"><dl className="finance-metrics"><div><dt>Planejado</dt><dd>{currency.format(income?.plannedAmount ?? 0)}</dd></div><div><dt>Realizado</dt><dd>{currency.format(income?.realizedAmount ?? 0)}</dd></div><div><dt>Pendente</dt><dd>{currency.format(income?.pendingAmount ?? 0)}</dd></div></dl></Card>
        <Card title="Despesas" description="Inclui parcelas de cartão na competência"><dl className="finance-metrics"><div><dt>Planejado</dt><dd>{currency.format(expense?.plannedAmount ?? 0)}</dd></div><div><dt>Realizado</dt><dd>{currency.format(expense?.realizedAmount ?? 0)}</dd></div><div><dt>Pendente</dt><dd>{currency.format(expense?.pendingAmount ?? 0)}</dd></div></dl></Card>
      </div>}

      {activeTab === 'lancamentos' && <div className="finance-section" role="tabpanel">
        <Card title="Lançamentos" description="Parcelas sempre identificadas pelo número e total" actions={<div className="finance-actions"><Button size="sm" onClick={() => open('entry')}>Novo lançamento</Button><Button size="sm" variant="secondary" onClick={() => open('settlement')}>Pagar / receber</Button><Button size="sm" variant="secondary" onClick={() => open('recurrence')}>Nova recorrência</Button><Button size="sm" variant="tertiary" onClick={() => open('category')}>Categoria</Button><Button size="sm" variant="tertiary" onClick={() => open('costCenter')}>Centro de custo</Button></div>}>
          {data.entries.length === 0 ? <p className="ui-muted">Nenhum lançamento financeiro cadastrado.</p> : <div className="finance-list">{data.entries.map((entry) => { const balance = references?.installmentBalances.find((item) => item.installmentId === entry.installmentId); return <div className="finance-list__group" key={entry.installmentId}><div className="finance-list__row"><strong>{entry.description}</strong><strong>{currency.format(entry.amount)}</strong></div><div className="finance-list__row"><span>{entry.installmentCount > 1 ? `Parcela ${entry.installmentNumber}/${entry.installmentCount}` : 'Parcela única'}</span><span>Vencimento {formatDate(entry.dueDate)}</span></div>{balance && <div className="finance-list__row"><span>Status {balance.financialStatus}</span><span>Saldo {currency.format(balance.remainingAmount)}</span></div>}</div>; })}</div>}
        </Card>
        <Card title="Recorrências" description="Regras mensais e próxima ocorrência">
          {(references?.recurrences.length ?? 0) === 0 ? <p className="ui-muted">Nenhuma recorrência cadastrada.</p> : <div className="finance-list">{references?.recurrences.map((item) => <div className="finance-list__group" key={item.id}><div className="finance-list__row"><strong>{item.description}</strong><strong>{currency.format(item.amount)}</strong></div><div className="finance-list__row"><span>Próxima {formatDate(item.nextOccurrenceDate)}</span><Button size="sm" variant="secondary" disabled={operations.state.busy || item.status !== 'active'} onClick={() => { void complete(() => operations.materializeRecurrence(item.id)).catch(() => undefined); }}>Gerar próxima</Button></div></div>)}</div>}
        </Card>
      </div>}

      {activeTab === 'contas' && <div className="finance-section" role="tabpanel">
        <Card title="Contas e bancos" description="Saldo atual derivado do razão financeiro" actions={<div className="finance-actions"><Button size="sm" onClick={() => open('account')}>Nova conta</Button><Button size="sm" variant="secondary" onClick={() => open('transfer')}>Transferir</Button></div>}>
          {data.accountBalances.length === 0 ? <p className="ui-muted">Nenhuma conta financeira cadastrada.</p> : <div className="finance-list">{data.accountBalances.map((account) => <div className="finance-list__row" key={account.accountId}><span>{account.name}</span><strong>{currency.format(account.currentBalance)}</strong></div>)}</div>}
        </Card>
        <Card title="Transferências" description="Movimentações entre contas da mesma empresa">
          {(references?.transfers.length ?? 0) === 0 ? <p className="ui-muted">Nenhuma transferência registrada.</p> : <div className="finance-list">{references?.transfers.map((item) => <div className="finance-list__group" key={item.id}><div className="finance-list__row"><span>{formatDate(item.transferOn)}</span><strong>{currency.format(item.amount)}</strong></div><div className="finance-list__row"><span>{activeAccounts.find((account) => account.id === item.fromAccountId)?.name ?? 'Origem'}</span><span>→ {activeAccounts.find((account) => account.id === item.toAccountId)?.name ?? 'Destino'}</span></div></div>)}</div>}
        </Card>
      </div>}

      {activeTab === 'cartoes' && <div className="finance-section" role="tabpanel">
        <Card title="Cartões" description="Limite total, comprometido e disponível" actions={<div className="finance-actions"><Button size="sm" onClick={() => open('cardPurchase')}>Nova compra</Button><Button size="sm" variant="secondary" onClick={() => open('cardClose')}>Fechar fatura</Button><Button size="sm" variant="secondary" onClick={() => open('cardPayment')}>Pagar fatura</Button></div>}>
          {data.cardLimits.length === 0 ? <p className="ui-muted">Nenhum cartão cadastrado.</p> : <div className="finance-list">{data.cardLimits.map((card) => <div className="finance-list__group" key={card.cardId}><strong>{card.name}</strong><div className="finance-list__row"><span>Limite</span><span>{currency.format(card.creditLimit)}</span></div><div className="finance-list__row"><span>Comprometido</span><span>{currency.format(card.committedAmount)}</span></div><div className="finance-list__row"><span>Disponível</span><span>{currency.format(card.availableLimit)}</span></div></div>)}</div>}
        </Card>
        <Card title="Faturas" description="Valores, saldo e status de pagamento">
          {(references?.statements.length ?? 0) === 0 ? <p className="ui-muted">Nenhuma fatura registrada.</p> : <div className="finance-list">{references?.statements.map((item) => <div className="finance-list__group" key={item.statementId}><div className="finance-list__row"><strong>{activeCards.find((card) => card.id === item.cardId)?.name ?? 'Cartão'}</strong><strong>{formatMonth(item.statementMonth)}</strong></div><div className="finance-list__row"><span>{item.paymentStatus}</span><span>Fatura {currency.format(item.statementAmount)} · saldo {currency.format(item.remainingAmount)}</span></div></div>)}</div>}
        </Card>
      </div>}

      <Dialog open={modal !== null} title={modal ? modalTitles[modal] : 'Financeiro'} description="Operação vinculada exclusivamente à empresa selecionada." loading={operations.state.busy} onClose={close} onBack={close} onConfirm={modal ? () => { void submitModal(); } : undefined}>
        {operations.state.errorMessage && <Feedback tone="danger" title="Não foi possível salvar" message={operations.state.errorMessage} />}
        {modalContent}
      </Dialog>
    </section>
  );
}
