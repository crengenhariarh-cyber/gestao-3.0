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

interface CardsPageProps { company: CompanySummary; }
type ModalKind = 'card' | 'purchase' | 'close' | 'payment' | null;
type CardsTab = 'cartoes' | 'parcelas' | 'faturas';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function today(): string { return new Date().toISOString().slice(0, 10); }
function monthInput(): string { return today().slice(0, 7); }
function monthStart(value: string): string { return `${value}-01`; }
function money(value: string): number { return Number(value.replace(',', '.')); }
function key(prefix: string): string { return `${prefix}:${crypto.randomUUID()}`; }
function formatMonth(value: string): string { const [year, month] = value.split('-'); return `${month}/${year}`; }
function formatDate(value: string): string { const [year, month, day] = value.split('-'); return `${day}/${month}/${year}`; }
function statementLabel(status: string): string {
  if (status === 'paid') return 'Paga';
  if (status === 'partial') return 'Parcial';
  return 'Em aberto';
}

export function CardsPage({ company }: CardsPageProps) {
  const scope = useMemo(() => ({ tenantId: company.tenantId, companyId: company.id }), [company.id, company.tenantId]);
  const [refreshToken, setRefreshToken] = useState(0);
  const [activeTab, setActiveTab] = useState<CardsTab>('cartoes');
  const [selectedCardId, setSelectedCardId] = useState('');
  const [modal, setModal] = useState<ModalKind>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const overview = useFinanceOverview(scope, refreshToken);
  const operations = useFinanceOperations(scope);
  const references = operations.state.references;

  if (overview.status === 'idle' || overview.status === 'loading') return <LoadingState label="Carregando cartões…" />;
  if (overview.status === 'error') return <EmptyState title="Cartões indisponíveis" message={overview.errorMessage} />;
  if (overview.data === null) return <LoadingState label="Carregando cartões…" />;

  const data = overview.data;
  const cards = references?.cards ?? [];
  const activeCards = cards.filter((item) => item.status === 'active');
  const accounts = (references?.accounts ?? []).filter((item) => item.status === 'active');
  const categories = (references?.categories ?? []).filter((item) => item.status === 'active' && (item.kind === 'expense' || item.kind === 'both'));
  const costCenters = (references?.costCenters ?? []).filter((item) => item.status === 'active');
  const installments = (references?.cardInstallments ?? []).filter((item) => !selectedCardId || item.cardId === selectedCardId);
  const statements = (references?.statements ?? []).filter((item) => !selectedCardId || item.cardId === selectedCardId);
  const openStatements = statements.filter((item) => item.remainingAmount > 0);
  const selectedCard = cards.find((item) => item.id === selectedCardId) ?? null;
  const totalLimit = activeCards.reduce((total, item) => total + item.creditLimit, 0);
  const totalCommitted = data.cardLimits.filter((item) => activeCards.some((card) => card.id === item.cardId)).reduce((total, item) => total + item.committedAmount, 0);
  const totalAvailable = data.cardLimits.filter((item) => activeCards.some((card) => card.id === item.cardId)).reduce((total, item) => total + item.availableLimit, 0);

  const tabs = [
    { id: 'cartoes', label: 'Cartões' },
    { id: 'parcelas', label: 'Parcelas' },
    { id: 'faturas', label: 'Faturas' },
  ];

  function field(name: string, value: string) { setForm((current) => ({ ...current, [name]: value })); }
  function open(kind: Exclude<ModalKind, null>, values: Record<string, string> = {}) {
    operations.clearFeedback();
    const defaults: Record<Exclude<ModalKind, null>, Record<string, string>> = {
      card: { id: '', name: '', lastFour: '', creditLimit: '', closingDay: '5', dueDay: '15', defaultPaymentAccountId: '', status: 'active' },
      purchase: { cardId: selectedCardId || activeCards[0]?.id || '', purchaseDate: today(), description: '', counterparty: '', categoryId: '', costCenterId: '', totalAmount: '', installmentCount: '1', notes: '' },
      close: { cardId: selectedCardId || activeCards[0]?.id || '', statementMonth: monthInput() },
      payment: { statementId: openStatements[0]?.statementId || '', accountId: '', paidOn: today(), amount: openStatements[0] ? String(openStatements[0].remainingAmount) : '', notes: '' },
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
  async function submitModal() {
    try {
      if (modal === 'card') {
        const input = { name: form.name ?? '', lastFour: form.lastFour || null, creditLimit: money(form.creditLimit ?? '0'), closingDay: Number(form.closingDay ?? '1'), dueDay: Number(form.dueDay ?? '1'), defaultPaymentAccountId: form.defaultPaymentAccountId || null };
        if (form.id) await complete(() => operations.updateCard({ ...input, id: form.id ?? '', status: form.status === 'inactive' ? 'inactive' : 'active' }));
        else await complete(() => operations.createCard(input));
      }
      if (modal === 'purchase') await complete(() => operations.createCardPurchase({ cardId: form.cardId ?? '', purchaseDate: form.purchaseDate ?? today(), description: form.description ?? '', counterpartyName: form.counterparty || null, categoryId: form.categoryId ?? '', costCenterId: form.costCenterId || null, totalAmount: money(form.totalAmount ?? '0'), installmentCount: Number(form.installmentCount ?? '1'), idempotencyKey: key('card-purchase'), notes: form.notes || null }));
      if (modal === 'close') await complete(() => operations.closeCardStatement({ cardId: form.cardId ?? '', statementMonth: monthStart(form.statementMonth ?? monthInput()) }));
      if (modal === 'payment') await complete(() => operations.payCardStatement({ statementId: form.statementId ?? '', accountId: form.accountId ?? '', paidOn: form.paidOn ?? today(), amount: money(form.amount ?? '0'), idempotencyKey: key('card-payment'), notes: form.notes || null }));
    } catch { /* feedback normalizado permanece no modal */ }
  }

  const cardOptions = [{ value: '', label: 'Selecione…' }, ...activeCards.map((item) => ({ value: item.id, label: item.name }))];
  const accountOptions = [{ value: '', label: 'Selecione…' }, ...accounts.map((item) => ({ value: item.id, label: item.name }))];
  const categoryOptions = [{ value: '', label: 'Selecione…' }, ...categories.map((item) => ({ value: item.id, label: item.name }))];
  const costCenterOptions = [{ value: '', label: 'Sem centro de custo' }, ...costCenters.map((item) => ({ value: item.id, label: item.code ? `${item.code} · ${item.name}` : item.name }))];
  const statementOptions = [{ value: '', label: 'Selecione…' }, ...openStatements.map((item) => ({ value: item.statementId, label: `${cards.find((card) => card.id === item.cardId)?.name ?? 'Cartão'} · ${formatMonth(item.statementMonth)} · ${currency.format(item.remainingAmount)}` }))];

  let modalContent = null;
  if (modal === 'card') modalContent = <div className="finance-form-grid"><Input label="Nome do cartão" value={form.name ?? ''} onChange={(event) => field('name', event.target.value)} required /><Input label="Últimos 4 dígitos" inputMode="numeric" maxLength={4} value={form.lastFour ?? ''} onChange={(event) => field('lastFour', event.target.value)} /><Input label="Limite" type="number" min="0" step="0.01" value={form.creditLimit ?? ''} onChange={(event) => field('creditLimit', event.target.value)} required /><Input label="Dia de fechamento" type="number" min="1" max="31" value={form.closingDay ?? '5'} onChange={(event) => field('closingDay', event.target.value)} required /><Input label="Dia de vencimento" type="number" min="1" max="31" value={form.dueDay ?? '15'} onChange={(event) => field('dueDay', event.target.value)} required /><Select label="Conta padrão de pagamento" value={form.defaultPaymentAccountId ?? ''} onChange={(event) => field('defaultPaymentAccountId', event.target.value)} options={[{ value: '', label: 'Sem conta padrão' }, ...accounts.map((item) => ({ value: item.id, label: item.name }))]} /></div>;
  if (modal === 'purchase') modalContent = <div className="finance-form-grid"><Select label="Cartão" value={form.cardId ?? ''} onChange={(event) => field('cardId', event.target.value)} options={cardOptions} required /><Input label="Data da compra" type="date" value={form.purchaseDate ?? today()} onChange={(event) => field('purchaseDate', event.target.value)} required /><Input label="Descrição" value={form.description ?? ''} onChange={(event) => field('description', event.target.value)} required /><Input label="Fornecedor" value={form.counterparty ?? ''} onChange={(event) => field('counterparty', event.target.value)} /><Select label="Categoria" value={form.categoryId ?? ''} onChange={(event) => field('categoryId', event.target.value)} options={categoryOptions} required /><Select label="Centro de custo" value={form.costCenterId ?? ''} onChange={(event) => field('costCenterId', event.target.value)} options={costCenterOptions} /><Input label="Valor total" type="number" min="0.01" step="0.01" value={form.totalAmount ?? ''} onChange={(event) => field('totalAmount', event.target.value)} required /><Input label="Parcelas" type="number" min="1" max="120" step="1" value={form.installmentCount ?? '1'} onChange={(event) => field('installmentCount', event.target.value)} required /><Input label="Observação" value={form.notes ?? ''} onChange={(event) => field('notes', event.target.value)} /></div>;
  if (modal === 'close') modalContent = <div className="finance-form-grid"><Select label="Cartão" value={form.cardId ?? ''} onChange={(event) => field('cardId', event.target.value)} options={cardOptions} required /><Input label="Competência da fatura" type="month" value={form.statementMonth ?? monthInput()} onChange={(event) => field('statementMonth', event.target.value)} required /></div>;
  if (modal === 'payment') modalContent = <div className="finance-form-grid"><Select label="Fatura" value={form.statementId ?? ''} onChange={(event) => { const selected = openStatements.find((item) => item.statementId === event.target.value); field('statementId', event.target.value); if (selected) field('amount', String(selected.remainingAmount)); }} options={statementOptions} required /><Select label="Conta" value={form.accountId ?? ''} onChange={(event) => field('accountId', event.target.value)} options={accountOptions} required /><Input label="Data" type="date" value={form.paidOn ?? today()} onChange={(event) => field('paidOn', event.target.value)} required /><Input label="Valor" type="number" min="0.01" step="0.01" value={form.amount ?? ''} onChange={(event) => field('amount', event.target.value)} required /><Input label="Observação" value={form.notes ?? ''} onChange={(event) => field('notes', event.target.value)} /></div>;

  return <section className="finance-overview" aria-labelledby="cards-title">
    <div className="finance-overview__heading"><div><span className="ui-muted">Empresa</span><h1 id="cards-title">Cartões</h1></div><p className="ui-muted">Limites, compras parceladas, ciclos e pagamentos de faturas.</p></div>

    {operations.state.successMessage && <Feedback tone="success" title="Operação concluída" message={operations.state.successMessage} />}
    {operations.state.errorMessage && modal === null && <Feedback tone="danger" title="Não foi possível concluir" message={operations.state.errorMessage} />}

    <div className="finance-kpis">
      <Card title="Limite total"><strong>{currency.format(totalLimit)}</strong></Card>
      <Card title="Comprometido"><strong>{currency.format(totalCommitted)}</strong></Card>
      <Card title="Disponível"><strong>{currency.format(totalAvailable)}</strong></Card>
      <Card title="Faturas abertas"><strong>{currency.format(openStatements.reduce((total, item) => total + item.remainingAmount, 0))}</strong></Card>
    </div>

    <Card title="Ações" description="Operações do cartão selecionado">
      <div className="finance-actions"><Button size="sm" onClick={() => open('purchase')} disabled={activeCards.length === 0}>Nova compra</Button><Button size="sm" variant="secondary" onClick={() => open('close')} disabled={activeCards.length === 0}>Fechar fatura</Button><Button size="sm" variant="secondary" onClick={() => open('payment')} disabled={openStatements.length === 0}>Pagar fatura</Button><Button size="sm" variant="tertiary" onClick={() => open('card')}>Novo cartão</Button></div>
      <Select label="Filtrar por cartão" value={selectedCardId} onChange={(event) => setSelectedCardId(event.target.value)} options={[{ value: '', label: 'Todos os cartões' }, ...cards.map((item) => ({ value: item.id, label: item.name }))]} />
      {selectedCard && <p className="ui-muted">Visualizando apenas {selectedCard.name}.</p>}
    </Card>

    <Tabs tabs={tabs} activeTab={activeTab} onChange={(value) => setActiveTab(value as CardsTab)} />

    {activeTab === 'cartoes' && <div className="finance-section" role="tabpanel">
      <Card title="Meus cartões" description="Cadastro, limite, fechamento e vencimento">
        {cards.length === 0 ? <EmptyState title="Nenhum cartão cadastrado" message="Cadastre o primeiro cartão para começar." /> : <div className="finance-list">{cards.map((card) => { const limit = data.cardLimits.find((item) => item.cardId === card.id); return <div className="finance-list__group" key={card.id}><div className="finance-list__row"><strong>{card.name}{card.lastFour ? ` · ${card.lastFour}` : ''}</strong><span>{card.status === 'active' ? 'Ativo' : 'Inativo'}</span></div><div className="finance-list__row"><span>Limite {currency.format(card.creditLimit)}</span><span>Comprometido {currency.format(limit?.committedAmount ?? 0)}</span></div><div className="finance-list__row"><span>Disponível {currency.format(limit?.availableLimit ?? card.creditLimit)}</span><span>Fecha {card.closingDay} · vence {card.dueDay}</span></div><div className="finance-actions"><Button size="sm" variant="secondary" onClick={() => open('card', { id: card.id, name: card.name, lastFour: card.lastFour ?? '', creditLimit: String(card.creditLimit), closingDay: String(card.closingDay), dueDay: String(card.dueDay), defaultPaymentAccountId: card.defaultPaymentAccountId ?? '', status: card.status })}>Editar</Button><Button size="sm" variant="tertiary" disabled={operations.state.busy} onClick={() => { void complete(() => operations.updateCard({ id: card.id, name: card.name, lastFour: card.lastFour, creditLimit: card.creditLimit, closingDay: card.closingDay, dueDay: card.dueDay, defaultPaymentAccountId: card.defaultPaymentAccountId, status: card.status === 'active' ? 'inactive' : 'active' })).catch(() => undefined); }}>{card.status === 'active' ? 'Inativar' : 'Ativar'}</Button></div></div>; })}</div>}
      </Card>
    </div>}

    {activeTab === 'parcelas' && <div className="finance-section" role="tabpanel"><Card title="Parcelas" description="Toda compra parcelada mantém identificação X/Y e competência da fatura">{installments.length === 0 ? <EmptyState title="Nenhuma parcela encontrada" message="Não há parcelas para o filtro atual." /> : <div className="finance-list">{installments.map((item) => <div className="finance-list__row" key={item.id}><span>{cards.find((card) => card.id === item.cardId)?.name ?? 'Cartão'} · Parcela {item.installmentNumber}/{item.installmentCount} · {formatMonth(item.statementMonth)}</span><strong>{currency.format(item.amount)}</strong></div>)}</div>}</Card></div>}

    {activeTab === 'faturas' && <div className="finance-section" role="tabpanel"><Card title="Faturas" description="Valor original, valor pago, saldo e vencimento">{statements.length === 0 ? <EmptyState title="Nenhuma fatura encontrada" message="Ainda não há faturas para o filtro atual." /> : <div className="finance-list">{statements.map((item) => <div className="finance-list__group" key={item.statementId}><div className="finance-list__row"><strong>{cards.find((card) => card.id === item.cardId)?.name ?? 'Cartão'} · {formatMonth(item.statementMonth)}</strong><strong>{currency.format(item.statementAmount)}</strong></div><div className="finance-list__row"><span>{statementLabel(item.paymentStatus)} · vence {formatDate(item.dueDate)}</span><span>Pago {currency.format(item.paidAmount)} · saldo {currency.format(item.remainingAmount)}</span></div>{item.remainingAmount > 0 && <div className="finance-actions"><Button size="sm" variant="secondary" onClick={() => open('payment', { statementId: item.statementId, accountId: cards.find((card) => card.id === item.cardId)?.defaultPaymentAccountId ?? '', paidOn: today(), amount: String(item.remainingAmount), notes: '' })}>Pagar</Button></div>}</div>)}</div>}</Card></div>}

    <Dialog open={modal !== null} title={modal === 'card' ? (form.id ? 'Editar cartão' : 'Novo cartão') : modal === 'purchase' ? 'Nova compra no cartão' : modal === 'close' ? 'Fechar fatura' : 'Pagar fatura'} description="Operação vinculada exclusivamente à empresa selecionada." loading={operations.state.busy} confirmLabel="Salvar" onClose={close} onBack={close} onConfirm={modal ? () => { void submitModal(); } : undefined}>
      {operations.state.errorMessage && <Feedback tone="danger" title="Não foi possível salvar" message={operations.state.errorMessage} />}
      {modalContent}
    </Dialog>
  </section>;
}
