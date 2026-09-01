import { useEffect, useMemo, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback, LoadingState } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';
import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';
import { getFinanceRepositories } from '../infrastructure/createFinanceRepositories';
import { useFinanceOperations } from './useFinanceOperations';
import './quick-entry.css';

type EntryType = 'expense' | 'income';
type LaunchType = 'single' | 'installment' | 'recurring';
type PaymentMethod = 'pix' | 'debit' | 'credit' | 'cash' | 'transfer' | 'boleto' | 'other';
type SmartTemplate = { description:string; companyId:string; entryType:EntryType; categoryId:string; costCenterId:string; accountId:string; paymentMethod:PaymentMethod; cardId:string; occurredOn:string };

interface QuickEntryDialogProps {
  open: boolean;
  companies: readonly CompanySummary[];
  initialCompanyId?: string;
  allCompaniesMode?: boolean;
  onClose: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = (value: string) => `${value.slice(0, 7)}-01`;
const idempotencyKey = (prefix: string) => `${prefix}:${crypto.randomUUID()}`;
const digitsOnly = (value:string) => value.replace(/\D/g,'').slice(0,14);
const amountFromDigits = (digits:string) => Number(digits || '0') / 100;
const formatMoneyDigits = (digits:string) => digits ? new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(amountFromDigits(digits)) : '';
const normalized = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR');

function recurrenceEnd(start: string, count: number): string {
  const date = new Date(`${start}T12:00:00`);
  date.setMonth(date.getMonth() + Math.max(0, count - 1));
  return date.toISOString().slice(0, 10);
}

export function QuickEntryDialog({ open, companies, initialCompanyId = '', allCompaniesMode = false, onClose }: QuickEntryDialogProps) {
  const [companyId, setCompanyId] = useState(initialCompanyId || companies[0]?.id || '');
  const [moreOptions, setMoreOptions] = useState(false);
  const [templates, setTemplates] = useState<readonly SmartTemplate[]>([]);
  const [lastSuggestedDescription, setLastSuggestedDescription] = useState('');
  const [form, setForm] = useState({
    entryType: 'expense' as EntryType,
    date: today(),
    description: '',
    amountDigits: '',
    paymentMethod: 'pix' as PaymentMethod,
    launchType: 'single' as LaunchType,
    installmentCount: '2',
    recurrenceCount: '12',
    accountId: '',
    cardId: '',
    categoryId: '',
    costCenterId: '',
    counterparty: '',
    notes: '',
  });

  useEffect(() => {
    if (!open) return;
    setCompanyId(initialCompanyId || companies[0]?.id || '');
    setLastSuggestedDescription('');
  }, [companies, initialCompanyId, open]);

  useEffect(() => {
    if (!open || companies.length === 0) return;
    let cancelled = false;
    void (async () => {
      const repositories = getFinanceRepositories();
      const entryLists = await Promise.all(companies.map(async company => {
        const rows = await repositories.entries.list({tenantId:company.tenantId,companyId:company.id});
        return rows.map(row => ({description:row.description,companyId:company.id,entryType:row.entryType,categoryId:row.categoryId,costCenterId:row.costCenterId ?? '',accountId:row.plannedAccountId ?? '',paymentMethod:'pix' as PaymentMethod,cardId:'',occurredOn:row.dueDate}));
      }));
      const tenantId = companies[0]?.tenantId;
      const cardTemplates:SmartTemplate[] = [];
      if (tenantId) {
        const {data} = await getSupabaseClient().from('card_transactions').select('company_id,card_id,purchase_date,description,category_id,cost_center_id').eq('tenant_id',tenantId).order('purchase_date',{ascending:false}).limit(200);
        for (const row of data ?? []) cardTemplates.push({description:String(row.description ?? ''),companyId:String(row.company_id ?? ''),entryType:'expense',categoryId:String(row.category_id ?? ''),costCenterId:row.cost_center_id ? String(row.cost_center_id) : '',accountId:'',paymentMethod:'credit',cardId:String(row.card_id ?? ''),occurredOn:String(row.purchase_date ?? '')});
      }
      if (!cancelled) setTemplates([...cardTemplates,...entryLists.flat()].sort((a,b)=>b.occurredOn.localeCompare(a.occurredOn)));
    })().catch(() => { if (!cancelled) setTemplates([]); });
    return () => { cancelled = true; };
  }, [companies, open]);

  const company = companies.find((item) => item.id === companyId) ?? companies[0];
  const scope = useMemo(() => ({ tenantId: company?.tenantId ?? '', companyId: company?.id ?? '' }), [company?.id, company?.tenantId]);
  const operations = useFinanceOperations(scope);
  const references = operations.state.references;

  const activeAccounts = (references?.accounts ?? []).filter((item) => item.status === 'active');
  const activeCards = (references?.cards ?? []).filter((item) => item.status === 'active');
  const activeCostCenters = (references?.costCenters ?? []).filter((item) => item.status === 'active');
  const categories = (references?.categories ?? []).filter((item) => item.status === 'active' && (item.kind === 'both' || item.kind === form.entryType));

  const companyOptions = companies.map((item) => ({ value: item.id, label: item.tradeName ?? item.legalName }));
  const accountOptions = [{ value: '', label: 'Selecione' }, ...activeAccounts.map((item) => ({ value: item.id, label: item.name }))];
  const cardOptions = [{ value: '', label: 'Selecione o cartão' }, ...activeCards.map((item) => ({ value: item.id, label: item.name }))];
  const categoryOptions = [{ value: '', label: 'Selecione' }, ...categories.map((item) => ({ value: item.id, label: item.name }))];
  const costCenterOptions = [{ value: '', label: 'Selecione' }, ...activeCostCenters.map((item) => ({ value: item.id, label: item.code ? `${item.code} · ${item.name}` : item.name }))];

  const paymentOptions = [
    { value: 'pix', label: 'Pix' },
    { value: 'debit', label: 'Cartão de débito' },
    ...(form.entryType === 'expense' ? [{ value: 'credit', label: 'Cartão de crédito' }] : []),
    { value: 'cash', label: 'Dinheiro' },
    { value: 'transfer', label: 'Transferência' },
    { value: 'boleto', label: 'Boleto' },
    { value: 'other', label: 'Outro' },
  ];
  const launchOptions = [
    { value: 'single', label: 'Único / à vista' },
    { value: 'installment', label: 'Parcelado' },
    ...(form.paymentMethod === 'credit' ? [] : [{ value: 'recurring', label: 'Recorrente' }]),
  ];

  function set<K extends keyof typeof form>(field: K, value: (typeof form)[K]) { setForm((current) => ({ ...current, [field]: value })); }
  function setPaymentMethod(value: PaymentMethod) { setForm((current) => ({ ...current, paymentMethod: value, launchType: value === 'credit' && current.launchType === 'recurring' ? 'single' : current.launchType, accountId: value === 'credit' ? '' : current.accountId, cardId: value === 'credit' ? current.cardId : '' })); }
  function resetForNextEntry() { setForm((current) => ({ ...current, description: '', amountDigits: '', counterparty: '', notes: '' })); setLastSuggestedDescription(''); }
  function smartFill(description:string) {
    const query = normalized(description);
    set('description',description);
    if (query.length < 3 || query === lastSuggestedDescription) return;
    const candidates = templates.filter(item => normalized(item.description) === query || normalized(item.description).includes(query));
    const match = candidates[0];
    if (!match) return;
    setLastSuggestedDescription(query);
    setCompanyId(match.companyId);
    setForm(current => ({...current,description,entryType:match.entryType,categoryId:match.categoryId,costCenterId:match.costCenterId,accountId:match.accountId,paymentMethod:match.paymentMethod,cardId:match.cardId,launchType:'single'}));
  }

  async function launch(keepData: boolean) {
    operations.clearFeedback();
    const amount = amountFromDigits(form.amountDigits);
    if (!company || !form.description.trim() || !Number.isFinite(amount) || amount <= 0 || !form.categoryId) return;
    if (form.paymentMethod === 'credit' && (!form.cardId || form.entryType !== 'expense')) return;
    try {
      if (form.launchType === 'recurring') {
        const count = Math.max(1, Math.trunc(Number(form.recurrenceCount || '1')));
        await operations.createRecurrence({ entryType:form.entryType, description:form.description.trim(), counterpartyName:form.counterparty.trim() || null, categoryId:form.categoryId, costCenterId:form.costCenterId || null, amount, frequency:'monthly', intervalCount:1, startDate:form.date, endDate:recurrenceEnd(form.date,count), notes:form.notes.trim() || null });
      } else if (form.paymentMethod === 'credit') {
        await operations.createCardPurchase({ cardId:form.cardId, purchaseDate:form.date, description:form.description.trim(), counterpartyName:form.counterparty.trim() || null, categoryId:form.categoryId, costCenterId:form.costCenterId || null, totalAmount:amount, installmentCount:form.launchType === 'installment' ? Math.max(2,Math.trunc(Number(form.installmentCount || '2'))) : 1, idempotencyKey:idempotencyKey('quick-card-purchase'), notes:form.notes.trim() || null });
      } else {
        const created = await operations.createEntry({ entryType:form.entryType, description:form.description.trim(), counterpartyName:form.counterparty.trim() || null, categoryId:form.categoryId, costCenterId:form.costCenterId || null, competenceMonth:monthStart(form.date), dueDate:form.date, amount, installmentCount:form.launchType === 'installment' ? Math.max(2,Math.trunc(Number(form.installmentCount || '2'))) : 1, notes:form.notes.trim() || null });
        if (form.accountId) await operations.setEntryPlannedAccount(created.entryId, form.accountId);
      }
      await operations.loadReferences();
      if (keepData) resetForNextEntry(); else onClose();
    } catch { /* feedback padronizado permanece visível */ }
  }

  const footer = <div className="quick-entry__footer-actions"><Button variant="secondary" disabled={operations.state.busy} onClick={() => { void launch(true); }}>Lançar e manter dados</Button><Button loading={operations.state.busy} loadingLabel="Lançando…" onClick={() => { void launch(false); }}>Lançar</Button></div>;

  return <Dialog open={open} title="Novo lançamento" description="Dados completos do lançamento financeiro." onClose={onClose} onBack={onClose} loading={operations.state.busy} footer={footer}>
    {!company ? <Feedback tone="danger" title="Empresa obrigatória" message="Selecione uma empresa para continuar." /> : !references && operations.state.busy ? <LoadingState label="Carregando dados do lançamento…" /> : <>
      {operations.state.errorMessage && <Feedback tone="danger" title="Não foi possível lançar" message={operations.state.errorMessage} />}
      {operations.state.successMessage && <Feedback tone="success" title="Lançamento concluído" message={operations.state.successMessage} />}
      {allCompaniesMode && <p className="quick-entry__hint">Na visão “Todas as empresas”, o formulário pode reaproveitar dados do último lançamento semelhante entre as empresas visíveis.</p>}
      <div className="quick-entry">
        <div className="quick-entry__step"><span>1</span><strong>Dados principais</strong></div>
        <div className="quick-entry__grid">
          <Select label="Tipo" value={form.entryType} onChange={(event) => set('entryType', event.target.value as EntryType)} options={[{ value: 'expense', label: 'Despesa' }, { value: 'income', label: 'Receita' }]} />
          <Input label="Data" type="date" value={form.date} onChange={(event) => set('date', event.target.value)} required />
          <Input label="Descrição" placeholder="Ex.: Café da manhã" value={form.description} onChange={(event) => smartFill(event.target.value)} required />
          <Input label="Valor" inputMode="numeric" placeholder="R$ 0,00" value={formatMoneyDigits(form.amountDigits)} onChange={(event) => set('amountDigits', digitsOnly(event.target.value))} required />
          <Select label="Forma de pagamento" value={form.paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)} options={paymentOptions} />
          <Select label="Tipo de lançamento" value={form.launchType} onChange={(event) => set('launchType', event.target.value as LaunchType)} options={launchOptions} />
          {form.launchType === 'installment' && <Input label="Quantidade de parcelas" type="number" min="2" max="120" step="1" value={form.installmentCount} onChange={(event) => set('installmentCount', event.target.value)} required />}
          {form.launchType === 'recurring' && <Input label="Quantidade de repetições" type="number" min="1" max="120" step="1" value={form.recurrenceCount} onChange={(event) => set('recurrenceCount', event.target.value)} required />}
          {form.paymentMethod === 'credit' && <Select label="Cartão" value={form.cardId} onChange={(event) => set('cardId', event.target.value)} options={cardOptions} required />}
          {form.paymentMethod !== 'credit' && <Select label="Conta / banco" value={form.accountId} onChange={(event) => set('accountId', event.target.value)} options={accountOptions} />}
          {companies.length > 1 ? <Select label="Empresa" value={companyId} options={companyOptions} onChange={(event) => { setCompanyId(event.target.value); setForm((current) => ({ ...current, categoryId:'', costCenterId:'', accountId:'', cardId:'' })); }} /> : <Input label="Empresa" value={company.tradeName ?? company.legalName} disabled />}
          <Select label="Obra / centro de custo" value={form.costCenterId} onChange={(event) => set('costCenterId', event.target.value)} options={costCenterOptions} />
          <Select label="Categoria" value={form.categoryId} onChange={(event) => set('categoryId', event.target.value)} options={categoryOptions} required />
        </div>
        <Button variant="secondary" className="quick-entry__more" onClick={() => setMoreOptions((value) => !value)} aria-expanded={moreOptions}>{moreOptions ? '⌃ Menos opções' : '⌄ Mais opções'}</Button>
        {moreOptions && <div className="quick-entry__more-grid"><Input label={form.entryType === 'expense' ? 'Fornecedor / beneficiário' : 'Pagador / origem'} value={form.counterparty} onChange={(event) => set('counterparty', event.target.value)} /><Input label="Observação" value={form.notes} onChange={(event) => set('notes', event.target.value)} /></div>}
      </div>
    </>}
  </Dialog>;
}
