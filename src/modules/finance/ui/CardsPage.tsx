import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import type { CardStatementBalance, CardStatementItem, CreditCard, CreditCardLimit } from '../domain/cards';
import { getFinanceRepositories } from '../infrastructure/createFinanceRepositories';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Dialog } from '../../../shared/ui/Dialog';
import { EmptyState, Feedback, LoadingState } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Select } from '../../../shared/ui/Select';
import { SortableHandle } from '../../../shared/ui/SortableHandle';
import '../../home/ui/bank-brand.css';
import './cards-page.css';

type CardTone = 'itau' | 'nubank' | 'inter' | 'santander' | 'caixa' | 'sicoob' | 'bradesco' | 'bb' | 'sicredi' | 'c6' | 'generic';
type ListedCard = CreditCardLimit & { companyName: string; lastFour: string | null; dueDay: number; closingDay: number; defaultPaymentAccountId: string | null; status: CreditCard['status'] };
type CardDialog = 'details' | 'edit' | 'delete' | null;

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function companyName(company: CompanySummary): string { return company.tradeName ?? company.legalName; }
function monthKey(date = new Date()): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`; }
function monthLabel(value: string): string { return value.slice(0, 7).split('-').reverse().join('/'); }
function dateLabel(value: string): string { return value.split('-').reverse().join('/'); }
function money(value: string): number { return Number(value.replace(',', '.')); }
function cardVisual(name: string): { tone: CardTone; mark: string; institution: string } {
  const raw = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase('pt-BR');
  if (raw.includes('NUBANK') || raw.includes('NU ')) return { tone: 'nubank', mark: 'nu', institution: 'Nubank' };
  if (raw.includes('ITAU') || raw.includes('ITI')) return { tone: 'itau', mark: raw.includes('ITI') ? 'iti' : 'itaú', institution: 'Itaú' };
  if (raw.includes('INTER')) return { tone: 'inter', mark: 'inter', institution: 'Inter' };
  if (raw.includes('SANTANDER')) return { tone: 'santander', mark: 'Santander', institution: 'Santander' };
  if (raw.includes('CAIXA')) return { tone: 'caixa', mark: 'CAIXA', institution: 'Caixa' };
  if (raw.includes('SICOOB')) return { tone: 'sicoob', mark: 'SICOOB', institution: 'Sicoob' };
  if (raw.includes('BRADESCO')) return { tone: 'bradesco', mark: 'bradesco', institution: 'Bradesco' };
  if (raw.includes('BANCO DO BRASIL') || /(^|\s)BB(\s|$)/.test(raw)) return { tone: 'bb', mark: 'BB', institution: 'Banco do Brasil' };
  if (raw.includes('SICREDI')) return { tone: 'sicredi', mark: 'Sicredi', institution: 'Sicredi' };
  if (raw.includes('C6')) return { tone: 'c6', mark: 'C6', institution: 'C6 Bank' };
  return { tone: 'generic', mark: 'CARD', institution: 'Cartão' };
}

export function CardsPage({ companies }: { companies: readonly CompanySummary[] }) {
  const repositories = useMemo(() => getFinanceRepositories(), []);
  const uniqueCompanies = useMemo(() => [...new Map(companies.map((company) => [company.id, company])).values()], [companies]);
  const [cards, setCards] = useState<readonly ListedCard[]>([]);
  const [selected, setSelected] = useState<ListedCard | null>(null);
  const [dialog, setDialog] = useState<CardDialog>(null);
  const [menuCardId, setMenuCardId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', lastFour: '', creditLimit: '', closingDay: '10', dueDay: '20', defaultPaymentAccountId: '', status: 'active' as CreditCard['status'] });
  const [statementItems, setStatementItems] = useState<readonly CardStatementItem[]>([]);
  const [statements, setStatements] = useState<readonly CardStatementBalance[]>([]);
  const [selectedStatementMonth, setSelectedStatementMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tenantId = uniqueCompanies[0]?.tenantId ?? '';
  const currentMonth = monthKey();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const groups = await Promise.all(uniqueCompanies.map(async (company) => {
        const scope = { tenantId: company.tenantId, companyId: company.id };
        const [limits, registered] = await Promise.all([
          repositories.cards.listLimits(scope),
          repositories.cards.listCards(scope),
        ]);
        const byId = new Map<string, CreditCard>(registered.map((item) => [item.id, item]));
        return limits.flatMap((item) => {
          const card = byId.get(item.cardId);
          if (!card || card.status !== 'active') return [];
          return [{ ...item, companyName: companyName(company), lastFour: card.lastFour ?? null, dueDay: card.dueDay ?? 0, closingDay: card.closingDay ?? 0, defaultPaymentAccountId: card.defaultPaymentAccountId ?? null, status: card.status }];
        });
      }));
      const uniqueCards = [...new Map(groups.flat().map((item) => [item.cardId, item])).values()];
      setCards(uniqueCards.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));
    } catch {
      setError('Não foi possível carregar os cartões.');
    } finally {
      setLoading(false);
    }
  }, [repositories.cards, uniqueCompanies]);

  useEffect(() => { void load(); }, [load]);

  async function reorder(orderedIds: readonly string[]) {
    if (!tenantId || orderedIds.length < 2) return;
    try {
      setError(null);
      await repositories.cards.reorder(tenantId, orderedIds);
      await load();
      window.dispatchEvent(new Event('finance-card-order-changed'));
    } catch {
      setError('Não foi possível salvar a nova ordem dos cartões.');
    }
  }

  async function openDetails(item: ListedCard) {
    setMenuCardId(null);
    setSelected(item);
    setDialog('details');
    setDetailsLoading(true);
    setStatementItems([]);
    setStatements([]);
    setSelectedStatementMonth('');
    try {
      const scope = { tenantId: item.tenantId, companyId: item.companyId };
      const [items, closed] = await Promise.all([
        repositories.cards.listStatementItems(scope, item.cardId),
        repositories.cards.listStatements(scope, item.cardId),
      ]);
      setStatementItems(items);
      setStatements(closed);
      const availableMonths = [...new Set(items.map((line) => line.statementMonth))]
        .filter((month) => month <= currentMonth)
        .sort((a, b) => b.localeCompare(a));
      setSelectedStatementMonth(availableMonths.includes(currentMonth) ? currentMonth : availableMonths[0] ?? '');
    } catch {
      setStatementItems([]);
      setStatements([]);
      setError('Não foi possível carregar as faturas deste cartão.');
    } finally {
      setDetailsLoading(false);
    }
  }

  function openEdit(item: ListedCard) {
    setMenuCardId(null);
    setSelected(item);
    setEditForm({ name: item.name, lastFour: item.lastFour ?? '', creditLimit: String(item.creditLimit), closingDay: String(item.closingDay || 1), dueDay: String(item.dueDay || 1), defaultPaymentAccountId: item.defaultPaymentAccountId ?? '', status: item.status });
    setDialog('edit');
  }

  function openDelete(item: ListedCard) {
    setMenuCardId(null);
    setSelected(item);
    setDialog('delete');
  }

  async function saveEdit() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await repositories.cards.updateCard({
        tenantId: selected.tenantId,
        companyId: selected.companyId,
        id: selected.cardId,
        name: editForm.name,
        lastFour: editForm.lastFour || null,
        creditLimit: money(editForm.creditLimit),
        closingDay: Number(editForm.closingDay),
        dueDay: Number(editForm.dueDay),
        defaultPaymentAccountId: editForm.defaultPaymentAccountId || null,
        status: editForm.status,
      });
      setDialog(null);
      setSelected(null);
      await load();
      window.dispatchEvent(new Event('finance-card-order-changed'));
    } catch {
      setError('Não foi possível salvar as alterações do cartão.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await repositories.cards.updateCard({
        tenantId: selected.tenantId,
        companyId: selected.companyId,
        id: selected.cardId,
        name: selected.name,
        lastFour: selected.lastFour,
        creditLimit: selected.creditLimit,
        closingDay: selected.closingDay,
        dueDay: selected.dueDay,
        defaultPaymentAccountId: selected.defaultPaymentAccountId,
        status: 'inactive',
      });
      setDialog(null);
      setSelected(null);
      await load();
      window.dispatchEvent(new Event('finance-card-order-changed'));
    } catch {
      setError('Não foi possível excluir o cartão.');
    } finally {
      setSaving(false);
    }
  }

  const selectableMonths = useMemo(() => [...new Set(statementItems.map((line) => line.statementMonth))]
    .filter((month) => month <= currentMonth)
    .sort((a, b) => b.localeCompare(a)), [statementItems, currentMonth]);

  const selectedItems = useMemo(() => statementItems.filter((item) => item.statementMonth === selectedStatementMonth), [statementItems, selectedStatementMonth]);
  const selectedClosedStatement = useMemo(() => statements.find((statement) => statement.statementMonth === selectedStatementMonth) ?? null, [statements, selectedStatementMonth]);
  const selectedTotal = selectedClosedStatement?.statementAmount ?? selectedItems.reduce((sum, item) => sum + item.amount, 0);

  if (loading) return <LoadingState label="Carregando cartões…" />;
  if (cards.length === 0) return <><PageHeader title="Cartões"/><EmptyState title="Nenhum cartão" message="Não há cartões ativos para exibir." /></>;

  const totalLimit = cards.reduce((sum, item) => sum + item.creditLimit, 0);
  const totalUsed = cards.reduce((sum, item) => sum + item.committedAmount, 0);
  const totalAvailable = cards.reduce((sum, item) => sum + item.availableLimit, 0);

  return <div className="cards-page">
    <PageHeader title="Cartões" />
    {error && <Feedback tone="danger" title="Cartões" message={error} />}

    <div className="cards-page__summary" aria-label="Resumo dos cartões">
      <Card><span>Limite total</span><strong>{currency.format(totalLimit)}</strong></Card>
      <Card><span>Utilizado</span><strong className="cards-page__used">{currency.format(totalUsed)}</strong></Card>
      <Card><span>Disponível</span><strong className="cards-page__available">{currency.format(totalAvailable)}</strong></Card>
    </div>

    <div className="cards-page__list" aria-label="Cartões">
      {cards.map((item) => {
        const visual = cardVisual(item.name);
        return <div key={item.cardId} className={`cards-page__item bank-brand bank-brand--${visual.tone}`} data-sort-group="credit-card-global" data-sort-tenant={tenantId} data-sort-id={item.cardId}>
          <SortableHandle itemId={item.cardId} tenantId={tenantId} group="credit-card-global" label={`Arrastar ${item.name} para reorganizar`} onReorder={reorder} />
          <button type="button" className="cards-page__menu-trigger" aria-label={`Ações de ${item.name}`} aria-expanded={menuCardId===item.cardId} onClick={(event)=>{event.stopPropagation();setMenuCardId(menuCardId===item.cardId?null:item.cardId);}}>⋯</button>
          {menuCardId===item.cardId&&<div className="cards-page__menu" role="menu"><button type="button" onClick={()=>openEdit(item)}>Editar</button><button type="button" className="is-danger" onClick={()=>openDelete(item)}>Excluir</button></div>}
          <Button variant="tertiary" className="cards-page__card" onClick={() => { void openDetails(item); }} aria-label={`Abrir faturas de ${item.name}`}>
            <span className="bank-brand__mark" aria-hidden="true">{visual.mark}</span>
            <span className="cards-page__identity"><strong>{item.name}</strong><small>{item.lastFour ? `Final ${item.lastFour}` : visual.institution}</small>{item.dueDay > 0 && <small>Vence dia {item.dueDay}</small>}</span>
            <span className="cards-page__limits">
              <span><small>Limite</small><strong>{currency.format(item.creditLimit)}</strong></span>
              <span><small>Utilizado</small><strong className="cards-page__used">{currency.format(item.committedAmount)}</strong></span>
              <span><small>Disponível</small><strong className="cards-page__available">{currency.format(item.availableLimit)}</strong></span>
            </span>
            <span className="cards-page__chevron" aria-hidden="true">›</span>
          </Button>
        </div>;
      })}
    </div>

    <Dialog open={dialog === 'details' && selected !== null} title={selected ? `Faturas · ${selected.name}` : 'Faturas'} description={selected?.lastFour ? `Final ${selected.lastFour}` : undefined} onClose={() => {setSelected(null);setDialog(null);}} onBack={() => {setSelected(null);setDialog(null);}}>
      {selected && <div className="cards-page__details">
        {detailsLoading ? <LoadingState label="Carregando faturas…" /> : selectableMonths.length === 0 ? <EmptyState title="Nenhuma fatura" message="Este cartão não possui faturas com lançamentos." /> : <>
          <div className="cards-page__statement-filter">
            <label htmlFor="card-statement-month">Fatura</label>
            <select id="card-statement-month" value={selectedStatementMonth} onChange={(event) => setSelectedStatementMonth(event.target.value)}>
              {selectableMonths.map((month) => {
                const closedStatement = statements.find((statement) => statement.statementMonth === month);
                const label = month === currentMonth ? 'Fatura atual' : closedStatement ? 'Fatura fechada' : 'Fatura anterior';
                return <option key={month} value={month}>{`${label} · ${monthLabel(month)}`}</option>;
              })}
            </select>
          </div>
          <div className="cards-page__invoice-head"><span><small>{selectedStatementMonth === currentMonth ? 'Fatura atual' : selectedClosedStatement ? 'Fatura fechada' : 'Fatura anterior'}</small><strong>{monthLabel(selectedStatementMonth)}</strong></span><span><small>Total da fatura</small><strong>{currency.format(selectedTotal)}</strong></span>{selectedClosedStatement?.dueDate && <span><small>Vencimento</small><strong>{dateLabel(selectedClosedStatement.dueDate)}</strong></span>}{selectedClosedStatement && <span><small>Status</small><strong>{selectedClosedStatement.paymentStatus === 'paid' ? 'Paga' : selectedClosedStatement.paymentStatus === 'partial' ? 'Parcial' : 'Pendente'}</strong></span>}</div>
          <div className="cards-page__invoice-lines" aria-label={`Lançamentos da fatura ${monthLabel(selectedStatementMonth)}`}>{selectedItems.map((item) => <div key={`${item.transactionId}-${item.installmentNumber}`} className="cards-page__invoice-line"><span className="cards-page__invoice-description"><strong>{item.description}</strong><small>{dateLabel(item.purchaseDate)}{item.counterpartyName ? ` · ${item.counterpartyName}` : ''}{item.installmentCount > 1 ? ` · Parcela ${item.installmentLabel}` : ''}</small></span><strong className="cards-page__invoice-value">{currency.format(item.amount)}</strong></div>)}</div>
        </>}
      </div>}
    </Dialog>

    <Dialog open={dialog==='edit'&&selected!==null} title="Editar cartão" onClose={()=>{setDialog(null);setSelected(null);}} onBack={()=>{setDialog(null);setSelected(null);}} loading={saving} footer={<><Button variant="secondary" onClick={()=>{setDialog(null);setSelected(null);}}>Cancelar</Button><Button onClick={()=>{void saveEdit();}}>Salvar alterações</Button></>}>
      <div className="finance-form-grid">
        <Input label="Nome do cartão" value={editForm.name} onChange={(e)=>setEditForm(v=>({...v,name:e.target.value}))}/>
        <Input label="Final do cartão" value={editForm.lastFour} maxLength={4} onChange={(e)=>setEditForm(v=>({...v,lastFour:e.target.value.replace(/\D/g,'').slice(0,4)}))}/>
        <Input label="Limite de crédito" inputMode="decimal" value={editForm.creditLimit} onChange={(e)=>setEditForm(v=>({...v,creditLimit:e.target.value}))}/>
        <Input label="Dia de fechamento" type="number" min={1} max={31} value={editForm.closingDay} onChange={(e)=>setEditForm(v=>({...v,closingDay:e.target.value}))}/>
        <Input label="Dia de vencimento" type="number" min={1} max={31} value={editForm.dueDay} onChange={(e)=>setEditForm(v=>({...v,dueDay:e.target.value}))}/>
        <Select label="Status" value={editForm.status} onChange={(e)=>setEditForm(v=>({...v,status:e.target.value==='inactive'?'inactive':'active'}))} options={[{value:'active',label:'Ativo'},{value:'inactive',label:'Inativo'}]}/>
      </div>
    </Dialog>

    <Dialog open={dialog==='delete'&&selected!==null} title="Excluir cartão" onClose={()=>{setDialog(null);setSelected(null);}} onBack={()=>{setDialog(null);setSelected(null);}} loading={saving} footer={<><Button variant="secondary" onClick={()=>{setDialog(null);setSelected(null);}}>Cancelar</Button><Button variant="danger" onClick={()=>{void confirmDelete();}}>Excluir cartão</Button></>}>
      <p>Tem certeza que deseja excluir <strong>{selected?.name}</strong>? O cartão será desativado para preservar o histórico financeiro e as faturas já registradas.</p>
    </Dialog>
  </div>;
}
