import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import type { CardStatementBalance, CardStatementItem, CreditCard, CreditCardLimit } from '../domain/cards';
import type { FinancialBankInstitution } from '../domain/registries';
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
type ListedCard = CreditCardLimit & { companyName: string; bankInstitution: FinancialBankInstitution | null; lastFour: string | null; dueDay: number; closingDay: number; defaultPaymentAccountId: string | null; status: CreditCard['status'] };
type CardDialog = 'details' | 'create' | 'edit' | 'delete' | null;
type CardForm = { companyId: string; name: string; bankInstitution: FinancialBankInstitution | ''; creditLimit: string; closingDay: string; dueDay: string; status: CreditCard['status']; lastFour: string; defaultPaymentAccountId: string };

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const bankInstitutionOptions = [
  { value: '', label: 'Selecione…' },
  { value: 'itau', label: 'Itaú' }, { value: 'nubank', label: 'Nubank' }, { value: 'inter', label: 'Inter' },
  { value: 'santander', label: 'Santander' }, { value: 'caixa', label: 'Caixa' }, { value: 'sicoob', label: 'Sicoob' },
  { value: 'bradesco', label: 'Bradesco' }, { value: 'bb', label: 'Banco do Brasil' }, { value: 'sicredi', label: 'Sicredi' }, { value: 'c6', label: 'C6 Bank' },
];
function companyName(company: CompanySummary): string { return company.tradeName ?? company.legalName; }
function monthKey(date = new Date()): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`; }
function monthLabel(value: string): string { return value.slice(0, 7).split('-').reverse().join('/'); }
function dateLabel(value: string): string { return value.split('-').reverse().join('/'); }
function money(value: string): number { return Number(value.replace(',', '.')); }
function cardVisual(institution: FinancialBankInstitution | null, name: string): { tone: CardTone; mark: string; institution: string } {
  const raw = `${institution ?? ''} ${name}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase('pt-BR');
  if (institution === 'nubank' || raw.includes('NUBANK') || raw.includes('NU ')) return { tone: 'nubank', mark: 'nu', institution: 'Nubank' };
  if (institution === 'itau' || raw.includes('ITAU') || raw.includes('ITI')) return { tone: 'itau', mark: raw.includes('ITI') ? 'iti' : 'itaú', institution: 'Itaú' };
  if (institution === 'inter' || raw.includes('INTER')) return { tone: 'inter', mark: 'inter', institution: 'Inter' };
  if (institution === 'santander' || raw.includes('SANTANDER')) return { tone: 'santander', mark: 'Santander', institution: 'Santander' };
  if (institution === 'caixa' || raw.includes('CAIXA')) return { tone: 'caixa', mark: 'CAIXA', institution: 'Caixa' };
  if (institution === 'sicoob' || raw.includes('SICOOB')) return { tone: 'sicoob', mark: 'SICOOB', institution: 'Sicoob' };
  if (institution === 'bradesco' || raw.includes('BRADESCO')) return { tone: 'bradesco', mark: 'bradesco', institution: 'Bradesco' };
  if (institution === 'bb' || raw.includes('BANCO DO BRASIL') || /(^|\s)BB(\s|$)/.test(raw)) return { tone: 'bb', mark: 'BB', institution: 'Banco do Brasil' };
  if (institution === 'sicredi' || raw.includes('SICREDI')) return { tone: 'sicredi', mark: 'Sicredi', institution: 'Sicredi' };
  if (institution === 'c6' || raw.includes('C6')) return { tone: 'c6', mark: 'C6', institution: 'C6 Bank' };
  return { tone: 'generic', mark: 'CARD', institution: 'Cartão' };
}

export function CardsPage({ companies }: { companies: readonly CompanySummary[] }) {
  const repositories = useMemo(() => getFinanceRepositories(), []);
  const uniqueCompanies = useMemo(() => [...new Map(companies.map((company) => [company.id, company])).values()], [companies]);
  const [cards, setCards] = useState<readonly ListedCard[]>([]);
  const [selected, setSelected] = useState<ListedCard | null>(null);
  const [dialog, setDialog] = useState<CardDialog>(null);
  const [menuCardId, setMenuCardId] = useState<string | null>(null);
  const [cardForm, setCardForm] = useState<CardForm>({ companyId: uniqueCompanies[0]?.id ?? '', name: '', bankInstitution: '', creditLimit: '', closingDay: '10', dueDay: '20', status: 'active', lastFour: '', defaultPaymentAccountId: '' });
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
          return [{ ...item, companyName: companyName(company), bankInstitution: card.bankInstitution, lastFour: card.lastFour ?? null, dueDay: card.dueDay ?? 0, closingDay: card.closingDay ?? 0, defaultPaymentAccountId: card.defaultPaymentAccountId ?? null, status: card.status }];
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

  function openCreate() {
    setMenuCardId(null);
    setSelected(null);
    setCardForm({ companyId: uniqueCompanies[0]?.id ?? '', name: '', bankInstitution: '', creditLimit: '', closingDay: '10', dueDay: '20', status: 'active', lastFour: '', defaultPaymentAccountId: '' });
    setDialog('create');
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
      const availableMonths = [...new Set(items.map((line) => line.statementMonth))].filter((month) => month <= currentMonth).sort((a, b) => b.localeCompare(a));
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
    setCardForm({ companyId: item.companyId, name: item.name, bankInstitution: item.bankInstitution ?? '', creditLimit: String(item.creditLimit), closingDay: String(item.closingDay || 1), dueDay: String(item.dueDay || 1), status: item.status, lastFour: item.lastFour ?? '', defaultPaymentAccountId: item.defaultPaymentAccountId ?? '' });
    setDialog('edit');
  }

  function openDelete(item: ListedCard) {
    setMenuCardId(null);
    setSelected(item);
    setDialog('delete');
  }

  function closeDialog() { setDialog(null); setSelected(null); }

  async function saveCreate() {
    const company = uniqueCompanies.find((item) => item.id === cardForm.companyId);
    if (!company) return;
    setSaving(true); setError(null);
    try {
      await repositories.cards.createCard({ tenantId: company.tenantId, companyId: company.id, name: cardForm.name, bankInstitution: cardForm.bankInstitution || null, lastFour: null, creditLimit: money(cardForm.creditLimit), closingDay: Number(cardForm.closingDay), dueDay: Number(cardForm.dueDay), defaultPaymentAccountId: null });
      closeDialog(); await load(); window.dispatchEvent(new Event('finance-card-order-changed'));
    } catch { setError('Não foi possível cadastrar o cartão.'); }
    finally { setSaving(false); }
  }

  async function saveEdit() {
    if (!selected) return;
    setSaving(true); setError(null);
    try {
      await repositories.cards.updateCard({ tenantId: selected.tenantId, companyId: selected.companyId, id: selected.cardId, name: cardForm.name, bankInstitution: cardForm.bankInstitution || null, lastFour: cardForm.lastFour || null, creditLimit: money(cardForm.creditLimit), closingDay: Number(cardForm.closingDay), dueDay: Number(cardForm.dueDay), defaultPaymentAccountId: cardForm.defaultPaymentAccountId || null, status: cardForm.status });
      closeDialog(); await load(); window.dispatchEvent(new Event('finance-card-order-changed'));
    } catch { setError('Não foi possível salvar as alterações do cartão.'); }
    finally { setSaving(false); }
  }

  async function confirmDelete() {
    if (!selected) return;
    setSaving(true); setError(null);
    try {
      await repositories.cards.updateCard({ tenantId: selected.tenantId, companyId: selected.companyId, id: selected.cardId, name: selected.name, bankInstitution: selected.bankInstitution, lastFour: selected.lastFour, creditLimit: selected.creditLimit, closingDay: selected.closingDay, dueDay: selected.dueDay, defaultPaymentAccountId: selected.defaultPaymentAccountId, status: 'inactive' });
      closeDialog(); await load(); window.dispatchEvent(new Event('finance-card-order-changed'));
    } catch { setError('Não foi possível excluir o cartão.'); }
    finally { setSaving(false); }
  }

  const selectableMonths = useMemo(() => [...new Set(statementItems.map((line) => line.statementMonth))].filter((month) => month <= currentMonth).sort((a, b) => b.localeCompare(a)), [statementItems, currentMonth]);
  const selectedItems = useMemo(() => statementItems.filter((item) => item.statementMonth === selectedStatementMonth), [statementItems, selectedStatementMonth]);
  const selectedClosedStatement = useMemo(() => statements.find((statement) => statement.statementMonth === selectedStatementMonth) ?? null, [statements, selectedStatementMonth]);
  const selectedTotal = selectedClosedStatement?.statementAmount ?? selectedItems.reduce((sum, item) => sum + item.amount, 0);
  const companyOptions = uniqueCompanies.map((company) => ({ value: company.id, label: companyName(company) }));

  if (loading) return <LoadingState label="Carregando cartões…" />;
  const totalLimit = cards.reduce((sum, item) => sum + item.creditLimit, 0);
  const totalUsed = cards.reduce((sum, item) => sum + item.committedAmount, 0);
  const totalAvailable = cards.reduce((sum, item) => sum + item.availableLimit, 0);
  const cardFormFields = <div className="finance-form-grid">
    <Select label="Empresa" value={cardForm.companyId} disabled={dialog === 'edit'} onChange={(event) => setCardForm((current) => ({ ...current, companyId: event.target.value }))} options={companyOptions} required />
    <Input label="Nome do cartão" value={cardForm.name} onChange={(event) => setCardForm((current) => ({ ...current, name: event.target.value }))} required />
    <Select label="Instituição" value={cardForm.bankInstitution} onChange={(event) => setCardForm((current) => ({ ...current, bankInstitution: event.target.value as FinancialBankInstitution | '' }))} options={bankInstitutionOptions} required />
    <Select label="Tipo" value="card" disabled options={[{ value: 'card', label: 'Cartão' }]} />
    <Select label="Status" value={cardForm.status} disabled={dialog === 'create'} onChange={(event) => setCardForm((current) => ({ ...current, status: event.target.value === 'inactive' ? 'inactive' : 'active' }))} options={[{ value: 'active', label: 'Ativo' }, { value: 'inactive', label: 'Inativo' }]} />
    <Input label="Limite" type="number" min="0" step="0.01" value={cardForm.creditLimit} onChange={(event) => setCardForm((current) => ({ ...current, creditLimit: event.target.value }))} required />
    <Input label="Dia de fechamento da fatura" type="number" min={1} max={31} value={cardForm.closingDay} onChange={(event) => setCardForm((current) => ({ ...current, closingDay: event.target.value }))} required />
    <Input label="Dia de vencimento da fatura" type="number" min={1} max={31} value={cardForm.dueDay} onChange={(event) => setCardForm((current) => ({ ...current, dueDay: event.target.value }))} required />
  </div>;

  return <div className="cards-page">
    <PageHeader title="Cartões" actions={<Button onClick={openCreate}>Novo cartão</Button>} />
    {error && <Feedback tone="danger" title="Cartões" message={error} />}
    {cards.length === 0 ? <EmptyState title="Nenhum cartão" message="Não há cartões ativos para exibir. Use Novo cartão para cadastrar o primeiro." /> : <>
      <div className="cards-page__summary" aria-label="Resumo dos cartões"><Card><span>Limite total</span><strong>{currency.format(totalLimit)}</strong></Card><Card><span>Utilizado</span><strong className="cards-page__used">{currency.format(totalUsed)}</strong></Card><Card><span>Disponível</span><strong className="cards-page__available">{currency.format(totalAvailable)}</strong></Card></div>
      <div className="cards-page__list" aria-label="Cartões">{cards.map((item) => { const visual = cardVisual(item.bankInstitution, item.name); return <div key={item.cardId} className={`cards-page__item bank-brand bank-brand--${visual.tone}`} data-sort-group="credit-card-global" data-sort-tenant={tenantId} data-sort-id={item.cardId}>
        <SortableHandle itemId={item.cardId} tenantId={tenantId} group="credit-card-global" label={`Arrastar ${item.name} para reorganizar`} onReorder={reorder} />
        <Button variant="tertiary" className="cards-page__menu-trigger" aria-label={`Ações de ${item.name}`} aria-expanded={menuCardId===item.cardId} onClick={()=>setMenuCardId(menuCardId===item.cardId?null:item.cardId)}>⋯</Button>
        {menuCardId===item.cardId&&<div className="cards-page__menu" role="menu"><Button variant="tertiary" onClick={()=>openEdit(item)}>Editar</Button><Button variant="tertiary" className="is-danger" onClick={()=>openDelete(item)}>Excluir</Button></div>}
        <Button variant="tertiary" className="cards-page__card" onClick={() => { void openDetails(item); }} aria-label={`Abrir faturas de ${item.name}`}><span className="bank-brand__mark" aria-hidden="true">{visual.mark}</span><span className="cards-page__identity"><strong>{item.name}</strong><small>{visual.institution}</small>{item.dueDay > 0 && <small>Vence dia {item.dueDay}</small>}</span><span className="cards-page__limits"><span><small>Limite</small><strong>{currency.format(item.creditLimit)}</strong></span><span><small>Utilizado</small><strong className="cards-page__used">{currency.format(item.committedAmount)}</strong></span><span><small>Disponível</small><strong className="cards-page__available">{currency.format(item.availableLimit)}</strong></span></span><span className="cards-page__chevron" aria-hidden="true">›</span></Button>
      </div>; })}</div>
    </>}

    <Dialog open={dialog === 'details' && selected !== null} title={selected ? `Faturas · ${selected.name}` : 'Faturas'} description={selected?.lastFour ? `Final ${selected.lastFour}` : undefined} onClose={closeDialog} onBack={closeDialog}>{selected && <div className="cards-page__details">{detailsLoading ? <LoadingState label="Carregando faturas…" /> : selectableMonths.length === 0 ? <EmptyState title="Nenhuma fatura" message="Este cartão não possui faturas com lançamentos." /> : <><div className="cards-page__statement-filter"><Select label="Fatura" value={selectedStatementMonth} onChange={(event) => setSelectedStatementMonth(event.target.value)} options={selectableMonths.map((month) => { const closedStatement = statements.find((statement) => statement.statementMonth === month); const label = month === currentMonth ? 'Fatura atual' : closedStatement ? 'Fatura fechada' : 'Fatura anterior'; return { value: month, label: `${label} · ${monthLabel(month)}` }; })} /></div><div className="cards-page__invoice-head"><span><small>{selectedStatementMonth === currentMonth ? 'Fatura atual' : selectedClosedStatement ? 'Fatura fechada' : 'Fatura anterior'}</small><strong>{monthLabel(selectedStatementMonth)}</strong></span><span><small>Total da fatura</small><strong>{currency.format(selectedTotal)}</strong></span>{selectedClosedStatement?.dueDate && <span><small>Vencimento</small><strong>{dateLabel(selectedClosedStatement.dueDate)}</strong></span>}{selectedClosedStatement && <span><small>Status</small><strong>{selectedClosedStatement.paymentStatus === 'paid' ? 'Paga' : selectedClosedStatement.paymentStatus === 'partial' ? 'Parcial' : 'Pendente'}</strong></span>}</div><div className="cards-page__invoice-lines">{selectedItems.map((item) => <div key={`${item.transactionId}-${item.installmentNumber}`} className="cards-page__invoice-line"><span className="cards-page__invoice-description"><strong>{item.description}</strong><small>{dateLabel(item.purchaseDate)}{item.counterpartyName ? ` · ${item.counterpartyName}` : ''}{item.installmentCount > 1 ? ` · Parcela ${item.installmentLabel}` : ''}</small></span><strong className="cards-page__invoice-value">{currency.format(item.amount)}</strong></div>)}</div></>}</div>}</Dialog>

    <Dialog open={dialog === 'create'} title="Novo cartão" description="Cadastre somente os dados do cartão." onClose={closeDialog} onBack={closeDialog} loading={saving} footer={<><Button variant="secondary" onClick={closeDialog}>Cancelar</Button><Button onClick={()=>{void saveCreate();}}>Salvar cartão</Button></>}>{cardFormFields}</Dialog>
    <Dialog open={dialog === 'edit' && selected !== null} title="Editar cartão" description={selected?.companyName} onClose={closeDialog} onBack={closeDialog} loading={saving} footer={<><Button variant="secondary" onClick={closeDialog}>Cancelar</Button><Button onClick={()=>{void saveEdit();}}>Salvar alterações</Button></>}>{cardFormFields}</Dialog>
    <Dialog open={dialog === 'delete' && selected !== null} title="Excluir cartão" onClose={closeDialog} onBack={closeDialog} loading={saving} footer={<><Button variant="secondary" onClick={closeDialog}>Cancelar</Button><Button variant="danger" onClick={()=>{void confirmDelete();}}>Excluir cartão</Button></>}><p>Tem certeza que deseja excluir <strong>{selected?.name}</strong>? O cartão será desativado para preservar o histórico financeiro e as faturas já registradas.</p></Dialog>
  </div>;
}
