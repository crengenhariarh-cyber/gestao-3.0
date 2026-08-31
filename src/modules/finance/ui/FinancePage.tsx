import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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

interface FinancePageProps { company: CompanySummary; allowDirectAction?: boolean; }
type ModalKind = 'entry' | 'entryDelete' | 'settlement' | 'recurrence' | 'category' | 'costCenter' | 'account' | 'card' | 'transfer' | 'cardPurchase' | 'cardClose' | 'cardPayment' | null;

type FinanceTab = 'resumo' | 'lancamentos' | 'contas' | 'cartoes';
const FINANCE_TABS: readonly FinanceTab[] = ['resumo', 'lancamentos', 'contas', 'cartoes'];
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function formatMonth(value: string): string { const [year, month] = value.split('-'); return `${month}/${year}`; }
function formatDate(value: string): string { const [year, month, day] = value.split('-'); return `${day}/${month}/${year}`; }
function today(): string { return new Date().toISOString().slice(0, 10); }
function monthInput(): string { return today().slice(0, 7); }
function monthStart(value: string): string { return `${value}-01`; }
function money(value: string): number { return Number(value.replace(',', '.')); }
function key(prefix: string): string { return `${prefix}:${crypto.randomUUID()}`; }
function financeTab(value: string | null): FinanceTab { return FINANCE_TABS.includes(value as FinanceTab) ? value as FinanceTab : 'resumo'; }

export function FinancePage({ company, allowDirectAction = false }: FinancePageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const requestedAction = searchParams.get('action');
  const [activeTab, setActiveTab] = useState<FinanceTab>(() => financeTab(requestedTab));
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

  useEffect(() => {
    const nextTab = requestedAction === 'new-entry' ? 'lancamentos' : financeTab(requestedTab);
    setActiveTab(nextTab);
    if (requestedAction !== 'new-entry') return;
    if (allowDirectAction) {
      setForm({ entryId: '', entryType: 'expense', description: '', counterparty: '', categoryId: '', costCenterId: '', competenceMonth: monthInput(), dueDate: today(), amount: '', installmentCount: '1', notes: '' });
      setModal('entry');
    }
    const next = new URLSearchParams();
    next.set('tab', 'lancamentos');
    setSearchParams(next, { replace: true });
  }, [allowDirectAction, requestedAction, requestedTab, setSearchParams]);

  if (overview.status === 'idle' || overview.status === 'loading') return <LoadingState label="Carregando financeiro…" />;
  if (overview.status === 'error') return <EmptyState title="Financeiro indisponível" message={overview.errorMessage} />;
  if (overview.data === null) return <LoadingState label="Carregando financeiro…" />;

  const data = overview.data;
  const income = data.summary.find((item) => item.entryType === 'income');
  const expense = data.summary.find((item) => item.entryType === 'expense');
  const activeAccounts = (references?.accounts ?? []).filter((item) => item.status === 'active');
  const activeCards = (references?.cards ?? []).filter((item) => item.status === 'active');
  const activeCostCenters = (references?.costCenters ?? []).filter((item) => item.status === 'active');
  const openBalances = (references?.installmentBalances ?? []).filter((item) => item.financialStatus !== 'paid');
  const openStatements = (references?.statements ?? []).filter((item) => item.remainingAmount > 0);
  const entryType = form.entryType === 'income' ? 'income' : 'expense';
  const recurrenceType = form.recurrenceType === 'income' ? 'income' : 'expense';
  const entryCategories = (references?.categories ?? []).filter((item) => item.status === 'active' && (item.kind === 'both' || item.kind === entryType));
  const recurrenceCategories = (references?.categories ?? []).filter((item) => item.status === 'active' && (item.kind === 'both' || item.kind === recurrenceType));
  const expenseCategories = (references?.categories ?? []).filter((item) => item.status === 'active' && (item.kind === 'both' || item.kind === 'expense'));

  function field(name: string, value: string) { setForm((current) => ({ ...current, [name]: value })); }
  function open(kind: Exclude<ModalKind, null>, values: Record<string, string> = {}) {
    operations.clearFeedback();
    const base = { date: today(), month: monthInput() };
    const defaults: Record<Exclude<ModalKind, null>, Record<string, string>> = {
      entry: { entryId: '', entryType: 'expense', description: '', counterparty: '', categoryId: '', costCenterId: '', competenceMonth: base.month, dueDate: base.date, amount: '', installmentCount: '1', notes: '' },
      entryDelete: { entryId: '', description: '' },
      settlement: { installmentId: '', accountId: '', settledOn: base.date, amount: '', notes: '' },
      recurrence: { recurrenceType: 'expense', description: '', counterparty: '', categoryId: '', costCenterId: '', amount: '', startDate: base.date, endDate: '', notes: '' },
      category: { id: '', name: '', kind: 'expense', status: 'active' },
      costCenter: { id: '', name: '', code: '', status: 'active' },
      account: { id: '', name: '', accountType: 'bank', openingBalance: '0', status: 'active' },
      card: { id: '', name: '', lastFour: '', creditLimit: '', closingDay: '10', dueDay: '20', defaultPaymentAccountId: '', status: 'active' },
      transfer: { fromAccountId: '', toAccountId: '', transferOn: base.date, amount: '', notes: '' },
      cardPurchase: { cardId: '', purchaseDate: base.date, description: '', counterparty: '', categoryId: '', costCenterId: '', totalAmount: '', installmentCount: '1', notes: '' },
      cardClose: { cardId: '', statementMonth: base.month },
      cardPayment: { statementId: '', accountId: '', paidOn: base.date, amount: '', notes: '' },
    };
    setForm({ ...defaults[kind], ...values });
    setModal(kind);
  }
  function close() { setModal(null); operations.clearFeedback(); }
  async function complete(action: () => Promise<unknown>) {
    await action();
    await operations.loadReferences();
    setRefreshToken((value) => value + 1);
    setModal(null);
  }
  function editEntry(entryId: string) {
    const installments = data.entries.filter((item) => item.entryId === entryId).sort((a, b) => a.installmentNumber - b.installmentNumber);
    const first = installments[0];
    if (!first) return;
    open('entry', {
      entryId,
      entryType: first.entryType,
      description: first.description,
      counterparty: first.counterpartyName ?? '',
      categoryId: first.categoryId,
      costCenterId: first.costCenterId ?? '',
      competenceMonth: first.competenceMonth.slice(0, 7),
      dueDate: first.dueDate,
      amount: String(installments.reduce((total, item) => total + item.amount, 0)),
      installmentCount: String(first.installmentCount),
      notes: first.notes ?? '',
    });
  }

  async function submitModal() {
    try {
      switch (modal) {
        case 'entry': {
          const input = { entryType, description: form.description ?? '', counterpartyName: form.counterparty || null, categoryId: form.categoryId ?? '', costCenterId: form.costCenterId || null, competenceMonth: monthStart(form.competenceMonth ?? monthInput()), dueDate: form.dueDate ?? today(), amount: money(form.amount ?? '0'), installmentCount: Number(form.installmentCount ?? '1'), notes: form.notes || null };
          if (form.entryId) await complete(() => operations.updateEntry({ ...input, entryId: form.entryId ?? '' }));
          else await complete(() => operations.createEntry(input));
          break;
        }
        case 'entryDelete': await complete(() => operations.deleteEntry(form.entryId ?? '')); break;
        case 'settlement': await complete(() => operations.settleInstallment({ installmentId: form.installmentId ?? '', accountId: form.accountId ?? '', settledOn: form.settledOn ?? today(), amount: money(form.amount ?? '0'), idempotencyKey: key('settlement'), notes: form.notes || null })); break;
        case 'recurrence': await complete(() => operations.createRecurrence({ entryType: recurrenceType, description: form.description ?? '', counterpartyName: form.counterparty || null, categoryId: form.categoryId ?? '', costCenterId: form.costCenterId || null, amount: money(form.amount ?? '0'), frequency: 'monthly', intervalCount: 1, startDate: form.startDate ?? today(), endDate: form.endDate || null, notes: form.notes || null })); break;
        case 'category': {
          const kind = form.kind === 'income' || form.kind === 'both' ? form.kind : 'expense';
          if (form.id) await complete(() => operations.updateCategory({ id: form.id ?? '', name: form.name ?? '', kind, status: form.status === 'inactive' ? 'inactive' : 'active' }));
          else await complete(() => operations.createCategory({ name: form.name ?? '', kind }));
          break;
        }
        case 'costCenter':
          if (form.id) await complete(() => operations.updateCostCenter({ id: form.id ?? '', name: form.name ?? '', code: form.code || null, status: form.status === 'inactive' ? 'inactive' : 'active' }));
          else await complete(() => operations.createCostCenter({ name: form.name ?? '', code: form.code || null }));
          break;
        case 'account': {
          const accountType = form.accountType === 'cash' || form.accountType === 'other' ? form.accountType : 'bank';
          if (form.id) await complete(() => operations.updateAccount({ id: form.id ?? '', name: form.name ?? '', accountType, status: form.status === 'inactive' ? 'inactive' : 'active' }));
          else await complete(() => operations.createAccount({ name: form.name ?? '', accountType, openingBalance: money(form.openingBalance ?? '0') }));
          break;
        }
        case 'card': {
          const input = { name: form.name ?? '', lastFour: form.lastFour || null, creditLimit: money(form.creditLimit ?? '0'), closingDay: Number(form.closingDay ?? '1'), dueDay: Number(form.dueDay ?? '1'), defaultPaymentAccountId: form.defaultPaymentAccountId || null };
          if (form.id) await complete(() => operations.updateCard({ ...input, id: form.id ?? '', status: form.status === 'inactive' ? 'inactive' : 'active' }));
          else await complete(() => operations.createCard(input));
          break;
        }
        case 'transfer': await complete(() => operations.transfer({ fromAccountId: form.fromAccountId ?? '', toAccountId: form.toAccountId ?? '', transferOn: form.transferOn ?? today(), amount: money(form.amount ?? '0'), idempotencyKey: key('transfer'), notes: form.notes || null })); break;
        case 'cardPurchase': await complete(() => operations.createCardPurchase({ cardId: form.cardId ?? '', purchaseDate: form.purchaseDate ?? today(), description: form.description ?? '', counterpartyName: form.counterparty || null, categoryId: form.categoryId ?? '', costCenterId: form.costCenterId || null, totalAmount: money(form.totalAmount ?? '0'), installmentCount: Number(form.installmentCount ?? '1'), idempotencyKey: key('card-purchase'), notes: form.notes || null })); break;
        case 'cardClose': await complete(() => operations.closeCardStatement({ cardId: form.cardId ?? '', statementMonth: monthStart(form.statementMonth ?? monthInput()) })); break;
        case 'cardPayment': await complete(() => operations.payCardStatement({ statementId: form.statementId ?? '', accountId: form.accountId ?? '', paidOn: form.paidOn ?? today(), amount: money(form.amount ?? '0'), idempotencyKey: key('card-payment'), notes: form.notes || null })); break;
        default: break;
      }
    } catch { /* mensagem normalizada permanece no modal */ }
  }

  const modalTitles: Record<Exclude<ModalKind, null>, string> = {
    entry: form.entryId ? 'Editar lançamento' : 'Novo lançamento', entryDelete: 'Excluir lançamento', settlement: 'Pagamento ou recebimento', recurrence: 'Nova recorrência', category: form.id ? 'Editar categoria' : 'Nova categoria', costCenter: form.id ? 'Editar centro de custo' : 'Novo centro de custo', account: form.id ? 'Editar conta' : 'Nova conta', card: form.id ? 'Editar cartão' : 'Novo cartão', transfer: 'Transferência entre contas', cardPurchase: 'Nova compra no cartão', cardClose: 'Fechar fatura', cardPayment: 'Pagar fatura',
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
    return { value: item.installmentId, label: `${entry?.description ?? `Título ${item.entryId.slice(0, 8)}`} · Parcela ${item.installmentNumber}/${item.installmentCount} · saldo ${currency.format(item.remainingAmount)}` };
  })];
  const statementOptions = [...selectPlaceholder, ...openStatements.map((item) => ({ value: item.statementId, label: `${activeCards.find((candidate) => candidate.id === item.cardId)?.name ?? 'Cartão'} · ${formatMonth(item.statementMonth)} · saldo ${currency.format(item.remainingAmount)}` }))];

  let modalContent = null;
  if (modal === 'entry') modalContent = <div className="finance-form-grid"><Select label="Tipo" value={entryType} onChange={(event) => field('entryType', event.target.value)} options={[{ value: 'expense', label: 'Despesa' }, { value: 'income', label: 'Receita' }]} /><Input label="Descrição" value={form.description ?? ''} onChange={(event) => field('description', event.target.value)} required /><Input label="Fornecedor / pagador" value={form.counterparty ?? ''} onChange={(event) => field('counterparty', event.target.value)} /><Select label="Categoria" value={form.categoryId ?? ''} onChange={(event) => field('categoryId', event.target.value)} options={entryCategoryOptions} required /><Select label="Centro de custo" value={form.costCenterId ?? ''} onChange={(event) => field('costCenterId', event.target.value)} options={costCenterOptions} /><Input label="Competência inicial" type="month" value={form.competenceMonth ?? monthInput()} onChange={(event) => field('competenceMonth', event.target.value)} required /><Input label="Primeiro vencimento" type="date" value={form.dueDate ?? today()} onChange={(event) => field('dueDate', event.target.value)} required /><Input label="Valor total" type="number" min="0.01" step="0.01" value={form.amount ?? ''} onChange={(event) => field('amount', event.target.value)} required /><Input label="Parcelas" type="number" min="1" max="120" step="1" value={form.installmentCount ?? '1'} onChange={(event) => field('installmentCount', event.target.value)} required /><Input label="Observação" value={form.notes ?? ''} onChange={(event) => field('notes', event.target.value)} /></div>;
  if (modal === 'entryDelete') modalContent = <Feedback tone="danger" title="Confirme a exclusão" message={`O lançamento “${form.description ?? ''}” será excluído somente se não possuir baixa nem vínculo com RH, Engenharia ou recorrência.`} />;
  if (modal === 'settlement') modalContent = <div className="finance-form-grid"><Select label="Título" value={form.installmentId ?? ''} onChange={(event) => { const selected = openBalances.find((item) => item.installmentId === event.target.value); field('installmentId', event.target.value); if (selected) field('amount', String(selected.remainingAmount)); }} options={balanceOptions} required /><Select label="Conta" value={form.accountId ?? ''} onChange={(event) => field('accountId', event.target.value)} options={accountOptions} required /><Input label="Data" type="date" value={form.settledOn ?? today()} onChange={(event) => field('settledOn', event.target.value)} required /><Input label="Valor" type="number" min="0.01" step="0.01" value={form.amount ?? ''} onChange={(event) => field('amount', event.target.value)} required /><Input label="Observação" value={form.notes ?? ''} onChange={(event) => field('notes', event.target.value)} /></div>;
  if (modal === 'recurrence') modalContent = <div className="finance-form-grid"><Select label="Tipo" value={recurrenceType} onChange={(event) => field('recurrenceType', event.target.value)} options={[{ value: 'expense', label: 'Despesa' }, { value: 'income', label: 'Receita' }]} /><Input label="Descrição" value={form.description ?? ''} onChange={(event) => field('description', event.target.value)} required /><Input label="Fornecedor / pagador" value={form.counterparty ?? ''} onChange={(event) => field('counterparty', event.target.value)} /><Select label="Categoria" value={form.categoryId ?? ''} onChange={(event) => field('categoryId', event.target.value)} options={recurrenceCategoryOptions} required /><Select label="Centro de custo" value={form.costCenterId ?? ''} onChange={(event) => field('costCenterId', event.target.value)} options={costCenterOptions} /><Input label="Valor" type="number" min="0.01" step="0.01" value={form.amount ?? ''} onChange={(event) => field('amount', event.target.value)} required /><Input label="Início" type="date" value={form.startDate ?? today()} onChange={(event) => field('startDate', event.target.value)} required /><Input label="Término" type="date" value={form.endDate ?? ''} onChange={(event) => field('endDate', event.target.value)} /><Input label="Observação" value={form.notes ?? ''} onChange={(event) => field('notes', event.target.value)} /></div>;
  if (modal === 'category') modalContent = <div className="finance-form-grid"><Input label="Nome" value={form.name ?? ''} onChange={(event) => field('name', event.target.value)} required /><Select label="Tipo" value={form.kind ?? 'expense'} onChange={(event) => field('kind', event.target.value)} options={[{ value: 'expense', label: 'Despesa' }, { value: 'income', label: 'Receita' }, { value: 'both', label: 'Ambos' }]} /></div>;
  if (modal === 'costCenter') modalContent = <div className="finance-form-grid"><Input label="Nome" value={form.name ?? ''} onChange={(event) => field('name', event.target.value)} required /><Input label="Código" value={form.code ?? ''} onChange={(event) => field('code', event.target.value)} /></div>;
  if (modal === 'account') modalContent = <div className="finance-form-grid"><Input label="Nome da conta" value={form.name ?? ''} onChange={(event) => field('name', event.target.value)} required /><Select label="Tipo" value={form.accountType ?? 'bank'} onChange={(event) => field('accountType', event.target.value)} options={[{ value: 'bank', label: 'Banco' }, { value: 'cash', label: 'Dinheiro' }, { value: 'other', label: 'Outra' }]} />{!form.id && <Input label="Saldo inicial" type="number" step="0.01" value={form.openingBalance ?? '0'} onChange={(event) => field('openingBalance', event.target.value)} />}</div>;
  if (modal === 'card') modalContent = <div className="finance-form-grid"><Input label="Nome do cartão" value={form.name ?? ''} onChange={(event) => field('name', event.target.value)} required /><Input label="Últimos 4 dígitos" inputMode="numeric" maxLength={4} value={form.lastFour ?? ''} onChange={(event) => field('lastFour', event.target.value)} /><Input label="Limite" type="number" min="0" step="0.01" value={form.creditLimit ?? ''} onChange={(event) => field('creditLimit', event.target.value)} required /><Input label="Dia de fechamento" type="number" min="1" max="31" value={form.closingDay ?? '10'} onChange={(event) => field('closingDay', event.target.value)} required /><Input label="Dia de vencimento" type="number" min="1" max="31" value={form.dueDay ?? '20'} onChange={(event) => field('dueDay', event.target.value)} required /><Select label="Conta padrão de pagamento" value={form.defaultPaymentAccountId ?? ''} onChange={(event) => field('defaultPaymentAccountId', event.target.value)} options={[{ value: '', label: 'Sem conta padrão' }, ...activeAccounts.map((item) => ({ value: item.id, label: item.name }))]} /></div>;
  if (modal === 'transfer') modalContent = <div className="finance-form-grid"><Select label="Conta de origem" value={form.fromAccountId ?? ''} onChange={(event) => field('fromAccountId', event.target.value)} options={accountOptions} required /><Select label="Conta de destino" value={form.toAccountId ?? ''} onChange={(event) => field('toAccountId', event.target.value)} options={accountOptions} required /><Input label="Data" type="date" value={form.transferOn ?? today()} onChange={(event) => field('transferOn', event.target.value)} required /><Input label="Valor" type="number" min="0.01" step="0.01" value={form.amount ?? ''} onChange={(event) => field('amount', event.target.value)} required /><Input label="Observação" value={form.notes ?? ''} onChange={(event) => field('notes', event.target.value)} /></div>;
  if (modal === 'cardPurchase') modalContent = <div className="finance-form-grid"><Select label="Cartão" value={form.cardId ?? ''} onChange={(event) => field('cardId', event.target.value)} options={cardOptions} required /><Input label="Data da compra" type="date" value={form.purchaseDate ?? today()} onChange={(event) => field('purchaseDate', event.target.value)} required /><Input label="Descrição" value={form.description ?? ''} onChange={(event) => field('description', event.target.value)} required /><Input label="Fornecedor" value={form.counterparty ?? ''} onChange={(event) => field('counterparty', event.target.value)} /><Select label="Categoria" value={form.categoryId ?? ''} onChange={(event) => field('categoryId', event.target.value)} options={expenseCategoryOptions} required /><Select label="Centro de custo" value={form.costCenterId ?? ''} onChange={(event) => field('costCenterId', event.target.value)} options={costCenterOptions} /><Input label="Valor total" type="number" min="0.01" step="0.01" value={form.totalAmount ?? ''} onChange={(event) => field('totalAmount', event.target.value)} required /><Input label="Parcelas" type="number" min="1" max="120" step="1" value={form.installmentCount ?? '1'} onChange={(event) => field('installmentCount', event.target.value)} required /><Input label="Observação" value={form.notes ?? ''} onChange={(event) => field('notes', event.target.value)} /></div>;
  if (modal === 'cardClose') modalContent = <div className="finance-form-grid"><Select label="Cartão" value={form.cardId ?? ''} onChange={(event) => field('cardId', event.target.value)} options={cardOptions} required /><Input label="Competência da fatura" type="month" value={form.statementMonth ?? monthInput()} onChange={(event) => field('statementMonth', event.target.value)} required /></div>;
  if (modal === 'cardPayment') modalContent = <div className="finance-form-grid"><Select label="Fatura" value={form.statementId ?? ''} onChange={(event) => { const selected = openStatements.find((item) => item.statementId === event.target.value); field('statementId', event.target.value); if (selected) field('amount', String(selected.remainingAmount)); }} options={statementOptions} required /><Select label="Conta" value={form.accountId ?? ''} onChange={(event) => field('accountId', event.target.value)} options={accountOptions} required /><Input label="Data" type="date" value={form.paidOn ?? today()} onChange={(event) => field('paidOn', event.target.value)} required /><Input label="Valor" type="number" min="0.01" step="0.01" value={form.amount ?? ''} onChange={(event) => field('amount', event.target.value)} required /><Input label="Observação" value={form.notes ?? ''} onChange={(event) => field('notes', event.target.value)} /></div>;

  return <section className="finance-overview" aria-labelledby="finance-title">
    <div className="finance-overview__heading"><div><span className="ui-muted">Competência {formatMonth(data.month)}</span><h1 id="finance-title">Financeiro</h1></div><p className="ui-muted">Resumo operacional, lançamentos, contas, cartões e recorrências da empresa selecionada.</p></div>
    <Tabs items={tabs} activeId={activeTab} onChange={(id) => setActiveTab(id as FinanceTab)} ariaLabel="Seções do financeiro" />
    {operations.state.errorMessage && modal === null && <Feedback tone="danger" title="Operação não concluída" message={operations.state.errorMessage} />}
    {operations.state.successMessage && modal === null && <Feedback tone="success" title="Concluído" message={operations.state.successMessage} />}

    {activeTab === 'resumo' && <div className="finance-overview__cards" role="tabpanel">
      <Card title="Receitas" description="Planejado × realizado no mês"><dl className="finance-metrics"><div><dt>Planejado</dt><dd>{currency.format(income?.plannedAmount ?? 0)}</dd></div><div><dt>Realizado</dt><dd>{currency.format(income?.realizedAmount ?? 0)}</dd></div><div><dt>Pendente</dt><dd>{currency.format(income?.pendingAmount ?? 0)}</dd></div></dl></Card>
      <Card title="Despesas" description="Inclui parcelas de cartão na competência"><dl className="finance-metrics"><div><dt>Planejado</dt><dd>{currency.format(expense?.plannedAmount ?? 0)}</dd></div><div><dt>Realizado</dt><dd>{currency.format(expense?.realizedAmount ?? 0)}</dd></div><div><dt>Pendente</dt><dd>{currency.format(expense?.pendingAmount ?? 0)}</dd></div></dl></Card>
    </div>}

    {activeTab === 'lancamentos' && <div className="finance-section" role="tabpanel">
      <Card title="Lançamentos" description="Parcelas sempre identificadas pelo número e total" actions={<div className="finance-actions"><Button size="sm" onClick={() => open('entry')}>Novo lançamento</Button><Button size="sm" variant="secondary" onClick={() => open('settlement')}>Pagar / receber</Button><Button size="sm" variant="secondary" onClick={() => open('recurrence')}>Nova recorrência</Button></div>}>
        {data.entries.length === 0 ? <p className="ui-muted">Nenhum lançamento financeiro cadastrado.</p> : <div className="finance-list">{data.entries.map((entry) => { const balance = references?.installmentBalances.find((item) => item.installmentId === entry.installmentId); return <div className="finance-list__group" key={entry.installmentId}><div className="finance-list__row"><strong>{entry.description}</strong><strong>{currency.format(entry.amount)}</strong></div><div className="finance-list__row"><span>{entry.installmentCount > 1 ? `Parcela ${entry.installmentNumber}/${entry.installmentCount}` : 'Parcela única'}</span><span>Vencimento {formatDate(entry.dueDate)}</span></div>{balance && <div className="finance-list__row"><span>Status {balance.financialStatus}</span><span>Saldo {currency.format(balance.remainingAmount)}</span></div>}{entry.installmentNumber === 1 && <div className="finance-actions"><Button size="sm" variant="secondary" onClick={() => editEntry(entry.entryId)}>Editar</Button><Button size="sm" variant="tertiary" onClick={() => open('entryDelete', { entryId: entry.entryId, description: entry.description })}>Excluir</Button></div>}</div>; })}</div>}
      </Card>
      <Card title="Cadastros financeiros" description="Categorias e centros de custo podem ser editados ou inativados" actions={<div className="finance-actions"><Button size="sm" variant="tertiary" onClick={() => open('category')}>Nova categoria</Button><Button size="sm" variant="tertiary" onClick={() => open('costCenter')}>Novo centro de custo</Button></div>}>
        <div className="finance-list">{(references?.categories ?? []).map((item) => <div className="finance-list__group" key={item.id}><div className="finance-list__row"><span>{item.name} · {item.kind}</span><span>{item.status}</span></div><div className="finance-actions"><Button size="sm" variant="secondary" onClick={() => open('category', { id: item.id, name: item.name, kind: item.kind, status: item.status })}>Editar</Button><Button size="sm" variant="tertiary" disabled={operations.state.busy} onClick={() => { void complete(() => operations.updateCategory({ id: item.id, name: item.name, kind: item.kind, status: item.status === 'active' ? 'inactive' : 'active' })).catch(() => undefined); }}>{item.status === 'active' ? 'Inativar' : 'Ativar'}</Button></div></div>)}{(references?.costCenters ?? []).map((item) => <div className="finance-list__group" key={item.id}><div className="finance-list__row"><span>{item.code ? `${item.code} · ` : ''}{item.name}</span><span>{item.status}</span></div><div className="finance-actions"><Button size="sm" variant="secondary" onClick={() => open('costCenter', { id: item.id, name: item.name, code: item.code ?? '', status: item.status })}>Editar</Button><Button size="sm" variant="tertiary" disabled={operations.state.busy} onClick={() => { void complete(() => operations.updateCostCenter({ id: item.id, name: item.name, code: item.code, status: item.status === 'active' ? 'inactive' : 'active' })).catch(() => undefined); }}>{item.status === 'active' ? 'Inativar' : 'Ativar'}</Button></div></div>)}</div>
      </Card>
      <Card title="Recorrências" description="Regras mensais e próxima ocorrência">{(references?.recurrences.length ?? 0) === 0 ? <p className="ui-muted">Nenhuma recorrência cadastrada.</p> : <div className="finance-list">{references?.recurrences.map((item) => <div className="finance-list__group" key={item.id}><div className="finance-list__row"><strong>{item.description}</strong><strong>{currency.format(item.amount)}</strong></div><div className="finance-list__row"><span>Próxima {formatDate(item.nextOccurrenceDate)}</span><Button size="sm" variant="secondary" disabled={operations.state.busy || item.status !== 'active'} onClick={() => { void complete(() => operations.materializeRecurrence(item.id)).catch(() => undefined); }}>Gerar próxima</Button></div></div>)}</div>}</Card>
    </div>}

    {activeTab === 'contas' && <div className="finance-section" role="tabpanel">
      <Card title="Contas e bancos" description="Saldo atual derivado do razão financeiro" actions={<div className="finance-actions"><Button size="sm" onClick={() => open('account')}>Nova conta</Button><Button size="sm" variant="secondary" onClick={() => open('transfer')}>Transferir</Button></div>}>
        {(references?.accounts.length ?? 0) === 0 ? <p className="ui-muted">Nenhuma conta financeira cadastrada.</p> : <div className="finance-list">{references?.accounts.map((account) => <div className="finance-list__group" key={account.id}><div className="finance-list__row"><span>{account.name}</span><strong>{currency.format(data.accountBalances.find((balance) => balance.accountId === account.id)?.currentBalance ?? account.openingBalance)}</strong></div><div className="finance-list__row"><span>{account.accountType}</span><span>{account.status}</span></div><div className="finance-actions"><Button size="sm" variant="secondary" onClick={() => open('account', { id: account.id, name: account.name, accountType: account.accountType, status: account.status })}>Editar</Button><Button size="sm" variant="tertiary" disabled={operations.state.busy} onClick={() => { void complete(() => operations.updateAccount({ id: account.id, name: account.name, accountType: account.accountType, status: account.status === 'active' ? 'inactive' : 'active' })).catch(() => undefined); }}>{account.status === 'active' ? 'Inativar' : 'Ativar'}</Button></div></div>)}</div>}
      </Card>
      <Card title="Transferências" description="Movimentações entre contas da mesma empresa">{(references?.transfers.length ?? 0) === 0 ? <p className="ui-muted">Nenhuma transferência registrada.</p> : <div className="finance-list">{references?.transfers.map((item) => <div className="finance-list__group" key={item.id}><div className="finance-list__row"><span>{formatDate(item.transferOn)}</span><strong>{currency.format(item.amount)}</strong></div><div className="finance-list__row"><span>{references?.accounts.find((account) => account.id === item.fromAccountId)?.name ?? 'Origem'}</span><span>→ {references?.accounts.find((account) => account.id === item.toAccountId)?.name ?? 'Destino'}</span></div></div>)}</div>}</Card>
    </div>}

    {activeTab === 'cartoes' && <div className="finance-section" role="tabpanel">
      <Card title="Cartões" description="Cadastro, limite e manutenção" actions={<div className="finance-actions"><Button size="sm" onClick={() => open('card')}>Novo cartão</Button><Button size="sm" variant="secondary" onClick={() => open('cardPurchase')}>Nova compra</Button><Button size="sm" variant="secondary" onClick={() => open('cardClose')}>Fechar fatura</Button><Button size="sm" variant="secondary" onClick={() => open('cardPayment')}>Pagar fatura</Button></div>}>
        {(references?.cards.length ?? 0) === 0 ? <p className="ui-muted">Nenhum cartão cadastrado.</p> : <div className="finance-list">{references?.cards.map((card) => { const limit = data.cardLimits.find((item) => item.cardId === card.id); return <div className="finance-list__group" key={card.id}><div className="finance-list__row"><strong>{card.name}{card.lastFour ? ` · ${card.lastFour}` : ''}</strong><span>{card.status}</span></div><div className="finance-list__row"><span>Limite {currency.format(card.creditLimit)}</span><span>Disponível {currency.format(limit?.availableLimit ?? card.creditLimit)}</span></div><div className="finance-list__row"><span>Fecha dia {card.closingDay}</span><span>Vence dia {card.dueDay}</span></div><div className="finance-actions"><Button size="sm" variant="secondary" onClick={() => open('card', { id: card.id, name: card.name, lastFour: card.lastFour ?? '', creditLimit: String(card.creditLimit), closingDay: String(card.closingDay), dueDay: String(card.dueDay), defaultPaymentAccountId: card.defaultPaymentAccountId ?? '', status: card.status })}>Editar</Button><Button size="sm" variant="tertiary" disabled={operations.state.busy} onClick={() => { void complete(() => operations.updateCard({ id: card.id, name: card.name, lastFour: card.lastFour, creditLimit: card.creditLimit, closingDay: card.closingDay, dueDay: card.dueDay, defaultPaymentAccountId: card.defaultPaymentAccountId, status: card.status === 'active' ? 'inactive' : 'active' })).catch(() => undefined); }}>{card.status === 'active' ? 'Inativar' : 'Ativar'}</Button></div></div>; })}</div>}
      </Card>
      <Card title="Parcelas dos cartões" description="Toda compra parcelada mantém identificação X/Y">{(references?.cardInstallments.length ?? 0) === 0 ? <p className="ui-muted">Nenhuma parcela de cartão registrada.</p> : <div className="finance-list">{references?.cardInstallments.map((item) => <div className="finance-list__row" key={item.id}><span>{references?.cards.find((card) => card.id === item.cardId)?.name ?? 'Cartão'} · Parcela {item.installmentNumber}/{item.installmentCount} · {formatMonth(item.statementMonth)}</span><strong>{currency.format(item.amount)}</strong></div>)}</div>}</Card>
      <Card title="Faturas" description="Valores, saldo e status de pagamento">{(references?.statements.length ?? 0) === 0 ? <p className="ui-muted">Nenhuma fatura registrada.</p> : <div className="finance-list">{references?.statements.map((item) => <div className="finance-list__group" key={item.statementId}><div className="finance-list__row"><strong>{references?.cards.find((card) => card.id === item.cardId)?.name ?? 'Cartão'}</strong><strong>{formatMonth(item.statementMonth)}</strong></div><div className="finance-list__row"><span>{item.paymentStatus}</span><span>Fatura {currency.format(item.statementAmount)} · saldo {currency.format(item.remainingAmount)}</span></div></div>)}</div>}</Card>
    </div>}

    <Dialog open={modal !== null} title={modal ? modalTitles[modal] : 'Financeiro'} description="Operação vinculada exclusivamente à empresa selecionada." loading={operations.state.busy} confirmLabel={modal === 'entryDelete' ? 'Excluir' : 'Salvar'} onClose={close} onBack={close} onConfirm={modal ? () => { void submitModal(); } : undefined}>
      {operations.state.errorMessage && <Feedback tone="danger" title="Não foi possível salvar" message={operations.state.errorMessage} />}
      {modalContent}
    </Dialog>
  </section>;
}
