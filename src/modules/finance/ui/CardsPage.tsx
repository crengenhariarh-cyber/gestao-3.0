import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import type { CardStatementActivity, CardStatementBalance, CreditCard, CreditCardLimit } from '../domain/cards';
import type { CostCenter, FinancialBankInstitution, FinancialCategory } from '../domain/registries';
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
import './statement-view.css';

type CardTone = 'itau' | 'nubank' | 'inter' | 'santander' | 'caixa' | 'sicoob' | 'bradesco' | 'bb' | 'sicredi' | 'c6' | 'generic';
type ListedCard = CreditCardLimit & { companyName: string; bankInstitution: FinancialBankInstitution | null; lastFour: string | null; dueDay: number; closingDay: number; defaultPaymentAccountId: string | null; status: CreditCard['status'] };
type CardDialog = 'details' | 'create' | 'edit' | 'delete' | 'activityEdit' | 'activityDelete' | null;
type CardForm = { companyId: string; sourceCompanyId: string; name: string; bankInstitution: FinancialBankInstitution | ''; creditLimit: string; closingDay: string; dueDay: string; status: CreditCard['status']; lastFour: string; defaultPaymentAccountId: string };
type ActivityFilter = 'all' | 'purchase' | 'payment';
type ActivityForm = { date:string; description:string; amount:string; expenseCompanyId:string; cardId:string; counterparty:string; categoryId:string; costCenterId:string; installmentCount:string; notes:string };

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const bankInstitutionOptions = [
  { value: '', label: 'Selecione…' },
  { value: 'itau', label: 'Itaú' }, { value: 'nubank', label: 'Nubank' }, { value: 'inter', label: 'Inter' },
  { value: 'santander', label: 'Santander' }, { value: 'caixa', label: 'Caixa' }, { value: 'sicoob', label: 'Sicoob' },
  { value: 'bradesco', label: 'Bradesco' }, { value: 'bb', label: 'Banco do Brasil' }, { value: 'sicredi', label: 'Sicredi' }, { value: 'c6', label: 'C6 Bank' },
];
const emptyActivityForm: ActivityForm = { date:'', description:'', amount:'', expenseCompanyId:'', cardId:'', counterparty:'', categoryId:'', costCenterId:'', installmentCount:'1', notes:'' };
function companyName(company: CompanySummary): string { return company.tradeName ?? company.legalName; }
function monthKey(date = new Date()): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`; }
function monthLabel(value: string): string { return value.slice(0, 7).split('-').reverse().join('/'); }
function dateLabel(value: string): string { return value.split('-').reverse().join('/'); }
function money(value: string): number { return Number(value.replace(',', '.')); }
function csvCell(value: string | number): string { return `"${String(value).replaceAll('"', '""')}"`; }
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

export function CardsPage({ companies, availableCompanies = companies }: { companies: readonly CompanySummary[]; availableCompanies?: readonly CompanySummary[] }) {
  const repositories = useMemo(() => getFinanceRepositories(), []);
  const uniqueCompanies = useMemo(() => [...new Map(companies.map((company) => [company.id, company])).values()], [companies]);
  const formCompanies = useMemo(() => [...new Map(availableCompanies.map((company) => [company.id, company])).values()], [availableCompanies]);
  const defaultCompanyId = uniqueCompanies[0]?.id ?? formCompanies[0]?.id ?? '';
  const [cards, setCards] = useState<readonly ListedCard[]>([]);
  const [selected, setSelected] = useState<ListedCard | null>(null);
  const [dialog, setDialog] = useState<CardDialog>(null);
  const [menuCardId, setMenuCardId] = useState<string | null>(null);
  const [cardForm, setCardForm] = useState<CardForm>({ companyId: defaultCompanyId, sourceCompanyId: defaultCompanyId, name: '', bankInstitution: '', creditLimit: '', closingDay: '10', dueDay: '20', status: 'active', lastFour: '', defaultPaymentAccountId: '' });
  const [activities, setActivities] = useState<readonly CardStatementActivity[]>([]);
  const [statements, setStatements] = useState<readonly CardStatementBalance[]>([]);
  const [selectedStatementMonth, setSelectedStatementMonth] = useState('');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [selectedActivity, setSelectedActivity] = useState<CardStatementActivity | null>(null);
  const [activityForm, setActivityForm] = useState<ActivityForm>(emptyActivityForm);
  const [purchaseCategories, setPurchaseCategories] = useState<readonly FinancialCategory[]>([]);
  const [purchaseCostCenters, setPurchaseCostCenters] = useState<readonly CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tenantId = formCompanies[0]?.tenantId ?? uniqueCompanies[0]?.tenantId ?? '';
  const currentMonth = monthKey();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const groups = await Promise.all(uniqueCompanies.map(async (company) => {
        const scope = { tenantId: company.tenantId, companyId: company.id };
        const [limits, registered] = await Promise.all([repositories.cards.listLimits(scope), repositories.cards.listCards(scope)]);
        const byId = new Map<string, CreditCard>(registered.map((item) => [item.id, item]));
        return limits.flatMap((item) => {
          const card = byId.get(item.cardId);
          if (!card || card.status !== 'active') return [];
          return [{ ...item, companyName: companyName(company), bankInstitution: card.bankInstitution, lastFour: card.lastFour ?? null, dueDay: card.dueDay ?? 0, closingDay: card.closingDay ?? 0, defaultPaymentAccountId: card.defaultPaymentAccountId ?? null, status: card.status }];
        });
      }));
      setCards([...new Map(groups.flat().map((item) => [item.cardId, item])).values()].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));
    } catch { setError('Não foi possível carregar os cartões.'); }
    finally { setLoading(false); }
  }, [repositories.cards, uniqueCompanies]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refreshCards = () => { void load(); };
    window.addEventListener('finance-card-order-changed', refreshCards);
    return () => window.removeEventListener('finance-card-order-changed', refreshCards);
  }, [load]);

  async function loadDetails(item: ListedCard, preferredMonth?: string) {
    setDetailsLoading(true);
    try {
      const scope = { tenantId: item.tenantId, companyId: item.companyId };
      const [activityRows, closed] = await Promise.all([repositories.cards.listStatementActivities(scope, item.cardId), repositories.cards.listStatements(scope, item.cardId)]);
      setActivities(activityRows);
      setStatements(closed);
      const months = [...new Set(activityRows.map((line) => line.statementMonth))].sort((a, b) => b.localeCompare(a));
      setSelectedStatementMonth(preferredMonth && months.includes(preferredMonth) ? preferredMonth : months.includes(currentMonth) ? currentMonth : months[0] ?? '');
    } catch { setError('Não foi possível carregar a fatura deste cartão.'); }
    finally { setDetailsLoading(false); }
  }

  async function loadPurchaseRegistries(companyId:string) {
    if (!selected || !companyId) { setPurchaseCategories([]); setPurchaseCostCenters([]); return; }
    const scope={tenantId:selected.tenantId,companyId};
    const [categories,costCenters]=await Promise.all([repositories.registries.listCategories(scope),repositories.registries.listCostCenters(scope)]);
    setPurchaseCategories(categories);
    setPurchaseCostCenters(costCenters);
  }

  async function reorder(orderedIds: readonly string[]) { if (!tenantId || orderedIds.length < 2) return; try { await repositories.cards.reorder(tenantId, orderedIds); await load(); window.dispatchEvent(new Event('finance-card-order-changed')); } catch { setError('Não foi possível salvar a nova ordem dos cartões.'); } }
  function openCreate() { setSelected(null); setCardForm({ companyId: defaultCompanyId, sourceCompanyId: defaultCompanyId, name: '', bankInstitution: '', creditLimit: '', closingDay: '10', dueDay: '20', status: 'active', lastFour: '', defaultPaymentAccountId: '' }); setDialog('create'); }
  async function openDetails(item: ListedCard) { setMenuCardId(null); setSelected(item); setActivityFilter('all'); setDialog('details'); await loadDetails(item); }
  function openEdit(item: ListedCard) { setMenuCardId(null); setSelected(item); setCardForm({ companyId: item.companyId, sourceCompanyId: item.companyId, name: item.name, bankInstitution: item.bankInstitution ?? '', creditLimit: String(item.creditLimit), closingDay: String(item.closingDay || 1), dueDay: String(item.dueDay || 1), status: item.status, lastFour: item.lastFour ?? '', defaultPaymentAccountId: item.defaultPaymentAccountId ?? '' }); setDialog('edit'); }
  function openDelete(item: ListedCard) { setMenuCardId(null); setSelected(item); setDialog('delete'); }
  function closeDialog() { setDialog(null); setSelectedActivity(null); }

  async function openActivityEdit(item: CardStatementActivity) {
    setSelectedActivity(item);
    setDialog('activityEdit');
    if (item.activityType === 'payment') {
      setActivityForm({ ...emptyActivityForm, date:item.activityDate, description:item.counterpartyName ?? '', amount:String(item.sourceTotalAmount) });
      return;
    }
    if (!selected) return;
    setSaving(true); setError(null);
    try {
      const details=await repositories.cards.getPurchase({tenantId:selected.tenantId,companyId:selected.companyId,transactionId:item.sourceId});
      await loadPurchaseRegistries(details.expenseCompanyId);
      setActivityForm({date:details.purchaseDate,description:details.description,amount:String(details.totalAmount),expenseCompanyId:details.expenseCompanyId,cardId:details.cardId,counterparty:details.counterpartyName ?? '',categoryId:details.categoryId,costCenterId:details.costCenterId ?? '',installmentCount:String(details.installmentCount),notes:details.notes ?? ''});
    } catch { setError('Não foi possível carregar todos os dados desta compra.'); setDialog('details'); setSelectedActivity(null); }
    finally { setSaving(false); }
  }
  async function changeActivityExpenseCompany(companyId:string) {
    setActivityForm((current)=>({...current,expenseCompanyId:companyId,categoryId:'',costCenterId:''}));
    try { await loadPurchaseRegistries(companyId); } catch { setPurchaseCategories([]); setPurchaseCostCenters([]); setError('Não foi possível carregar categorias e centros de custo desta empresa.'); }
  }
  function openActivityDelete(item: CardStatementActivity) { setSelectedActivity(item); setDialog('activityDelete'); }
  async function saveActivity() {
    if (!selected || !selectedActivity) return;
    setSaving(true); setError(null);
    try {
      const scope = { tenantId: selected.tenantId, companyId: selected.companyId };
      if (selectedActivity.activityType === 'purchase') await repositories.cards.updatePurchase({ ...scope, transactionId: selectedActivity.sourceId, expenseCompanyId:activityForm.expenseCompanyId, cardId:activityForm.cardId, purchaseDate: activityForm.date, description: activityForm.description, counterpartyName:activityForm.counterparty || null, categoryId:activityForm.categoryId, costCenterId:activityForm.costCenterId || null, totalAmount: money(activityForm.amount), installmentCount:Number(activityForm.installmentCount), notes:activityForm.notes || null });
      else await repositories.cards.updateStatementPayment({ ...scope, paymentId: selectedActivity.sourceId, paidOn: activityForm.date, amount: money(activityForm.amount), notes: activityForm.description || null });
      setDialog('details'); setSelectedActivity(null); await loadDetails(selected, selectedStatementMonth); await load();
    } catch { setError('Não foi possível editar esta movimentação.'); }
    finally { setSaving(false); }
  }
  async function deleteActivity() {
    if (!selected || !selectedActivity) return;
    setSaving(true); setError(null);
    try {
      const scope = { tenantId: selected.tenantId, companyId: selected.companyId };
      if (selectedActivity.activityType === 'purchase') await repositories.cards.deletePurchase({ ...scope, transactionId: selectedActivity.sourceId });
      else await repositories.cards.deleteStatementPayment({ ...scope, paymentId: selectedActivity.sourceId });
      setDialog('details'); setSelectedActivity(null); await loadDetails(selected, selectedStatementMonth); await load();
    } catch { setError('Não foi possível excluir esta movimentação.'); }
    finally { setSaving(false); }
  }

  async function saveCreate() { const company = formCompanies.find((item) => item.id === cardForm.companyId); if (!company) return; setSaving(true); setError(null); try { await repositories.cards.createCard({ tenantId: company.tenantId, companyId: company.id, name: cardForm.name, bankInstitution: cardForm.bankInstitution || null, lastFour: null, creditLimit: money(cardForm.creditLimit), closingDay: Number(cardForm.closingDay), dueDay: Number(cardForm.dueDay), defaultPaymentAccountId: null }); closeDialog(); await load(); } catch { setError('Não foi possível cadastrar o cartão.'); } finally { setSaving(false); } }
  async function saveEdit() { if (!selected) return; const company = formCompanies.find((item) => item.id === cardForm.companyId); if (!company) return; setSaving(true); setError(null); try { await repositories.cards.updateCard({ tenantId: company.tenantId, companyId: company.id, sourceCompanyId: cardForm.sourceCompanyId, id: selected.cardId, name: cardForm.name, bankInstitution: cardForm.bankInstitution || null, lastFour: cardForm.lastFour || null, creditLimit: money(cardForm.creditLimit), closingDay: Number(cardForm.closingDay), dueDay: Number(cardForm.dueDay), defaultPaymentAccountId: cardForm.companyId === cardForm.sourceCompanyId ? cardForm.defaultPaymentAccountId || null : null, status: cardForm.status }); closeDialog(); await load(); } catch { setError('Não foi possível salvar as alterações do cartão.'); } finally { setSaving(false); } }
  async function confirmDelete() { if (!selected) return; setSaving(true); try { await repositories.cards.updateCard({ tenantId: selected.tenantId, companyId: selected.companyId, id: selected.cardId, name: selected.name, bankInstitution: selected.bankInstitution, lastFour: selected.lastFour, creditLimit: selected.creditLimit, closingDay: selected.closingDay, dueDay: selected.dueDay, defaultPaymentAccountId: selected.defaultPaymentAccountId, status: 'inactive' }); closeDialog(); await load(); } catch { setError('Não foi possível excluir o cartão.'); } finally { setSaving(false); } }

  const selectableMonths = useMemo(() => [...new Set(activities.map((line) => line.statementMonth))].sort((a, b) => b.localeCompare(a)), [activities]);
  const monthActivities = useMemo(() => activities.filter((item) => item.statementMonth === selectedStatementMonth), [activities, selectedStatementMonth]);
  const filteredActivities = useMemo(() => monthActivities.filter((item) => activityFilter === 'all' || item.activityType === activityFilter), [monthActivities, activityFilter]);
  const selectedClosedStatement = statements.find((statement) => statement.statementMonth === selectedStatementMonth) ?? null;
  const purchaseTotal = monthActivities.filter((item) => item.activityType === 'purchase').reduce((sum, item) => sum + item.amount, 0);
  const paymentTotal = monthActivities.filter((item) => item.activityType === 'payment').reduce((sum, item) => sum + item.amount, 0);
  const selectedTotal = selectedClosedStatement?.statementAmount ?? purchaseTotal;
  const companyOptions = formCompanies.map((company) => ({ value: company.id, label: companyName(company) }));
  const purchaseCardOptions = cards.filter((card)=>card.companyId===selected?.companyId).map((card)=>({value:card.cardId,label:card.name}));
  const purchaseCategoryOptions = purchaseCategories.filter((category)=>category.status==='active'&&category.kind!=='income').map((category)=>({value:category.id,label:category.name}));
  const purchaseCostCenterOptions = [{value:'',label:'Sem centro de custo'},...purchaseCostCenters.filter((costCenter)=>costCenter.status==='active').map((costCenter)=>({value:costCenter.id,label:costCenter.name}))];
  const currentMonthIndex = selectableMonths.indexOf(selectedStatementMonth);

  function moveMonth(delta: number) { const next = selectableMonths[currentMonthIndex + delta]; if (next) setSelectedStatementMonth(next); }
  function printStatement() { setActivityFilter('all'); window.setTimeout(() => window.print(), 0); }
  function exportCsv() {
    if (!selected) return;
    const rows = [['Data','Tipo','Descrição','Parcela','Valor'], ...filteredActivities.map((item) => [dateLabel(item.activityDate), item.activityType === 'purchase' ? 'Compra' : 'Pagamento', item.description, item.installmentCount && item.installmentCount > 1 ? `${item.installmentNumber}/${item.installmentCount}` : '', (item.activityType === 'payment' ? -item.amount : item.amount).toFixed(2)])];
    const csv = '\ufeff' + rows.map((row) => row.map(csvCell).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `fatura-${selected.name}-${selectedStatementMonth.slice(0,7)}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  if (loading) return <LoadingState label="Carregando cartões…" />;
  const totalLimit = cards.reduce((sum, item) => sum + item.creditLimit, 0), totalUsed = cards.reduce((sum, item) => sum + item.committedAmount, 0), totalAvailable = cards.reduce((sum, item) => sum + item.availableLimit, 0);
  const cardFormFields = <div className="finance-form-grid"><Select label="Empresa" value={cardForm.companyId} onChange={(event) => setCardForm((current) => ({ ...current, companyId: event.target.value }))} options={companyOptions} required /><Input label="Nome do cartão" value={cardForm.name} onChange={(event) => setCardForm((current) => ({ ...current, name: event.target.value }))} required /><Select label="Instituição" value={cardForm.bankInstitution} onChange={(event) => setCardForm((current) => ({ ...current, bankInstitution: event.target.value as FinancialBankInstitution | '' }))} options={bankInstitutionOptions} required /><Select label="Tipo" value="card" disabled options={[{ value: 'card', label: 'Cartão' }]} /><Select label="Status" value={cardForm.status} disabled={dialog === 'create'} onChange={(event) => setCardForm((current) => ({ ...current, status: event.target.value === 'inactive' ? 'inactive' : 'active' }))} options={[{ value: 'active', label: 'Ativo' }, { value: 'inactive', label: 'Inativo' }]} /><Input label="Limite" type="number" min="0" step="0.01" value={cardForm.creditLimit} onChange={(event) => setCardForm((current) => ({ ...current, creditLimit: event.target.value }))} required /><Input label="Dia de fechamento da fatura" type="number" min={1} max={31} value={cardForm.closingDay} onChange={(event) => setCardForm((current) => ({ ...current, closingDay: event.target.value }))} required /><Input label="Dia de vencimento da fatura" type="number" min={1} max={31} value={cardForm.dueDay} onChange={(event) => setCardForm((current) => ({ ...current, dueDay: event.target.value }))} required /></div>;

  return <div className="cards-page"><PageHeader title="Cartões" actions={<Button onClick={openCreate}>Novo cartão</Button>} />{error && <Feedback tone="danger" title="Cartões" message={error} />}{cards.length === 0 ? <EmptyState title="Nenhum cartão" message="Não há cartões ativos para exibir." /> : <><div className="cards-page__summary"><Card><span>Limite total</span><strong>{currency.format(totalLimit)}</strong></Card><Card><span>Utilizado</span><strong className="cards-page__used">{currency.format(totalUsed)}</strong></Card><Card><span>Disponível</span><strong className="cards-page__available">{currency.format(totalAvailable)}</strong></Card></div><div className="cards-page__list">{cards.map((item) => { const visual = cardVisual(item.bankInstitution, item.name); return <div key={item.cardId} className={`cards-page__item bank-brand bank-brand--${visual.tone}`} data-sort-group="credit-card-global" data-sort-tenant={tenantId} data-sort-id={item.cardId}><SortableHandle itemId={item.cardId} tenantId={tenantId} group="credit-card-global" label={`Arrastar ${item.name} para reorganizar`} onReorder={reorder} /><Button variant="tertiary" className="cards-page__menu-trigger" aria-label={`Ações de ${item.name}`} onClick={() => setMenuCardId(menuCardId === item.cardId ? null : item.cardId)}>⋯</Button>{menuCardId === item.cardId && <div className="cards-page__menu"><Button variant="tertiary" onClick={() => openEdit(item)}>Editar</Button><Button variant="tertiary" className="is-danger" onClick={() => openDelete(item)}>Excluir</Button></div>}<Button variant="tertiary" className="cards-page__card" onClick={() => { void openDetails(item); }}><span className="bank-brand__mark">{visual.mark}</span><span className="cards-page__identity"><strong>{item.name}</strong><small>{item.companyName}</small><small>{visual.institution}</small></span><span className="cards-page__limits"><span><small>Limite</small><strong>{currency.format(item.creditLimit)}</strong></span><span><small>Utilizado</small><strong className="cards-page__used">{currency.format(item.committedAmount)}</strong></span><span><small>Disponível</small><strong className="cards-page__available">{currency.format(item.availableLimit)}</strong></span></span><span className="cards-page__chevron">›</span></Button></div>; })}</div></>}

    <Dialog open={dialog === 'details' && selected !== null} title={selected ? selected.name : 'Fatura do cartão'} description={selected?.companyName} onClose={closeDialog} onBack={closeDialog}>{selected && <div className="statement-view statement-print-surface">{detailsLoading ? <LoadingState label="Carregando fatura…" /> : <><div className="statement-view__hero"><div><strong>{selected.name}</strong><span>{selected.companyName}</span></div><div><small>Limite total</small><strong>{currency.format(selected.creditLimit)}</strong></div><div><small>Utilizado</small><strong>{currency.format(selected.committedAmount)}</strong></div><div><small>Disponível</small><strong>{currency.format(selected.availableLimit)}</strong></div></div><div className="statement-view__dates"><Card title="Fechamento"><strong>Dia {selected.closingDay}</strong></Card><Card title="Vencimento"><strong>Dia {selected.dueDay}</strong></Card></div>{selectableMonths.length === 0 ? <EmptyState title="Nenhuma movimentação" message="Este cartão ainda não possui movimentações." /> : <><div className="statement-view__period"><Button variant="secondary" onClick={() => moveMonth(1)} disabled={currentMonthIndex >= selectableMonths.length - 1}>‹</Button><Select label="Período" value={selectedStatementMonth} onChange={(event) => setSelectedStatementMonth(event.target.value)} options={selectableMonths.map((month) => ({ value: month, label: month === currentMonth ? `Fatura atual · ${monthLabel(month)}` : monthLabel(month) }))} /><Button variant="secondary" onClick={() => moveMonth(-1)} disabled={currentMonthIndex <= 0}>›</Button></div><div className="statement-view__filters"><Button variant={activityFilter === 'all' ? 'primary' : 'secondary'} size="sm" onClick={() => setActivityFilter('all')}>Todas {monthActivities.length}</Button><Button variant={activityFilter === 'purchase' ? 'primary' : 'secondary'} size="sm" onClick={() => setActivityFilter('purchase')}>Compras {monthActivities.filter((x) => x.activityType === 'purchase').length}</Button><Button variant={activityFilter === 'payment' ? 'primary' : 'secondary'} size="sm" onClick={() => setActivityFilter('payment')}>Pagamentos {monthActivities.filter((x) => x.activityType === 'payment').length}</Button></div><div className="statement-view__totals"><Card title="Fatura"><strong>{currency.format(selectedTotal)}</strong></Card><Card title="Pagamentos"><strong>{currency.format(paymentTotal)}</strong></Card><Card title="Em aberto"><strong>{currency.format(Math.max(0, selectedTotal - paymentTotal))}</strong></Card></div><div className="statement-view__list">{filteredActivities.map((item) => <div key={item.activityKey} className="statement-view__row"><div className={`statement-view__icon statement-view__icon--${item.activityType}`}>{item.activityType === 'purchase' ? '−' : '+'}</div><div className="statement-view__copy"><strong>{item.activityType === 'payment' ? 'Pagamento recebido' : item.description}</strong><span>{item.activityType === 'payment' ? `Pagamento em ${dateLabel(item.activityDate)}` : dateLabel(item.activityDate)}{item.counterpartyName ? ` · ${item.counterpartyName}` : ''}{item.installmentCount && item.installmentCount > 1 ? ` · Parcela ${item.installmentNumber}/${item.installmentCount}` : ''}</span></div><strong className={item.activityType === 'payment' ? 'statement-view__positive' : ''}>{item.activityType === 'payment' ? '+' : '-'} {currency.format(item.amount)}</strong><div className="statement-view__actions"><Button variant="tertiary" size="sm" aria-label="Editar movimentação" onClick={() => { void openActivityEdit(item); }}>✎</Button><Button variant="tertiary" size="sm" className="is-danger" aria-label="Excluir movimentação" onClick={() => openActivityDelete(item)}>⌫</Button></div></div>)}</div><div className="statement-view__footer-actions"><Button variant="secondary" onClick={exportCsv}>Baixar extrato (Excel)</Button><Button onClick={printStatement}>Imprimir</Button></div></>}</>}</div>}</Dialog>

    <Dialog open={dialog === 'activityEdit' && selectedActivity !== null} title={selectedActivity?.activityType === 'purchase' ? 'Editar compra' : 'Editar pagamento'} loading={saving} onClose={() => setDialog('details')} onBack={() => setDialog('details')} footer={<><Button variant="secondary" onClick={() => setDialog('details')}>Cancelar</Button><Button onClick={() => { void saveActivity(); }}>Salvar</Button></>}>
      {selectedActivity?.activityType === 'purchase' ? <div className="finance-form-grid"><Input label="Data" type="date" value={activityForm.date} onChange={(event) => setActivityForm((current) => ({ ...current, date: event.target.value }))} required /><Input label="Descrição" value={activityForm.description} onChange={(event) => setActivityForm((current) => ({ ...current, description: event.target.value }))} required /><Input label="Valor" type="number" min="0.01" step="0.01" value={activityForm.amount} onChange={(event) => setActivityForm((current) => ({ ...current, amount: event.target.value }))} required /><Input label="Pagador / origem" value={activityForm.counterparty} onChange={(event) => setActivityForm((current) => ({ ...current, counterparty: event.target.value }))} /><Select label="Empresa" value={activityForm.expenseCompanyId} onChange={(event) => { void changeActivityExpenseCompany(event.target.value); }} options={companyOptions} required /><Select label="Cartão" value={activityForm.cardId} onChange={(event) => setActivityForm((current) => ({ ...current, cardId: event.target.value }))} options={purchaseCardOptions} required /><Select label="Categoria" value={activityForm.categoryId} onChange={(event) => setActivityForm((current) => ({ ...current, categoryId: event.target.value }))} options={purchaseCategoryOptions} required /><Select label="Obra / Centro de custo" value={activityForm.costCenterId} onChange={(event) => setActivityForm((current) => ({ ...current, costCenterId: event.target.value }))} options={purchaseCostCenterOptions} /><Input label="Parcelas" type="number" min={1} max={120} step={1} value={activityForm.installmentCount} onChange={(event) => setActivityForm((current) => ({ ...current, installmentCount: event.target.value }))} required /><Input label="Observações" value={activityForm.notes} onChange={(event) => setActivityForm((current) => ({ ...current, notes: event.target.value }))} /></div> : <div className="finance-form-grid"><Input label="Data" type="date" value={activityForm.date} onChange={(event) => setActivityForm((current) => ({ ...current, date: event.target.value }))} required /><Input label="Observação" value={activityForm.description} onChange={(event) => setActivityForm((current) => ({ ...current, description: event.target.value }))} /><Input label="Valor" type="number" min="0.01" step="0.01" value={activityForm.amount} onChange={(event) => setActivityForm((current) => ({ ...current, amount: event.target.value }))} required /></div>}
    </Dialog>
    <Dialog open={dialog === 'activityDelete' && selectedActivity !== null} title="Excluir movimentação" loading={saving} onClose={() => setDialog('details')} onBack={() => setDialog('details')} footer={<><Button variant="secondary" onClick={() => setDialog('details')}>Cancelar</Button><Button variant="danger" onClick={() => { void deleteActivity(); }}>Excluir</Button></>}><p>Excluir esta movimentação atualizará automaticamente a fatura e os saldos relacionados.</p></Dialog>
    <Dialog open={dialog === 'create'} title="Novo cartão" onClose={closeDialog} onBack={closeDialog} loading={saving} footer={<><Button variant="secondary" onClick={closeDialog}>Cancelar</Button><Button onClick={() => { void saveCreate(); }}>Salvar cartão</Button></>}>{cardFormFields}</Dialog>
    <Dialog open={dialog === 'edit' && selected !== null} title="Editar cartão" onClose={closeDialog} onBack={closeDialog} loading={saving} footer={<><Button variant="secondary" onClick={closeDialog}>Cancelar</Button><Button onClick={() => { void saveEdit(); }}>Salvar alterações</Button></>}>{cardFormFields}</Dialog>
    <Dialog open={dialog === 'delete' && selected !== null} title="Excluir cartão" onClose={closeDialog} onBack={closeDialog} loading={saving} footer={<><Button variant="secondary" onClick={closeDialog}>Cancelar</Button><Button variant="danger" onClick={() => { void confirmDelete(); }}>Excluir cartão</Button></>}><p>O cartão será desativado para preservar o histórico financeiro.</p></Dialog>
  </div>;
}